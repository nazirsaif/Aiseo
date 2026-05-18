const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const crypto = require('crypto');
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
    profilePicture: { type: String, default: '' },
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
    },
    apiKey: { type: String, default: 'NEURAL_KEY_PENDING' }
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

const keywordResearchSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  baseKeyword: { type: String, required: true },
  targetUrl: { type: String, default: null },
  suggestions: { type: Array, default: [] },
  metadata: { type: Object, default: {} }
}, { timestamps: true });

const competitorAnalysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownUrl: { type: String, required: true },
  competitorUrl: { type: String, required: true },
  own: { type: Object, default: {} },
  competitor: { type: Object, default: {} },
  analysis: { type: Object, default: {} }
}, { timestamps: true });

const contentDraftSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetKeyword: { type: String, required: true },
  originalText: { type: String, required: true },
  optimizedText: { type: String, required: true },
  injectedKeywords: { type: Array, default: [] }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Analysis = mongoose.model('Analysis', analysisSchema);
const SEOAudit = mongoose.model('SEOAudit', seoAuditSchema);
const KeywordResearch = mongoose.model('KeywordResearch', keywordResearchSchema);
const CompetitorAnalysis = mongoose.model('CompetitorAnalysis', competitorAnalysisSchema);
const ContentDraft = mongoose.model('ContentDraft', contentDraftSchema);

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
    profilePicture: userDoc.profilePicture || '',
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
    activeSessions: userDoc.activeSessions || [],
    apiKey: userDoc.apiKey || 'NEURAL_KEY_PENDING'
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
        timestamp: latestAudit.createdAt,
        // Authentic metrics for the 4 boxes
        issuesCount: latestAudit.audit?.issuesCount || 0,
        linkCount: latestAudit.elements?.linkCount || 0,
        wordCount: latestAudit.elements?.wordCount || 0,
        isEstimate: latestAudit.isEstimate || false
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
          // Market Estimates - Based on score to feel realistic but flagged as estimates
          rankingKeywords: auditResult.audit.indexedPages || Math.floor(500 + (auditResult.aggregate.averageScore * 10)),
          rankingKeywordsTrend: `+${Math.floor(2 + (auditResult.aggregate.averageScore / 20))}%`,
          totalBacklinks: auditResult.audit.mentions || Math.floor(200 + (auditResult.aggregate.averageScore * 5)),
          totalBacklinksTrend: `+${Math.floor(1 + (auditResult.aggregate.averageScore / 30))}%`,
          monthlyTraffic: auditResult.audit.indexedPages 
            ? `${(auditResult.audit.indexedPages / 50).toFixed(1)}K` 
            : `${(5 + (auditResult.aggregate.averageScore / 10)).toFixed(1)}K`,
          monthlyTrafficTrend: `+${Math.floor(5 + (auditResult.aggregate.averageScore / 15))}%`,
          scoreTrend: `+${Math.floor(1 + (auditResult.aggregate.averageScore / 50))}%`,
          isEstimate: true
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
          // Market Estimates (Regular Audit)
          rankingKeywords: auditResult.audit.indexedPages || Math.floor(200 + (auditResult.audit.score * 8)),
          rankingKeywordsTrend: `+${Math.floor(3 + (auditResult.audit.score / 25))}%`,
          totalBacklinks: auditResult.audit.mentions || Math.floor(100 + (auditResult.audit.score * 4)),
          totalBacklinksTrend: `+${Math.floor(2 + (auditResult.audit.score / 40))}%`,
          monthlyTraffic: auditResult.audit.indexedPages 
            ? `${(auditResult.audit.indexedPages / 30).toFixed(1)}K` 
            : `${(2 + (auditResult.audit.score / 15)).toFixed(1)}K`,
          monthlyTrafficTrend: `+${Math.floor(4 + (auditResult.audit.score / 20))}%`,
          scoreTrend: `+${Math.floor(1 + (auditResult.audit.score / 60))}%`,
          isEstimate: true
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

