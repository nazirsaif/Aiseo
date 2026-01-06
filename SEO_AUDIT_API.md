# SEO Audit Pipeline API Documentation

## Overview

The SEO Audit Pipeline is an automated SEO analysis system that performs rule-based checks on web pages. It analyzes URLs or HTML content and provides detailed SEO scores, issues, and recommendations.

**Current Status**: Rule-based implementation  
**Future Enhancement**: ML-based scoring using Hugging Face models

## API Endpoints

### 1. Perform SEO Audit

**POST** `/api/seo-audit`

Performs an automated SEO audit on a URL or HTML content.

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "url": "https://example.com",
  "html": "<html>...</html>"  // Optional, if URL is provided
}
```

**Note**: Either `url` OR `html` must be provided.

**Response** (Success - 201):
```json
{
  "message": "SEO audit completed successfully",
  "auditId": "507f1f77bcf86cd799439011",
  "result": {
    "success": true,
    "url": "https://example.com",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "elements": {
      "title": "Example Page Title",
      "metaDescription": "Example meta description",
      "h1Count": 1,
      "h1Tags": ["Main Heading"],
      "h2Count": 3,
      "imageCount": 5,
      "imagesWithoutAlt": 2,
      "linkCount": 12,
      "wordCount": 450,
      "hasOpenGraph": true,
      "hasTwitterCard": false
    },
    "audit": {
      "score": 78,
      "grade": "C",
      "issuesCount": 4,
      "issues": [
        {
          "type": "warning",
          "category": "images",
          "message": "2 image(s) missing alt text",
          "impact": "Medium"
        }
      ],
      "recommendationsCount": 3,
      "recommendations": [
        "Add alt text to 2 image(s) for accessibility and SEO",
        "Add Twitter Card meta tags for better Twitter sharing"
      ]
    }
  }
}
```

**Response** (Error - 400):
```json
{
  "message": "Either URL or HTML content is required"
}
```

---

### 2. Get User's Audit History

**GET** `/api/seo-audit`

Retrieves the authenticated user's SEO audit history (last 50 audits).

**Authentication**: Required (Bearer token)

**Response** (200):
```json
{
  "count": 5,
  "audits": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "user": "507f191e810c19729de860ea",
      "url": "https://example.com",
      "score": 78,
      "grade": "C",
      "elements": { ... },
      "audit": { ... },
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 3. Get Specific Audit

**GET** `/api/seo-audit/:id`

Retrieves a specific audit by ID (only if it belongs to the authenticated user).

**Authentication**: Required (Bearer token)

**Response** (200):
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "user": "507f191e810c19729de860ea",
  "url": "https://example.com",
  "score": 78,
  "grade": "C",
  "elements": { ... },
  "audit": { ... },
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Response** (404):
```json
{
  "message": "Audit not found"
}
```

---

## SEO Checks Performed

### 1. Title Tag
- **Missing**: Critical issue (-15 points)
- **Too short** (<30 chars): Warning (-5 points)
- **Too long** (>60 chars): Warning (-3 points)
- **Optimal**: 50-60 characters

### 2. Meta Description
- **Missing**: Critical issue (-10 points)
- **Too short** (<120 chars): Warning (-3 points)
- **Too long** (>160 chars): Warning (-2 points)
- **Optimal**: 150-160 characters

### 3. H1 Tags
- **Missing**: Critical issue (-10 points)
- **Multiple H1s**: Warning (-5 points)
- **Optimal**: Exactly one H1 tag

### 4. H2 Tags
- **Missing**: Info (-2 points)
- **Optimal**: At least one H2 tag

### 5. Images
- **Missing alt text**: Warning (-2 points per image, max -10)
- **Optimal**: All images have descriptive alt text

### 6. Content Length
- **Low word count** (<300 words): Warning (-5 points)
- **Optimal**: 300+ words

### 7. Open Graph Tags
- **Missing**: Info (-3 points)
- **Optimal**: Present for social sharing

### 8. Twitter Card Tags
- **Missing**: Info (-2 points)
- **Optimal**: Present for Twitter sharing

## Scoring System

- **Score Range**: 0-100
- **Grade A**: 90-100
- **Grade B**: 80-89
- **Grade C**: 70-79
- **Grade D**: 60-69
- **Grade F**: 0-59

## Issue Types

- **critical**: High impact, must fix
- **warning**: Medium impact, should fix
- **info**: Low impact, nice to have

## Example Usage

### Using cURL:

```bash
# Perform audit on URL
curl -X POST http://localhost:5000/api/seo-audit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"url": "https://example.com"}'

# Perform audit on HTML content
curl -X POST http://localhost:5000/api/seo-audit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"html": "<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>"}'
```

### Using JavaScript (React):

```javascript
const performAudit = async (url) => {
  const response = await fetch('http://localhost:5000/api/seo-audit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ url })
  });
  
  const data = await response.json();
  return data;
};
```

## Future Enhancements

1. **ML-based Scoring**: Integrate Hugging Face models for more accurate SEO scoring
2. **Page Speed Analysis**: Add Core Web Vitals checks
3. **Mobile-Friendliness**: Check responsive design and mobile usability
4. **Schema Markup**: Detect and validate structured data
5. **Backlink Analysis**: Analyze external links and their quality
6. **Competitor Comparison**: Compare SEO metrics with competitors

## Database Schema

**Collection**: `seoaudits`

```javascript
{
  user: ObjectId,           // Reference to User
  url: String,              // Audited URL
  score: Number,             // SEO score (0-100)
  grade: String,             // Grade (A-F)
  elements: {
    title: String,
    metaDescription: String,
    h1Count: Number,
    h1Tags: [String],
    h2Count: Number,
    imageCount: Number,
    imagesWithoutAlt: Number,
    linkCount: Number,
    wordCount: Number,
    hasOpenGraph: Boolean,
    hasTwitterCard: Boolean
  },
  audit: {
    issuesCount: Number,
    issues: [{
      type: String,
      category: String,
      message: String,
      impact: String
    }],
    recommendationsCount: Number,
    recommendations: [String]
  },
  createdAt: Date,
  updatedAt: Date
}
```

