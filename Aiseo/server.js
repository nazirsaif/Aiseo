const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
require('dotenv').config();
 
const app = express();
const PORT = process.env.BACKEND_PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'changeme_dev_secret';

// ─── Rate limiters ────────────────────────────────────────────────────────────
// Expensive endpoints (external HTTP + ML inference) are tightly limited.

const auditLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased from 10
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many audit requests. Please wait 15 minutes before trying again.' }
});

const keywordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Increased from 15
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many keyword research requests. Please wait 15 minutes.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Increased from 30
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please wait 15 minutes.' }
});

// ─── SSRF protection ─────────────────────────────────────────────────────────
// Blocks requests to private/loopback IP ranges to prevent server-side forgery.

function isSafeUrl(urlString) {
  try {
    // Block non-http protocols before any URL manipulation
    // Catches file://, ftp://, javascript:, etc.
    if (urlString.includes('://') &&
        !urlString.startsWith('http://') &&
        !urlString.startsWith('https://')) {
      return false;
    }

    const urlToParse = urlString.startsWith('http') ? urlString : `https://${urlString}`;
    const url = new URL(urlToParse);

    // Only allow http and https
    if (!['http:', 'https:'].includes(url.protocol)) return false;

    const host = url.hostname.toLowerCase();

    // Block loopback
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;

    // Block private IPv4 ranges
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const [, a, b] = ipv4.map(Number);
      if (a === 10)                          return false; // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31)   return false; // 172.16.0.0/12
      if (a === 192 && b === 168)             return false; // 192.168.0.0/16
      if (a === 169 && b === 254)             return false; // link-local
      if (a === 0)                            return false; // 0.x.x.x
    }

    return true;
  } catch {
    return false;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seo_tool')
  .then(() => {
    console.log('✅ MongoDB connected');
    mongoose.set('debug', true);
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Models
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    company: { type: String, trim: true },
    // Optional extended profile fields used in Settings page
    websiteUrl: { type: String, trim: true },
    bio: { type: String, trim: true },
    // Persist user preferences / settings toggles
    settings: {
      toggles: {
        twoFA: { type: Boolean, default: false },
        darkMode: { type: Boolean, default: false },
        compactView: { type: Boolean, default: true },
        autoRefresh: { type: Boolean, default: true },
        rankingChanges: { type: Boolean, default: true },
        keywordOpportunities: { type: Boolean, default: true },
        contentGapAlerts: { type: Boolean, default: true },
        weeklyReports: { type: Boolean, default: true },
        browserNotifications: { type: Boolean, default: false },
        soundAlerts: { type: Boolean, default: false }
      },
      // Basic preferences used by dropdowns (language, timezone, etc.)
      preferences: {
        language: { type: String, default: 'English (US)' },
        timezone: { type: String, default: 'Pakistan Standard Time (PKT)' },
        defaultReportFormat: { type: String, default: 'PDF' }
      }
    },
    billing: {
      plan: { type: String, default: 'Professional Plan' },
      paymentMethods: {
        type: [{
          cardNumber: String,
          expiry: String,
          isDefault: Boolean
        }],
        default: [{ cardNumber: '•••• •••• •••• 4242', expiry: '12/2026', isDefault: true }]
      }
    },
    activeSessions: {
      type: [{
        deviceInfo: String,
        location: String,
        lastActive: String,
        isActive: { type: Boolean, default: true }
      }],
      default: [
        { deviceInfo: 'Chrome on Windows', location: 'Rawalpindi, Pakistan', lastActive: 'Current session', isActive: true },
        { deviceInfo: 'Safari on iPhone', location: 'Rawalpindi, Pakistan', lastActive: 'Last active 2 hours ago', isActive: true }
      ]
    }
  },
  { timestamps: true }
);

const analysisSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    input: { type: String, required: true, trim: true }, // keyword or URL
  },
  { timestamps: true }
);

// Issue subdocument schema
const issueSchema = new mongoose.Schema({
  issueType: { type: String, required: true },
  category: { type: String, required: true },
  message: { type: String, required: true },
  impact: { type: String, required: true },
  recommendation: { type: String } // Added linked recommendation
}, { _id: false });

const seoAuditSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    url: { type: String, trim: true },
    score: { type: Number, required: true },
    grade: { type: String, required: true },
    isDeepCrawl: { type: Boolean, default: false }, // Flag to identify deep crawl audits
    elements: {
      title: { type: String, default: '' },
      metaDescription: { type: String, default: '' },
      h1Count: { type: Number, default: 0 },
      h1Tags: { type: [String], default: [] },
      h2Count: { type: Number, default: 0 },
      imageCount: { type: Number, default: 0 },
      imagesWithoutAlt: { type: Number, default: 0 },
      linkCount: { type: Number, default: 0 },
      wordCount: { type: Number, default: 0 },
      hasOpenGraph: { type: Boolean, default: false },
      hasTwitterCard: { type: Boolean, default: false }
    },
    audit: {
      issuesCount: { type: Number, default: 0 },
      issues: { type: [issueSchema], default: [] },
      recommendationsCount: { type: Number, default: 0 },
      recommendations: { type: [String], default: [] },
      projected_score: { type: Number },
      ml_prediction: { type: Number },
      llmRecommendations: { type: String }
    },
    // Deep crawl specific fields
    crawlStats: {
      pagesCrawled: { type: Number, default: 0 },
      maxDepth: { type: Number, default: 0 },
      maxPages: { type: Number, default: 0 },
      actualDepth: { type: Number, default: 0 },
      errorsCount: { type: Number, default: 0 }
    },
    pages: [{
      url: { type: String, default: '' },
      depth: { type: Number, default: 0 },
      score: { type: Number, default: 0 },
      grade: { type: String, default: 'F' },
      issuesCount: { type: Number, default: 0 }
    }],
    aggregate: {
      averageScore: { type: Number, default: 0 },
      grade: { type: String, default: 'F' },
      totalIssues: { type: Number, default: 0 },
      totalRecommendations: { type: Number, default: 0 }
    },
    // Simulated metrics for premium UI experience
    rankingKeywords: { type: Number, default: 0 },
    rankingKeywordsTrend: { type: String, default: '+0%' },
    totalBacklinks: { type: Number, default: 0 },
    totalBacklinksTrend: { type: String, default: '+0%' },
    monthlyTraffic: { type: String, default: '0' },
    monthlyTrafficTrend: { type: String, default: '+0%' },
    scoreTrend: { type: String, default: '+0%' }
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
const Analysis = mongoose.model('Analysis', analysisSchema);
const SEOAudit = mongoose.model('SEOAudit', seoAuditSchema);

// Helper: auth middleware
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Simple validation helpers
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Routes