// Content Generation & Optimization via RAG Intelligence
app.post('/api/content/optimize', auth, keywordLimiter, async (req, res) => {
  try {
    const { text, keyword } = req.body;
    if (!text || !keyword) {
      return res.status(400).json({ message: 'Both text and target keyword are required.' });
    }

    console.log(`\n=== Content Generation/Optimization Request ===`);
    console.log(`Keyword: ${keyword}`);

    // 1. Fetch live competitor insights (RAG process)
    const webSearchService = require('./services/webSearchService');
    const competitors = await webSearchService.searchWebForCompetitors(keyword, 3);
    
    // 2. Deep Audit & Semantic Extraction
    const competitorAudits = await Promise.all(
      competitors.map(async (c) => {
        try {
          const audit = await seoAuditService.performSEOAudit(c.url, null);
          return audit.success ? { url: c.url, elements: audit.elements } : null;
        } catch (e) { return null; }
      })
    );
    const validCompetitors = competitorAudits.filter(c => c !== null);

    let suggestions = [];
    if (validCompetitors.length > 0) {
      suggestions = await keywordResearchService.performSemanticKeywordResearch(keyword, validCompetitors);
    } else {
      suggestions = await keywordResearchService.generateFallbackSuggestions(keyword);
    }

    // Filter valid keywords
    const topKeywords = suggestions
      .filter(s => !keywordResearchService.isJunkKeyword(s.keyword))
      .map(s => s.keyword)
      .slice(0, 3);

    // 3. Algorithmic Keyword Weaving
    // Simply inject these keywords naturally into the user's paragraph
    let optimizedText = text.trim();
    const injected = [];
    
    // Ensure the text ends with punctuation
    if (!/[.!?]$/.test(optimizedText)) {
      optimizedText += '.';
    }

    if (topKeywords.length > 0) {
      const templates = [
        ` Additionally, incorporating strategies around \${kw} has proven highly effective in this space.`,
        ` When exploring this topic, understanding the impact of \${kw} is crucial for comprehensive depth.`,
        ` Experts also recommend focusing on \${kw} to maximize your competitive advantage.`
      ];

      topKeywords.forEach((kw, index) => {
        // Only inject if not already present
        if (!optimizedText.toLowerCase().includes(kw.toLowerCase())) {
          const template = templates[index % templates.length].replace('${kw}', kw);
          optimizedText += template;
          injected.push(kw);
        }
      });
    }

    const payload = {
      optimizedText,
      injectedKeywords: injected,
      metadata: { source: 'rag-algorithmic-weaver' }
    };

    try {
      await ContentDraft.create({
        user: req.userId,
        targetKeyword: keyword,
        originalText: text,
        optimizedText: payload.optimizedText,
        injectedKeywords: payload.injectedKeywords
      });
    } catch (dbErr) {
      console.warn('Failed to save content draft to DB:', dbErr.message);
    }

    res.json(payload);
  } catch (err) {
    console.error('Content optimization error:', err);
    res.status(500).json({ message: 'Server error during content optimization' });
  }
});

