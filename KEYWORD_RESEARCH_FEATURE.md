# Keyword Research Feature - Advanced Implementation

## Overview

The Keyword Research feature has been upgraded to use **Sentence Transformer models** for semantic analysis, providing more accurate and diverse keyword suggestions based on meaning rather than just pattern matching.

## Features Implemented

### F5: Keyword Suggestion (Semantic Analysis)
- ✅ Uses Sentence Transformer model (`Xenova/all-MiniLM-L6-v2`) for semantic similarity
- ✅ Generates embeddings for base keyword and potential phrases
- ✅ Calculates cosine similarity to find semantically related keywords
- ✅ Extracts long-tail keywords from competitor content
- ✅ Provides relevance scores based on semantic similarity (0-100)

### F6: Competition Data Display
- ✅ Displays key metrics from competitor websites:
  - Title tags
  - H1 and H2 headings
  - Keyword density (percentage)
  - Word count
  - SEO score and grade
- ✅ Uses crawler's data (saved audits) as competitor sources
- ✅ Supports live competitor URL analysis (optional)

### F7: Keyword Filtering
- ✅ Filter by relevance score (minimum threshold)
- ✅ Filter by estimated search volume (minimum threshold)
- ✅ Filter by difficulty level (Easy, Medium, Hard)
- ✅ Backend filtering support (can be extended to frontend)

## How It Works

### 1. Data Collection
The system collects competitor data from two sources:
- **Live Competitor URLs** (if provided): Analyzes competitor websites in real-time
- **Saved Audit Data**: Uses previously crawled websites from the user's audit history

### 2. Semantic Analysis Process
1. **Model Initialization**: Loads the Sentence Transformer model (first time may take a few minutes to download)
2. **Embedding Generation**: Creates semantic embeddings for:
   - Base keyword
   - Extracted phrases from competitor content
   - Common long-tail patterns
3. **Similarity Calculation**: Computes cosine similarity between base keyword and potential phrases
4. **Keyword Ranking**: Sorts suggestions by relevance score (semantic similarity)

### 3. Keyword Extraction
- Extracts 2-5 word phrases containing the base keyword
- Analyzes competitor titles, meta descriptions, H1, and H2 tags
- Generates common long-tail patterns (e.g., "best [keyword]", "[keyword] guide")
- Uses semantic similarity to filter relevant suggestions (minimum 0.3 similarity)

### 4. Metrics Calculation
- **Relevance Score**: Based on semantic similarity (0-100)
- **Estimated Search Volume**: Calculated based on keyword length and relevance
- **Estimated Difficulty**: Based on competitor count, keyword length, and relevance
- **Competitor Count**: Number of competitors using the keyword

## API Endpoint

### POST `/api/keywords/research`

**Request Body:**
```json
{
  "baseKeyword": "seo tools",
  "competitorUrls": ["https://example.com"], // Optional
  "filters": { // Optional
    "minRelevance": 50,
    "minVolume": 500,
    "difficulty": "Medium"
  }
}
```

**Response:**
```json
{
  "baseKeyword": "seo tools",
  "suggestions": [
    {
      "keyword": "best seo tools",
      "type": "long-tail",
      "relevanceScore": 85,
      "estimatedSearchVolume": 2500,
      "estimatedDifficulty": "Medium",
      "competitorCount": 3,
      "occurrences": 5,
      "sources": [...]
    }
  ],
  "competitors": [
    {
      "url": "https://example.com",
      "title": "SEO Tools Guide",
      "h1Tags": ["Best SEO Tools"],
      "h2Tags": ["Free Tools", "Paid Tools"],
      "wordCount": 1200,
      "keywordDensity": 2.5,
      "grade": "A",
      "score": 85
    }
  ],
  "metadata": {
    "totalSuggestions": 25,
    "totalCompetitors": 3,
    "semanticAnalysis": true
  }
}
```

## Why Results Are Now Diverse

### Previous Issues:
1. **Pattern Matching**: Used simple text matching, always generating the same patterns
2. **Deterministic**: Same input always produced same output
3. **Limited Extraction**: Only looked for exact keyword matches

### Current Solution:
1. **Semantic Analysis**: Uses meaning-based similarity, not just text matching
2. **Dynamic Extraction**: Analyzes actual competitor content for unique phrases
3. **Context-Aware**: Considers semantic relationships between words
4. **Diverse Sources**: Uses multiple competitor sources for varied suggestions

## Performance Notes

- **First Request**: May take 1-2 minutes to download the model (one-time)
- **Subsequent Requests**: Fast (model cached in memory)
- **Model Size**: ~90MB (automatically downloaded and cached)
- **Memory Usage**: Model stays in memory for fast subsequent requests

## Troubleshooting

### Model Download Issues
If the model fails to download:
- Check internet connection
- Ensure sufficient disk space (~100MB)
- Check firewall settings

### Slow First Request
- Normal behavior - model downloads on first use
- Subsequent requests will be much faster

### Same Results Still Appearing
- Ensure you have diverse competitor data (run audits on different websites)
- Try different base keywords
- The semantic analysis will still provide better relevance even with same competitors

## Future Enhancements

Potential improvements:
- Cache embeddings for common keywords
- Support for multiple languages
- Integration with real search volume APIs
- Machine learning-based difficulty prediction
- Keyword clustering and grouping

