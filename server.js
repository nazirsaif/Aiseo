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
      user: { id: user._id, name: user.name, email: user.email, company: user.company },
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
      user: { id: user._id, name: user.name, email: user.email, company: user.company },
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

// SEO Audit Pipeline - Automated SEO analysis
const seoAuditService = require('./services/seoAuditService');

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