// Keyword Research & Competitive Analysis (F5, F6, F7)
// Uses Sentence Transformer model for semantic analysis
// Keyword Research & Competitive Analysis (F5, F6, F7)
// Now with RAG: Fetches live SERP data and passes to AI Model for Expert Insight
app.post('/api/keywords/research', auth, keywordLimiter, async (req, res) => {
  try {
    const { baseKeyword, url } = req.body;
    const keyword = (baseKeyword || '').trim();
    if (!keyword) return res.status(400).json({ message: 'baseKeyword is required' });

    console.log(`\n=== RAG Keyword Research: "${keyword}" ===`);

    // 1. Fetch real-time competitors for this keyword
    const webSearchService = require('./services/webSearchService');
    const competitors = await webSearchService.searchWebForCompetitors(keyword, 3);
    console.log(`[RAG] Found ${competitors.length} live competitors.`);

    // 2. Deep Audit of top competitors
    const competitorAudits = await Promise.all(
      competitors.map(async (c) => {
        try {
          const audit = await seoAuditService.performSEOAudit(c.url, null);
          return audit.success ? { url: c.url, elements: audit.elements } : null;
        } catch (e) { return null; }
      })
    );
    const validCompetitors = competitorAudits.filter(c => c !== null);

    // 3. AI RAG Layer: Use the AI Model's Comparison engine to find high-value keyword clusters
    let aiStrategicKeywords = [];
    if (validCompetitors.length > 0) {
      try {
        console.log(`[RAG] Injecting Aggregated Competitor Context into AI Model for Gap Intelligence...`);
        
        // Aggregate top 3 competitors for richer, more stable context
        const top3 = validCompetitors.slice(0, 3);
        const aggTitle = top3.map(c => c.elements.title).join(' | ');
        const aggH1s = top3.flatMap(c => c.elements.h1Tags || []);
        const avgWordCount = Math.round(top3.reduce((sum, c) => sum + (c.elements.wordCount || 0), 0) / top3.length);
        const avgLinks = Math.round(top3.reduce((sum, c) => sum + (c.elements.linkCount || 0), 0) / top3.length);

        const aiResponse = await axios.post('http://localhost:5001/compare', {
          own: { 
            title: keyword, 
            h1Tags: [keyword],
            content_length: 0,
            num_internal_links: 0 
          },
          competitor: {
            title: aggTitle,
            h1Tags: aggH1s,
            content_length: avgWordCount,
            num_internal_links: avgLinks,
            domain_authority: 50 // Standard baseline
          }
        }, { timeout: 30000 });

        if (aiResponse.data.status === 'success') {
          const gap = aiResponse.data.comparison.content_gap;
          aiStrategicKeywords = gap.suggestions.map(s => {
            const intent = s.reason.includes('Strategic') ? 'commercial' : 'informational';
            const difficulty = 'Hard';
            const relevance = 98;
            return {
              keyword: s.use,
              type: 'ai-strategic',
              intent: intent,
              relevanceScore: relevance,
              trendScore: 85,
              estimatedDifficulty: difficulty,
              reason: s.reason,
              isFromCompetitors: true,
              occurrences: 1,
              strategy: `Implement AI-driven cluster for "${s.use}" to bridge the topical gap.`,
              actionPlan: 'Immediate Priority'
            };
          });
          console.log(`[RAG] AI generated ${aiStrategicKeywords.length} strategic keyword insights.`);
        }
      } catch (aiErr) {
        console.warn(`[RAG] AI Enhancement Layer offline: ${aiErr.message}`);
      }
    }

    // 4. Perform standard semantic analysis on all crawled competitor data
    let suggestions = [];
    if (validCompetitors.length > 0) {
      suggestions = await keywordResearchService.performSemanticKeywordResearch(keyword, validCompetitors);
    } else if (url) {
      suggestions = await keywordResearchService.performContextualResearch(keyword, url);
    } 

    if (suggestions.length === 0) {
      console.log(`[RAG] Strict semantic filtering resulted in 0 keywords. Falling back to patterns for: ${keyword}`);
      suggestions = await keywordResearchService.generateFallbackSuggestions(keyword);
    }

    // 5. Merge AI Strategic Keywords with Semantic suggestions
    const mergedResults = [...aiStrategicKeywords, ...suggestions]
      .filter((v, i, a) => a.findIndex(t => t.keyword === v.keyword) === i) // Unique check
      .filter(s => {
        // Use the hardened isJunkKeyword from the service instead of local array
        return !keywordResearchService.isJunkKeyword(s.keyword);
      })
      .slice(0, 50);

    const payload = {
      baseKeyword: keyword,
      targetUrl: url || null,
      suggestions: mergedResults,
      metadata: {
        totalSuggestions: mergedResults.length,
        competitorsCrawled: validCompetitors.length,
        aiEnhanced: aiStrategicKeywords.length > 0,
        source: 'rag-intelligence-engine'
      }
    };

    try {
      await KeywordResearch.create({
        user: req.userId,
        baseKeyword: payload.baseKeyword,
        targetUrl: payload.targetUrl,
        suggestions: payload.suggestions,
        metadata: payload.metadata
      });
    } catch (dbErr) {
      console.warn('Failed to save keyword research to DB:', dbErr.message);
    }

    res.json(payload);
  } catch (err) {
    console.error('Keyword research error:', err.message);
    res.status(500).json({ message: 'Server error during RAG keyword research' });
  }
});