// Helper to safely expose user to frontend
function toPublicUser(userDoc) {
  if (!userDoc) return null;
  return {
    id: userDoc._id,
    name: userDoc.name,
    email: userDoc.email,
    company: userDoc.company || '',
    websiteUrl: userDoc.websiteUrl || '',
    bio: userDoc.bio || '',
    settings: {
      toggles: {
        twoFA: userDoc.settings?.toggles?.twoFA ?? false,
        darkMode: userDoc.settings?.toggles?.darkMode ?? false,
        compactView: userDoc.settings?.toggles?.compactView ?? true,
        autoRefresh: userDoc.settings?.toggles?.autoRefresh ?? true,
        rankingChanges: userDoc.settings?.toggles?.rankingChanges ?? true,
        keywordOpportunities: userDoc.settings?.toggles?.keywordOpportunities ?? true,
        contentGapAlerts: userDoc.settings?.toggles?.contentGapAlerts ?? true,
        weeklyReports: userDoc.settings?.toggles?.weeklyReports ?? true,
        browserNotifications: userDoc.settings?.toggles?.browserNotifications ?? false,
        soundAlerts: userDoc.settings?.toggles?.soundAlerts ?? false
      },
      preferences: {
        language: userDoc.settings?.preferences?.language || 'English (US)',
        timezone: userDoc.settings?.preferences?.timezone || 'Pakistan Standard Time (PKT)',
        defaultReportFormat: userDoc.settings?.preferences?.defaultReportFormat || 'PDF'
      }
    },
    billing: userDoc.billing || { plan: 'Professional Plan', paymentMethods: [] },
    activeSessions: userDoc.activeSessions || []
  };
}

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, company } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ message: 'Name is required (min 2 characters)' });
    }
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      company: company || '',
    });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: toPublicUser(user),
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !validateEmail(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: toPublicUser(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save keyword/URL input
app.post('/api/analysis', auth, async (req, res) => {
  try {
    const { input } = req.body;
    if (!input || !input.trim()) {
      return res.status(400).json({ message: 'Input is required' });
    }

    const record = await Analysis.create({
      user: req.userId,
      input: input.trim(),
    });

    res.status(201).json({ message: 'Saved successfully', id: record._id });
  } catch (err) {
    console.error('Analysis save error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Dashboard overview metrics for main page cards
app.get('/api/dashboard/overview', auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    console.log('[Dashboard-Diagnostic] User ID:', userId);

    // Diagnostic check for audits
    const auditCount = await SEOAudit.countDocuments({ user: userId });
    console.log('[Dashboard-Diagnostic] Total Audits for User:', auditCount);

    const [analysisCount, audits, avgScoreAgg, latestAudit, history] = await Promise.all([
      Analysis.countDocuments({ user: userId }),
      SEOAudit.find({ user: userId }).select('score audit.issuesCount').lean(),
      SEOAudit.aggregate([
        { $match: { user: userId } },
        { $group: { _id: null, avgScore: { $avg: '$score' } } }
      ]),
      SEOAudit.findOne({ user: userId }).sort({ createdAt: -1 }).lean(),
      SEOAudit.find({ user: userId }).sort({ createdAt: -1 }).limit(10).select('score createdAt').lean()
    ]);

    console.log('[Dashboard-Diagnostic] Latest Audit Found:', latestAudit ? 'YES' : 'NO');
    if (latestAudit) console.log('[Dashboard-Diagnostic] Latest URL:', latestAudit.url);
    
    // Sort history chronologically for the graph (Oldest to Newest)
    const sortedHistory = (history || []).reverse();
    console.log('[Dashboard-Diagnostic] History Sample:', JSON.stringify(sortedHistory.slice(0, 2), null, 2));

    const totalAudits = audits.length;
    const totalIssues = audits.reduce((sum, a) => sum + (a.audit?.issuesCount || 0), 0);
    const avgScore = avgScoreAgg.length ? Math.round(avgScoreAgg[0].avgScore) : 0;

    res.json({
      keywordClusters: analysisCount,
      contentGaps: totalIssues,
      serpInsights: totalAudits,
      seoScore: avgScore,
      latestAudit: latestAudit ? {
        url: latestAudit.url,
        score: latestAudit.score,
        scoreTrend: latestAudit.scoreTrend || '+0%',
        rankingKeywords: latestAudit.rankingKeywords || 0,
        rankingKeywordsTrend: latestAudit.rankingKeywordsTrend || '+0%',
        totalBacklinks: latestAudit.totalBacklinks || 0,
        totalBacklinksTrend: latestAudit.totalBacklinksTrend || '+0%',
        monthlyTraffic: latestAudit.monthlyTraffic || '0',
        monthlyTrafficTrend: latestAudit.monthlyTrafficTrend || '+0%',
        timestamp: latestAudit.createdAt
      } : null,
      history: sortedHistory.map(h => ({
        score: h.score,
        createdAt: h.createdAt
      }))
    });
  } catch (err) {
    console.error('Dashboard overview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Dashboard recent keyword inputs for "Top Performing Keywords" table
app.get('/api/dashboard/keywords', auth, async (req, res) => {
  try {
    const analyses = await Analysis.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const rows = analyses.map((a, index) => ({
      id: a._id,
      keyword: a.input,
      searchVolume: 1000 + index * 500, // simple derived numbers to keep UI rich
      difficulty: index % 3 === 0 ? 'Easy' : index % 3 === 1 ? 'Medium' : 'Hard',
      performance: index % 3 === 0 ? 'Strong' : index % 3 === 1 ? 'Medium' : 'Weak',
      opportunity: index % 3 === 0 ? 'High' : index % 3 === 1 ? 'Medium' : 'Very High'
    }));

    res.json({ keywords: rows });
  } catch (err) {
    console.error('Dashboard keywords error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Dashboard AI Suggestions
app.get('/api/dashboard/suggestions', auth, async (req, res) => {
  try {
    const [analysisCount, audits, avgScoreAgg] = await Promise.all([
      Analysis.countDocuments({ user: req.userId }),
      SEOAudit.find({ user: req.userId }).select('score audit.issuesCount').lean(),
      SEOAudit.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(req.userId) } },
        { $group: { _id: null, avgScore: { $avg: '$score' } } }
      ])
    ]);

    const overview = {
      keywordClusters: analysisCount,
      contentGaps: audits.reduce((sum, a) => sum + (a.audit?.issuesCount || 0), 0),
      seoScore: avgScoreAgg.length ? Math.round(avgScoreAgg[0].avgScore) : 0
    };

    if (overview.seoScore === 0 && overview.contentGaps === 0) {
      // Very basic static fallback if no data
      return res.json({
        available: false,
        suggestions: [
          { priority: "High", title: "Run your first SEO Audit", description: "Start by entering a URL in the SEO Audit tab." },
          { priority: "Medium", title: "Analyze Keywords", description: "Use the keyword research tool to find missing opportunities." },
          { priority: "Low", title: "Configure Settings", description: "Check your settings to establish baseline preferences." }
        ]
      });
    }

    let result = { available: false, suggestions: [] };
    // Fallback if LLM fails or is unavailable
    if (!result.available || !result.suggestions || result.suggestions.length === 0) {
      result = {
        available: false,
        suggestions: [
          { priority: "High", title: "Optimize existing pages", description: `You have ${overview.contentGaps} issues. Start fixing them.` },
          { priority: "Medium", title: "Expand keyword clusters", description: `You have ${overview.keywordClusters} analysis runs. Keep researching new topics.` },
          { priority: "Low", title: "Improve overall score", description: `Your average SEO score is ${overview.seoScore}. Aim for 90+.` }
        ]
      };
    }

    res.json(result);
  } catch (err) {
    console.error('Dashboard AI Suggestions error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// SEO Audit Pipeline - Automated SEO analysis
const seoAuditService = require('./services/seoAuditService');
const keywordResearchService = require('./services/keywordResearchService');
const webSearchService = require('./services/webSearchService');
app.post('/api/seo-audit', auth, auditLimiter, async (req, res) => {
  try {
    const { url, html, deepCrawl, maxDepth, maxPages } = req.body;
    let savedAudit; // Declared at top level for access in all paths and finally block

    console.log('SEO Audit Request:', { 
      url: url ? 'provided' : 'none', 
      html: html ? 'provided' : 'none',
      deepCrawl: deepCrawl || false,
      maxDepth: maxDepth || 3,
      maxPages: maxPages || 10
    });

    if (!url && !html) {
      return res.status(400).json({ message: 'Either URL or HTML content is required' });
    }

    // SSRF protection — block private/loopback URLs
    if (url && !isSafeUrl(url)) {
      return res.status(400).json({ message: 'Invalid URL: private, loopback, or non-HTTP URLs are not allowed.' });
    }

    // Perform SEO audit - use deep crawl if requested
    let auditResult;
    try {
      if (deepCrawl && url && !html) {
        // Deep crawl mode - only works with URL, not HTML
        console.log('Calling performDeepCrawlAudit...');
        auditResult = await seoAuditService.performDeepCrawlAudit(url, {
          maxDepth: maxDepth || 3,
          maxPages: maxPages || 10
        });
      } else {
        // Regular single page audit
        console.log('Calling performSEOAudit...');
        auditResult = await seoAuditService.performSEOAudit(url, html);
      }
    } catch (serviceError) {
      console.error('Service error:', serviceError);
      return res.status(500).json({
        message: 'Error in SEO audit service',
        error: serviceError.message || 'Unknown service error'
      });
    }

    if (!auditResult) {
      return res.status(500).json({
        message: 'SEO audit service returned no result'
      });
    }

    console.log('Audit result:', auditResult.success ? 'Success' : 'Failed', auditResult.success ? '' : auditResult.error);
    
    if (!auditResult.success) {
      console.log('Audit failed, returning error response');
      return res.status(400).json({ 
        message: auditResult.error || 'Failed to perform SEO audit',
        error: auditResult.error
      });
    }

    console.log('Audit succeeded, checking if deep crawl...');
    
    // Handle deep crawl results - save to database
    // Check if it's a deep crawl by checking for aggregate OR crawlStats (more reliable)
    console.log('\n=== CHECKING DEEP CRAWL SAVE CONDITION ===');
    console.log('  deepCrawl from request:', deepCrawl, 'type:', typeof deepCrawl);
    console.log('  auditResult keys:', Object.keys(auditResult));
    console.log('  has aggregate:', !!auditResult.aggregate);
    console.log('  has crawlStats:', !!auditResult.crawlStats);
    
    const isDeepCrawlResult = !!(auditResult.aggregate || auditResult.crawlStats);
    const deepCrawlBool = deepCrawl === true || deepCrawl === 'true' || deepCrawl === 1 || String(deepCrawl).toLowerCase() === 'true';
    const shouldSaveDeepCrawl = deepCrawlBool && isDeepCrawlResult;
    
    console.log('  isDeepCrawlResult:', isDeepCrawlResult);
    console.log('  deepCrawlBool (converted):', deepCrawlBool);
    console.log('  shouldSaveDeepCrawl:', shouldSaveDeepCrawl);
    
    if (shouldSaveDeepCrawl) {
      console.log('\n=== DEEP CRAWL DETECTED - SAVING TO DATABASE ===');
      console.log('Saving deep crawl audit to database...');
      console.log('User ID:', req.userId);
      if (auditResult.crawlStats) {
        console.log('Crawl Stats:', JSON.stringify(auditResult.crawlStats, null, 2));
      }
      console.log('Pages count:', auditResult.pages?.length || 0);
      console.log('Aggregate:', JSON.stringify(auditResult.aggregate, null, 2));
      
      try {
        const userId = new mongoose.Types.ObjectId(req.userId);
        // Ensure we have valid data
        const pagesData = (auditResult.pages || []).map(page => ({
          url: page.url || '',
          depth: page.depth || 0,
          score: page.score || 0,
          grade: page.grade || 'F',
          issuesCount: page.issuesCount || 0
        }));

        const auditData = {
          user: userId,
          url: auditResult.startURL || url || 'Deep Crawl Audit',
          score: auditResult.aggregate.averageScore || 0,
          grade: auditResult.aggregate.grade || 'F',
          isDeepCrawl: true,
          elements: {
            // For deep crawl, we can store aggregate or first page data
            title: auditResult.detailedPages?.[0]?.elements?.title || 'Deep Crawl Audit',
            metaDescription: auditResult.detailedPages?.[0]?.elements?.metaDescription || '',
            h1Count: auditResult.detailedPages?.[0]?.elements?.h1Count || 0,
            h1Tags: auditResult.detailedPages?.[0]?.elements?.h1Tags || [],
            h2Count: auditResult.detailedPages?.[0]?.elements?.h2Count || 0,
            imageCount: auditResult.detailedPages?.[0]?.elements?.imageCount || 0,
            imagesWithoutAlt: auditResult.detailedPages?.[0]?.elements?.imagesWithoutAlt || 0,
            linkCount: auditResult.detailedPages?.[0]?.elements?.linkCount || 0,
            wordCount: auditResult.detailedPages?.[0]?.elements?.wordCount || 0,
            hasOpenGraph: auditResult.detailedPages?.[0]?.elements?.hasOpenGraph || false,
            hasTwitterCard: auditResult.detailedPages?.[0]?.elements?.hasTwitterCard || false
          },
          audit: {
            score: auditResult.aggregate.averageScore || 0,
            grade: auditResult.aggregate.grade || 'F',
            projected_score: auditResult.technical_audit?.projected_score || auditResult.ai_prediction?.projected_score || (auditResult.aggregate.averageScore + 12),
            ml_prediction: auditResult.technical_audit?.ml_prediction ?? 1,
            issuesCount: auditResult.aggregate.totalIssues || 0,
            issues: (auditResult.aggregate.topIssues || []).map(issue => ({
              issueType: issue.type || 'info',
              category: issue.category || 'general',
              message: issue.message || '',
              impact: issue.impact || 'Low',
              recommendation: issue.recommendation || issue.solution || ''
            })),
            recommendationsCount: auditResult.aggregate.totalRecommendations || 0,
            recommendations: auditResult.aggregate.recommendations || [],
            projected_score: auditResult.audit?.projected_score || auditResult.aggregate?.projected_score || 0,
            ml_prediction: auditResult.audit?.ml_prediction ?? 1,
            llmRecommendations: auditResult.ollama?.llmRecommendations || ""
          },
          crawlStats: {
            pagesCrawled: auditResult.crawlStats?.pagesCrawled || 0,
            maxDepth: auditResult.crawlStats?.maxDepth || 0,
            maxPages: auditResult.crawlStats?.maxPages || 0,
            actualDepth: auditResult.crawlStats?.actualDepth || 0,
            errorsCount: auditResult.crawlStats?.errorsCount || 0
          },
          pages: pagesData,
          aggregate: {
            averageScore: auditResult.aggregate.averageScore || 0,
            grade: auditResult.aggregate.grade || 'F',
            totalIssues: auditResult.aggregate.totalIssues || 0,
            totalRecommendations: auditResult.aggregate.totalRecommendations || 0
          },
          // Generate simulated data for demo purposes
          rankingKeywords: Math.floor(800 + Math.random() * 1000),
          rankingKeywordsTrend: `+${Math.floor(2 + Math.random() * 15)}%`,
          totalBacklinks: Math.floor(400 + Math.random() * 600),
          totalBacklinksTrend: `+${Math.floor(1 + Math.random() * 8)}%`,
          monthlyTraffic: `${(10 + Math.random() * 40).toFixed(1)}K`,
          monthlyTrafficTrend: `+${Math.floor(5 + Math.random() * 20)}%`,
          scoreTrend: `+${Math.floor(1 + Math.random() * 10)}%`
        };
        
        console.log('[DeepCrawl] Attempting to save to MongoDB for user:', req.userId);
        savedAudit = await SEOAudit.create(auditData);
        
        // Verification check
        const verify = await SEOAudit.findById(savedAudit._id);
        if (verify) {
          console.log('[DeepCrawl] ✅ VERIFIED: Deep crawl record is physically in MongoDB! ID:', verify._id);
        } else {
          console.error('[DeepCrawl] ❌ CRITICAL: Deep crawl saved but could not be retrieved immediately!');
        }
        
        console.log('[DeepCrawl] URL:', savedAudit.url);
        console.log('[DeepCrawl] Score:', savedAudit.score);
      } catch (dbError) {
        console.error('[DeepCrawl] ❌ Database save error:', dbError);
        console.error('Error name:', dbError.name);
        console.error('Error message:', dbError.message);
        console.error('Error stack:', dbError.stack);
        if (dbError.errors) {
          console.error('Validation errors:', JSON.stringify(dbError.errors, null, 2));
        }
        
        // Still return the audit result even if save fails
        return res.status(200).json({
          message: 'Deep crawl audit completed but failed to save to database',
          error: dbError.message,
          result: auditResult,
          warning: 'Result not saved to database. Check server logs for details.'
        });
      }

      console.log('✅ Deep crawl saved, sending response...');
      return res.status(201).json({
        message: 'Deep crawl audit completed successfully',
        auditId: savedAudit._id,
        result: auditResult
      });
    } else {
      console.log('⚠️ NOT saving as deep crawl - processing as regular audit');
      console.log('  Reason: deepCrawlBool =', deepCrawlBool, ', isDeepCrawlResult =', isDeepCrawlResult);
    }

    // Validate regular audit result structure
    if (!auditResult.audit || !auditResult.elements) {
      console.error('Invalid audit result structure:', auditResult);
      return res.status(500).json({
        message: 'Invalid audit result structure',
        error: 'Audit completed but result format is invalid'
      });
    }

    // Ollama enrichment disabled completely.
    auditResult.ollama = { available: false };

    // Save audit result to database (regular single page audit)
    console.log('Saving audit to database...');
    console.log('User ID:', req.userId);
    console.log('Audit data:', {
      score: auditResult.audit.score,
      grade: auditResult.audit.grade,
      hasElements: !!auditResult.elements,
      hasAudit: !!auditResult.audit
    });
    
    try {
      const userId = new mongoose.Types.ObjectId(req.userId);
      console.log(`[DB-TRACE] Saving audit for User: ${userId} to DB: ${mongoose.connection.name} at Host: ${mongoose.connection.host}`);
      const auditData = {
        user: userId,
        url: url || 'HTML Content Provided',
        score: auditResult.audit.score,
        grade: auditResult.audit.grade,
        elements: {
          title: auditResult.elements.title || '',
          metaDescription: auditResult.elements.metaDescription || '',
          h1Count: auditResult.elements.h1Count || 0,
          h1Tags: auditResult.elements.h1Tags || [],
          h2Count: auditResult.elements.h2Count || 0,
          imageCount: auditResult.elements.imageCount || 0,
          imagesWithoutAlt: auditResult.elements.imagesWithoutAlt || 0,
          linkCount: auditResult.elements.linkCount || 0,
          wordCount: auditResult.elements.wordCount || 0,
          hasOpenGraph: auditResult.elements.hasOpenGraph || false,
          hasTwitterCard: auditResult.elements.hasTwitterCard || false
        },
          audit: {
            score: auditResult.audit.score,
            grade: auditResult.audit.grade,
            projected_score: auditResult.audit.projected_score || (auditResult.audit.score + 10),
            ml_prediction: auditResult.audit.ml_prediction ?? 1,
            llmRecommendations: auditResult.ollama?.llmRecommendations || "",
            issuesCount: auditResult.audit.issuesCount || 0,
            issues: (auditResult.audit.issues || []).map(issue => ({
              issueType: issue.type, // map 'type' to 'issueType' to avoid Mongoose conflict
              category: issue.category,
              message: issue.message,
              impact: issue.impact,
              recommendation: issue.recommendation || issue.solution || ''
            })),
            recommendationsCount: auditResult.audit.recommendationsCount || 0,
            recommendations: auditResult.audit.recommendations || []
          },
          // Generate simulated data for demo purposes
          rankingKeywords: Math.floor(1000 + (auditResult.audit.score * 5) + Math.random() * 200),
          rankingKeywordsTrend: `+${Math.floor(5 + Math.random() * 10)}%`,
          totalBacklinks: Math.floor(500 + (auditResult.audit.score * 3) + Math.random() * 100),
          totalBacklinksTrend: `+${Math.floor(2 + Math.random() * 5)}%`,
          monthlyTraffic: `${(30 + (auditResult.audit.score / 5) + Math.random() * 10).toFixed(1)}K`,
          monthlyTrafficTrend: `+${Math.floor(10 + Math.random() * 15)}%`,
          scoreTrend: `+${Math.floor(1 + Math.random() * 5)}%`
        };
      
      console.log('[SEOAudit] Attempting to save to MongoDB for user:', req.userId);
      savedAudit = await SEOAudit.create(auditData);
      
      // Verification check to confirm storage
      const verify = await SEOAudit.findById(savedAudit._id);
      if (verify) {
        console.log('[SEOAudit] ✅ VERIFIED: Audit record is physically in MongoDB! ID:', verify._id);
      } else {
        console.error('[SEOAudit] ❌ CRITICAL: Audit saved but could not be retrieved immediately!');
      }
      
      console.log('[SEOAudit] URL:', savedAudit.url);
      console.log('[SEOAudit] Score:', savedAudit.score);
    } catch (dbError) {
      console.error('[SEOAudit] ❌ Database save error:', dbError);
      console.error('Error name:', dbError.name);
      console.error('Error message:', dbError.message);
      console.error('Error code:', dbError.code);
      if (dbError.errors) {
        console.error('Validation errors:', dbError.errors);
      }
      
      // Still return the audit result even if save fails
      return res.status(201).json({
        message: 'SEO audit completed but failed to save to database',
        error: dbError.message,
        result: auditResult,
        warning: 'Result not saved to database. Check server logs for details.'
      });
    }

    res.status(201).json({
      message: 'SEO audit completed successfully',
      auditId: savedAudit._id,
      result: auditResult
    });
  } catch (err) {
    console.error('=== SEO AUDIT ERROR ===');
    console.error('Error type:', err.constructor.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('======================');
    
    res.status(500).json({ 
      message: 'Server error during SEO audit',
      error: err.message || 'Unknown error occurred'
    });
  }
});

// Keyword Research & Competitive Analysis (F5, F6, F7)
// Uses Sentence Transformer model for semantic analysis
app.post('/api/keywords/research', auth, keywordLimiter, async (req, res) => {
  try {
    const { baseKeyword, url } = req.body;
    const keyword = (baseKeyword || '').trim();
    if (!keyword) return res.status(400).json({ message: 'baseKeyword is required' });

    console.log(`[KeywordResearch] Analyzing: "${keyword}" ${url ? `for URL: ${url}` : ''}`);

    let suggestions;
    if (url) {
      // Perform competitive/contextual research using the URL
      suggestions = await keywordResearchService.performContextualResearch(keyword, url);
    } else {
      // Fallback to purely semantic patterns
      suggestions = await keywordResearchService.generateFallbackSuggestions(keyword);
    }

    res.json({
      baseKeyword: keyword,
      targetUrl: url || null,
      suggestions: suggestions.slice(0, 30),
      metadata: {
        totalSuggestions: suggestions.length,
        source: url ? 'contextual-analyzer' : 'semantic-generator'
      }
    });
  } catch (err) {
    console.error('Keyword research error:', err.message);
    res.status(500).json({ message: 'Server error during keyword research' });
  }
});

// Competitor Comparison & Content Gap
app.post('/api/competitor/compare', auth, async (req, res) => {
  try {
    const { ownUrl, competitorUrl } = req.body;
    if (!ownUrl || !competitorUrl) {
      return res.status(400).json({ message: 'Both Own URL and Competitor URL are required' });
    }

    console.log(`\n=== Competitor Comparison Request ===`);
    console.log(`Own: ${ownUrl} vs Comp: ${competitorUrl}`);

    // Fetch and Analyze both
    const [ownResult, compResult] = await Promise.all([
      seoAuditService.performSEOAudit(ownUrl, null),
      seoAuditService.performSEOAudit(competitorUrl, null)
    ]);

    if (!ownResult.success || !compResult.success) {
      return res.status(400).json({ 
        message: 'Failed to analyze one or both websites',
        ownError: ownResult.error,
        compError: compResult.error
      });
    }

    // Call Python AI Model for Comparison with extended timeout
    const comparisonResponse = await axios.post('http://localhost:5001/compare', {
      own: {
        ...ownResult.elements,
        content_length: ownResult.elements.wordCount,
        num_internal_links: ownResult.elements.linkCount,
        domain_authority: 30,
      },
      competitor: {
        ...compResult.elements,
        content_length: compResult.elements.wordCount,
        num_internal_links: compResult.elements.linkCount,
        domain_authority: 45,
      }
    }, { timeout: 45000 });

    if (comparisonResponse.data && comparisonResponse.data.status === 'success') {
      return res.json({
        success: true,
        own: {
          url: ownUrl,
          score: ownResult.audit.score,
          grade: ownResult.audit.grade,
          elements: ownResult.elements
        },
        competitor: {
          url: competitorUrl,
          score: compResult.audit.score,
          grade: compResult.audit.grade,
          elements: compResult.elements
        },
        analysis: comparisonResponse.data.comparison
      });
    }

    res.status(500).json({ message: 'Comparison model failed to respond correctly' });
  } catch (err) {
    console.error('Comparison error:', err.message);
    res.status(500).json({ message: 'Server error during comparison', error: err.message });
  }
});

// Get current user's profile + settings
app.get('/api/user/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    console.error('Get current user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update current user's profile + settings (from Settings page)
app.put('/api/user/me', auth, async (req, res) => {
  try {
    const {
      name,
      email,
      company,
      websiteUrl,
      bio,
      settings,
      billing,
      activeSessions
    } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name && name.trim().length >= 2) {
      user.name = name.trim();
    }

    if (email && email.toLowerCase().trim() !== user.email) {
      if (!validateEmail(email)) {
        return res.status(400).json({ message: 'Valid email is required' });
      }
      const existing = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: user._id } });
      if (existing) {
        return res.status(400).json({ message: 'Email is already registered' });
      }
      user.email = email.toLowerCase().trim();
    }

    if (company !== undefined) {
      user.company = company || '';
    }

    if (websiteUrl !== undefined) {
      user.websiteUrl = websiteUrl || '';
    }

    if (bio !== undefined) {
      user.bio = bio || '';
    }

    if (settings) {
      user.settings = {
        ...user.settings?.toObject?.() || user.settings || {},
        toggles: {
          ...user.settings?.toggles?.toObject?.() || user.settings?.toggles || {},
          ...(settings.toggles || {})
        },
        preferences: {
          ...user.settings?.preferences?.toObject?.() || user.settings?.preferences || {},
          ...(settings.preferences || {})
        }
      };
    }

    if (billing !== undefined) {
      user.billing = billing;
    }

    if (activeSessions !== undefined) {
      user.activeSessions = activeSessions;
    }

    await user.save();
    res.json({ message: 'Profile updated successfully', user: toPublicUser(user) });
  } catch (err) {
    console.error('Update current user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password from Account Security tab
app.post('/api/user/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Dynamic Reports list for Reports page (based on saved audits)
app.get('/api/reports', auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const audits = await SEOAudit.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Map audits to report cards while preserving existing design fields
    const reports = audits.map((audit, index) => {
      const created = audit.createdAt ? new Date(audit.createdAt) : new Date();
      const dateStr = created.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      // Choose icon/type based on audit type / score
      const isDeep = audit.isDeepCrawl;
      const icon = isDeep
        ? 'fa-spider'
        : audit.score >= 80
        ? 'fa-file-pdf'
        : audit.score >= 60
        ? 'fa-chart-bar'
        : 'fa-search';

      const type = isDeep
        ? 'Deep Crawl'
        : audit.score >= 80
        ? 'Comprehensive'
        : audit.score >= 60
        ? 'Detailed'
        : 'Quick';

      const pages = isDeep
        ? audit.crawlStats?.pagesCrawled || 10
        : 10 + (audit.audit?.issuesCount || 0);

      const title = isDeep
        ? `Deep Crawl Audit – ${audit.url || 'Website'}`
        : `SEO Audit Report – ${audit.url || 'Website'}`;

      const description =
        (audit.audit?.issuesCount || 0) > 0
          ? `Includes ${audit.audit.issuesCount} issues and ${audit.audit.recommendationsCount || 0} recommendations. Overall grade: ${audit.grade || 'N/A'}.`
          : `Automated SEO report for ${audit.url || 'your site'} with overall grade ${audit.grade || 'N/A'}.`;

      return {
        id: audit._id,
        icon,
        date: dateStr,
        title,
        type,
        pages,
        description
      };
    });

    res.json({ reports });
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's SEO audit history
app.get('/api/seo-audit', auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const audits = await SEOAudit.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-__v')
      .lean();

    // Map issueType back to type for frontend compatibility
    const formattedAudits = audits.map(audit => {
      const formatted = {
        ...audit,
        audit: {
          ...audit.audit,
          issues: audit.audit.issues.map(issue => ({
            type: issue.issueType, // map back to 'type' for frontend
            category: issue.category,
            message: issue.message,
            impact: issue.impact
          }))
        }
      };
      
      // Include deep crawl data if it exists
      if (audit.isDeepCrawl) {
        formatted.isDeepCrawl = true;
        formatted.crawlStats = audit.crawlStats || {};
        formatted.pages = audit.pages || [];
        formatted.aggregate = audit.aggregate || {};
      }
      
      return formatted;
    });

    res.json({
      count: formattedAudits.length,
      audits: formattedAudits
    });
  } catch (err) {
    console.error('Get audits error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get specific audit by ID
app.get('/api/seo-audit/:id', auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const audit = await SEOAudit.findOne({ _id: req.params.id, user: userId }).select('-__v').lean();

    if (!audit) {
      return res.status(404).json({ message: 'Audit not found' });
    }

    // Map issueType back to type for frontend compatibility
    const formattedAudit = {
      ...audit,
      audit: {
        ...audit.audit,
        issues: audit.audit.issues.map(issue => ({
          type: issue.issueType, // map back to 'type' for frontend
          category: issue.category,
          message: issue.message,
          impact: issue.impact,
          recommendation: issue.recommendation
        }))
      }
    };

    res.json(formattedAudit);
  } catch (err) {
    console.error('Get audit error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// API root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'SEO Insights API Server', status: 'running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


