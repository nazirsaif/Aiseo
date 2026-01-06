const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
 
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'changeme_dev_secret';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seo_tool')
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
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
  issueType: { type: String, required: true }, // renamed from 'type' to avoid conflict
  category: { type: String, required: true },
  message: { type: String, required: true },
  impact: { type: String, required: true }
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
      recommendations: { type: [String], default: [] }
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
    }
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
    }
  };
}

app.post('/api/auth/register', async (req, res) => {
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

app.post('/api/auth/login', async (req, res) => {
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
    const [analysisCount, audits, avgScoreAgg] = await Promise.all([
      Analysis.countDocuments({ user: req.userId }),
      SEOAudit.find({ user: req.userId }).select('score audit.issuesCount').lean(),
      SEOAudit.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(req.userId) } },
        { $group: { _id: null, avgScore: { $avg: '$score' } } }
      ])
    ]);

    const totalAudits = audits.length;
    const totalIssues = audits.reduce((sum, a) => sum + (a.audit?.issuesCount || 0), 0);
    const avgScore = avgScoreAgg.length ? Math.round(avgScoreAgg[0].avgScore) : 0;

    res.json({
      keywordClusters: analysisCount,
      contentGaps: totalIssues,
      serpInsights: totalAudits,
      seoScore: avgScore
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
      difficulty: index % 3 === 0 ? 'Low' : index % 3 === 1 ? 'Medium' : 'High',
      performance: index % 3 === 0 ? 'Strong' : index % 3 === 1 ? 'Medium' : 'Weak',
      opportunity: index % 3 === 0 ? 'High' : index % 3 === 1 ? 'Medium' : 'Very High'
    }));

    res.json({ keywords: rows });
  } catch (err) {
    console.error('Dashboard keywords error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// SEO Audit Pipeline - Automated SEO analysis
const seoAuditService = require('./services/seoAuditService');
const keywordResearchService = require('./services/keywordResearchService');
const webSearchService = require('./services/webSearchService');

app.post('/api/seo-audit', auth, async (req, res) => {
  try {
    const { url, html, deepCrawl, maxDepth, maxPages } = req.body;

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
      
      let savedAudit;
      try {
        // Ensure we have valid data
        const pagesData = (auditResult.pages || []).map(page => ({
          url: page.url || '',
          depth: page.depth || 0,
          score: page.score || 0,
          grade: page.grade || 'F',
          issuesCount: page.issuesCount || 0
        }));

        const auditData = {
          user: req.userId,
          url: auditResult.startURL || url || 'Deep Crawl Audit',
          score: auditResult.aggregate.averageScore || 0,
          grade: auditResult.aggregate.grade || 'F',
          isDeepCrawl: true,
          elements: {
            // For deep crawl, we can store aggregate or first page data
            title: auditResult.pages.length > 0 && auditResult.detailedPages?.[0]?.elements?.title || 'Deep Crawl Audit',
            metaDescription: auditResult.pages.length > 0 && auditResult.detailedPages?.[0]?.elements?.metaDescription || '',
            h1Count: 0,
            h1Tags: [],
            h2Count: 0,
            imageCount: 0,
            imagesWithoutAlt: 0,
            linkCount: 0,
            wordCount: 0,
            hasOpenGraph: false,
            hasTwitterCard: false
          },
          audit: {
            issuesCount: auditResult.aggregate.totalIssues || 0,
            issues: (auditResult.aggregate.topIssues || []).slice(0, 20).map(issue => ({
              issueType: issue.type || 'info',
              category: issue.category || 'general',
              message: issue.message || '',
              impact: issue.impact || 'Low'
            })),
            recommendationsCount: auditResult.aggregate.totalRecommendations || 0,
            recommendations: auditResult.aggregate.recommendations || []
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
          }
        };
        
        console.log('Creating deep crawl audit record with data:', JSON.stringify(auditData, null, 2));
        savedAudit = await SEOAudit.create(auditData);
        console.log('✅ Deep crawl audit saved successfully!');
        console.log('Saved ID:', savedAudit._id);
        console.log('Saved URL:', savedAudit.url);
        console.log('Saved Score:', savedAudit.score);
        console.log('Pages Crawled:', savedAudit.crawlStats?.pagesCrawled);
        console.log('Is Deep Crawl:', savedAudit.isDeepCrawl);
      } catch (dbError) {
        console.error('❌ Database save error:', dbError);
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

    // Save audit result to database (regular single page audit)
    console.log('Saving audit to database...');
    console.log('User ID:', req.userId);
    console.log('Audit data:', {
      score: auditResult.audit.score,
      grade: auditResult.audit.grade,
      hasElements: !!auditResult.elements,
      hasAudit: !!auditResult.audit
    });
    
    let savedAudit;
    try {
      const auditData = {
        user: req.userId,
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
          issuesCount: auditResult.audit.issuesCount || 0,
          issues: (auditResult.audit.issues || []).map(issue => ({
            issueType: issue.type, // map 'type' to 'issueType' to avoid Mongoose conflict
            category: issue.category,
            message: issue.message,
            impact: issue.impact
          })),
          recommendationsCount: auditResult.audit.recommendationsCount || 0,
          recommendations: auditResult.audit.recommendations || []
        }
      };
      
      console.log('Creating audit record...');
      savedAudit = await SEOAudit.create(auditData);
      console.log('✅ Audit saved successfully! ID:', savedAudit._id);
      console.log('Saved URL:', savedAudit.url);
      console.log('Saved Score:', savedAudit.score);
    } catch (dbError) {
      console.error('❌ Database save error:', dbError);
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
app.post('/api/keywords/research', auth, async (req, res) => {
  try {
    const { baseKeyword, competitorUrls, filters } = req.body;

    const keyword = (baseKeyword || '').trim();
    if (!keyword) {
      return res.status(400).json({ message: 'baseKeyword is required' });
    }

    console.log(`\n=== Keyword Research Request ===`);
    console.log(`Base Keyword: "${keyword}"`);
    console.log(`Competitor URLs provided: ${competitorUrls?.length || 0}`);

    // Collect competitor results from multiple sources
    const competitorResults = [];

    // 1) REAL-TIME WEB SEARCH: Find actual competitors ranking for this keyword
    console.log(`\n🔍 Step 1: Searching web for real competitors ranking for "${keyword}"...`);
    let webSearchResults = [];
    try {
      webSearchResults = await webSearchService.searchWebForCompetitors(keyword, 8);
      console.log(`✅ Found ${webSearchResults.length} competitors from web search`);
    } catch (webSearchError) {
      console.error('❌ Web search failed:', webSearchError.message);
      console.log('Will try provided URLs or fallback to saved audits...');
    }

    // 2) Analyze real competitors from web search in real-time
    if (webSearchResults.length > 0) {
      console.log(`\n📊 Step 2: Analyzing ${webSearchResults.length} real competitors in real-time...`);
      for (const searchResult of webSearchResults) {
        try {
          console.log(`  Analyzing: ${searchResult.url}`);
          const result = await seoAuditService.performSEOAudit(searchResult.url, null);
          if (result && result.success) {
            competitorResults.push({
              ...result,
              elements: {
                ...result.elements,
                h2Tags: result.elements?.h2Tags || [],
                // Preserve original search title if available
                searchTitle: searchResult.title
              },
              searchRank: searchResult.rank
            });
            console.log(`  ✅ Successfully analyzed: ${searchResult.title || searchResult.url}`);
          }
        } catch (err) {
          console.error(`  ❌ Error analyzing ${searchResult.url}:`, err.message);
          // Even if analysis fails, add basic info
          competitorResults.push({
            success: true,
            url: searchResult.url,
            elements: {
              title: searchResult.title || searchResult.url,
              metaDescription: '',
              h1Tags: [],
              h2Tags: [],
              wordCount: 0
            },
            audit: {
              score: 0,
              grade: 'N/A'
            },
            searchRank: searchResult.rank
          });
        }
      }
      console.log(`✅ Analyzed ${competitorResults.length} real competitors from web`);
    }

    // 3) User-provided competitor URLs (if any)
    const urls = Array.isArray(competitorUrls)
      ? competitorUrls.filter((u) => typeof u === 'string' && u.trim() !== '').slice(0, 5)
      : [];

    for (const url of urls) {
      // Skip if already analyzed from web search
      if (competitorResults.some(c => c.url === url)) {
        console.log(`Skipping ${url} - already analyzed from web search`);
        continue;
      }
      
      try {
        console.log(`Analyzing user-provided competitor URL: ${url}`);
        const result = await seoAuditService.performSEOAudit(url, null);
        if (result && result.success) {
          competitorResults.push({
            ...result,
            elements: {
              ...result.elements,
              h2Tags: result.elements?.h2Tags || []
            }
          });
          console.log(`✅ Successfully analyzed: ${url}`);
        }
      } catch (err) {
        console.error(`❌ Error analyzing ${url}:`, err.message);
      }
    }

    // 4) FALLBACK: Use existing audit data ONLY if no real competitors found
    // This should rarely happen now that we have real-time web search
    if (competitorResults.length === 0) {
      console.log('⚠️ No real competitors found from web search, falling back to saved audit data...');
      console.log('Note: This means web search failed. Results may not be keyword-relevant.');
      
      const keywordLower = keyword.toLowerCase();
      const keywordWords = keywordLower.split(/\s+/).filter(w => w.length > 2); // Filter out short words
      
      // Strategy 1: Try to find audits relevant to the keyword
      let relevantAudits = [];
      if (keywordWords.length > 0) {
        const keywordRegex = keywordWords.map(w => `(?=.*${w})`).join('');
        relevantAudits = await SEOAudit.find({ 
          user: req.userId,
          $or: [
            { 'elements.title': { $regex: keywordLower, $options: 'i' } },
            { 'elements.metaDescription': { $regex: keywordLower, $options: 'i' } },
            { url: { $regex: keywordWords[0], $options: 'i' } }
          ]
        })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean();
        console.log(`Found ${relevantAudits.length} keyword-relevant audits`);
      }
      
      // Strategy 2: Get diverse audits (mix of recent and older, different URLs)
      const allRecentAudits = await SEOAudit.find({ user: req.userId })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();
      
      // Remove duplicates by URL and get unique ones
      const uniqueAuditsMap = new Map();
      allRecentAudits.forEach(audit => {
        if (!uniqueAuditsMap.has(audit.url) && audit.url) {
          uniqueAuditsMap.set(audit.url, audit);
        }
      });
      
      const uniqueAudits = Array.from(uniqueAuditsMap.values());
      
      // Combine relevant audits with diverse unique audits
      const usedUrls = new Set(relevantAudits.map(a => a.url));
      const additionalAudits = uniqueAudits
        .filter(a => !usedUrls.has(a.url))
        .slice(0, 5);
      
      // Shuffle to add randomness
      const shuffled = additionalAudits.sort(() => Math.random() - 0.5);
      const auditsToUse = [...relevantAudits, ...shuffled].slice(0, 8); // Max 8 competitors
      
      // If still not enough, get any audits
      if (auditsToUse.length === 0) {
        const fallbackAudits = await SEOAudit.find({ user: req.userId })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean();
        auditsToUse.push(...fallbackAudits);
      }

      auditsToUse.forEach((audit) => {
        competitorResults.push({
          success: true,
          url: audit.url,
          elements: {
            title: audit.elements?.title || '',
            metaDescription: audit.elements?.metaDescription || '',
            h1Tags: audit.elements?.h1Tags || [],
            h2Tags: [], // h2Tags not stored in schema, but we can extract from saved data if needed
            wordCount: audit.elements?.wordCount || 0
          },
          audit: {
            score: audit.score || 0,
            grade: audit.grade || 'N/A'
          }
        });
      });
      console.log(`Found ${auditsToUse.length} diverse saved audits to use as competitor data`);
    } else {
      // Even if we have live URLs, add some saved audits for diversity
      console.log('Adding saved audits for additional diversity...');
      const usedUrls = new Set(competitorResults.map(c => c.url));
      const additionalAudits = await SEOAudit.find({ 
        user: req.userId,
        url: { $nin: Array.from(usedUrls) }
      })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();

      additionalAudits.forEach((audit) => {
        competitorResults.push({
          success: true,
          url: audit.url,
          elements: {
            title: audit.elements?.title || '',
            metaDescription: audit.elements?.metaDescription || '',
            h1Tags: audit.elements?.h1Tags || [],
            h2Tags: [],
            wordCount: audit.elements?.wordCount || 0
          },
          audit: {
            score: audit.score || 0,
            grade: audit.grade || 'N/A'
          }
        });
      });
      console.log(`Added ${additionalAudits.length} additional saved audits`);
    }

    // Perform semantic keyword research using Sentence Transformer
    let suggestions = [];
    
    if (competitorResults.length > 0) {
      console.log(`\n=== Performing Semantic Analysis ===`);
      console.log(`Using ${competitorResults.length} competitor sources`);
      
      try {
        suggestions = await keywordResearchService.performSemanticKeywordResearch(
          keyword,
          competitorResults
        );
        console.log(`✅ Generated ${suggestions.length} semantic keyword suggestions`);
      } catch (semanticError) {
        console.error('Semantic analysis error:', semanticError);
        console.log('Falling back to pattern-based suggestions...');
        // Fallback to basic pattern matching if semantic analysis fails
        suggestions = await keywordResearchService.generateFallbackSuggestions(keyword);
      }
    } else {
      console.log('No competitor data available, generating fallback suggestions...');
      suggestions = await keywordResearchService.generateFallbackSuggestions(keyword);
    }

    // Build competitor summary with enhanced metrics (F6)
    const countKeyword = (text) => {
      if (!text) return 0;
      const lowered = String(text).toLowerCase();
      const kw = keyword.toLowerCase();
      return (lowered.match(new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'g')) || []).length;
    };

    const competitors = competitorResults.map((comp) => {
      const el = comp.elements || {};
      const textBlocks = [
        el.title || el.searchTitle || '',
        el.metaDescription || '',
        ...(el.h1Tags || []),
        ...(el.h2Tags || [])
      ].join(' ');

      const occurrences = countKeyword(textBlocks);
      const density = el.wordCount ? (occurrences / el.wordCount) * 100 : 0;

      return {
        url: comp.url,
        title: el.title || el.searchTitle || comp.url,
        h1Tags: el.h1Tags || [],
        h2Tags: el.h2Tags || [],
        wordCount: el.wordCount || 0,
        keywordDensity: Number.isFinite(density) ? Number(density.toFixed(2)) : 0,
        grade: comp.audit?.grade || 'N/A',
        score: comp.audit?.score || 0,
        searchRank: comp.searchRank || null, // Show ranking position from search
        isRealTime: !!comp.searchRank // Flag to indicate this is from real-time search
      };
    });

    // Apply filters if provided (F7)
    if (filters) {
      const { minRelevance, minVolume, difficulty } = filters;
      
      suggestions = suggestions.filter((s) => {
        if (minRelevance !== undefined && s.relevanceScore < minRelevance) {
          return false;
        }
        if (minVolume !== undefined && s.estimatedSearchVolume < minVolume) {
          return false;
        }
        if (difficulty && difficulty !== 'all' && s.estimatedDifficulty !== difficulty) {
          return false;
        }
        return true;
      });
      
      console.log(`Applied filters: ${suggestions.length} suggestions remaining`);
    }

    // Limit to top 50 suggestions
    suggestions = suggestions.slice(0, 50);

    console.log(`\n=== Keyword Research Complete ===`);
    console.log(`Base Keyword: "${keyword}"`);
    console.log(`Suggestions: ${suggestions.length}`);
    console.log(`Competitors: ${competitors.length}`);
    console.log(`Real-time competitors: ${competitors.filter(c => c.isRealTime).length}`);

    const realTimeCount = competitors.filter(c => c.isRealTime).length;
    
    res.json({
      baseKeyword: keyword,
      suggestions,
      competitors,
      metadata: {
        totalSuggestions: suggestions.length,
        totalCompetitors: competitors.length,
        semanticAnalysis: competitorResults.length > 0,
        realTimeCompetitors: realTimeCount,
        dataSource: realTimeCount > 0 
          ? 'real-time-web-search' 
          : 'saved-audits-fallback'
      }
    });
  } catch (err) {
    console.error('=== Keyword Research Error ===');
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    res.status(500).json({ 
      message: 'Server error during keyword research',
      error: err.message || 'Unknown error'
    });
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
      settings
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
    const audits = await SEOAudit.find({ user: req.userId })
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
    const audits = await SEOAudit.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-__v')
      .lean(); // Use lean() for better performance

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
    const audit = await SEOAudit.findOne({
      _id: req.params.id,
      user: req.userId
    }).select('-__v').lean();

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
          impact: issue.impact
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