// Competitor Comparison & Content Gap
app.post('/api/competitor/compare', auth, async (req, res) => {
  try {
    const { ownUrl, competitorUrl, ownHtml, compHtml } = req.body;
    if (!ownUrl || !competitorUrl) {
      return res.status(400).json({ message: 'Both Own URL and Competitor URL are required' });
    }

    if (ownUrl.trim().toLowerCase() === competitorUrl.trim().toLowerCase()) {
      return res.status(400).json({ message: 'Please enter a different URL for comparison. Comparing a site to itself provides no gap analysis.' });
    }

    console.log(`\n=== Competitor Comparison Request ===`);
    console.log(`Own: ${ownUrl} vs Comp: ${competitorUrl} (Manual HTML: ${!!ownHtml}/${!!compHtml})`);

    // Fetch and Analyze both
    const [ownResult, compResult] = await Promise.all([
      seoAuditService.performSEOAudit(ownUrl, ownHtml),
      seoAuditService.performSEOAudit(competitorUrl, compHtml)
    ]);

    if (!ownResult.success || !compResult.success) {
      // If our new heuristics caught dummy data/bot protection
      if (ownResult.blocked || compResult.blocked) {
        const blockMsg = ownResult.blocked ? ownResult.message : compResult.message;
        console.warn(`[API] Comparison aborted: ${blockMsg}`);
        return res.status(422).json({ message: blockMsg, blocked: true });
      }

      return res.status(400).json({ 
        message: 'Failed to analyze one or both websites',
        ownError: ownResult.error,
        compError: compResult.error
      });
    }

    // Call Python AI Model for Comparison with extended timeout
    const comparisonResponse = await axios.post('http://localhost:5001/compare', {
      own: {
        url: ownUrl,
        ...ownResult.elements,
        content_length: ownResult.elements.wordCount,
        num_internal_links: ownResult.elements.linkCount,
        domain_authority: 30,
      },
      competitor: {
        url: competitorUrl,
        ...compResult.elements,
        content_length: compResult.elements.wordCount,
        num_internal_links: compResult.elements.linkCount,
        domain_authority: 45,
      }
    }, { timeout: 45000 });

    if (comparisonResponse.data && comparisonResponse.data.status === 'success') {
      const payload = {
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
          elements: compResult.elements,
          isLikelyBlocked: compResult.elements.wordCount < 100 && compResult.elements.imageCount === 0
        },
        analysis: cleanAnalysis(comparisonResponse.data.comparison)
      };

      try {
        await CompetitorAnalysis.create({
          user: req.userId,
          ownUrl: ownUrl,
          competitorUrl: competitorUrl,
          own: payload.own,
          competitor: payload.competitor,
          analysis: payload.analysis
        });
      } catch (dbErr) {
        console.warn('Failed to save competitor analysis to DB:', dbErr.message);
      }

      return res.json(payload);
    }

    res.status(500).json({ message: 'Comparison model failed to respond correctly' });
  } catch (err) {
    console.error('Comparison error:', err.message);
    res.status(500).json({ message: 'Server error during comparison', error: err.message });
  }
});

function cleanAnalysis(analysis) {
  if (!analysis || !analysis.content_gap) return analysis;
  
  // Filter out suggestions that use placeholders
  const placeholders = ['generic content', 'filler text', 'unoptimized sections', 'placeholder'];
  analysis.content_gap.suggestions = analysis.content_gap.suggestions.filter(s => {
    const instead = s.instead_of.toLowerCase();
    return !placeholders.some(p => instead.includes(p));
  });
  
  return analysis;
}

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
      profilePicture,
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

    if (profilePicture !== undefined) {
      user.profilePicture = profilePicture || '';
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

// Rotate API Key
app.post('/api/user/rotate-api-key', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const newKey = 'nsk_' + crypto.randomBytes(24).toString('hex');
    user.apiKey = newKey;
    await user.save();
    
    res.json({ apiKey: newKey, message: 'API Key rotated successfully' });
  } catch (err) {
    console.error('Rotate API Key error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Terminate Session
app.delete('/api/user/sessions/:sessionId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    user.activeSessions = user.activeSessions.filter(s => s._id.toString() !== req.params.sessionId);
    await user.save();
    
    res.json({ message: 'Session terminated successfully', activeSessions: user.activeSessions });
  } catch (err) {
    console.error('Terminate session error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add Mock Payment Method
app.post('/api/user/payment-methods', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const randomLast4 = Math.floor(1000 + Math.random() * 9000);
    const mockMethod = {
      cardNumber: `•••• •••• •••• ${randomLast4}`,
      expiry: `12/202${Math.floor(6 + Math.random() * 4)}`,
      isDefault: user.billing.paymentMethods.length === 0
    };
    
    user.billing.paymentMethods.push(mockMethod);
    await user.save();
    
    res.json({ message: 'Payment method added successfully', paymentMethods: user.billing.paymentMethods });
  } catch (err) {
    console.error('Add payment method error:', err);
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

// Get user's Keyword Research history
app.get('/api/keywords/history', auth, async (req, res) => {
  try {
    const history = await KeywordResearch.find({ user: req.userId }).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ history });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's Competitor Analysis history
app.get('/api/competitor/history', auth, async (req, res) => {
  try {
    const history = await CompetitorAnalysis.find({ user: req.userId }).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ history });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's Content Draft history
app.get('/api/content/history', auth, async (req, res) => {
  try {
    const history = await ContentDraft.find({ user: req.userId }).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ history });
  } catch (err) {
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


