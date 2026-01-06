const { pipeline } = require('@xenova/transformers');

// Initialize the Sentence Transformer model (lazy loading)
let embeddingModel = null;
let modelLoading = false;

/**
 * Initialize the Sentence Transformer model
 * Uses a lightweight model suitable for semantic similarity
 */
async function initializeModel() {
  if (embeddingModel) return embeddingModel;
  if (modelLoading) {
    // Wait for ongoing loading
    while (modelLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return embeddingModel;
  }

  try {
    modelLoading = true;
    console.log('Loading Sentence Transformer model...');
    console.log('Note: First-time download may take a few minutes. Model will be cached for future use.');
    // Using a lightweight multilingual model for semantic similarity
    embeddingModel = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2' // Lightweight, fast, good for semantic similarity
    );
    console.log('✅ Sentence Transformer model loaded successfully');
    modelLoading = false;
    return embeddingModel;
  } catch (error) {
    console.error('Error loading Sentence Transformer model:', error);
    console.error('This may be due to network issues or insufficient disk space.');
    modelLoading = false;
    throw error;
  }
}

/**
 * Generate embeddings for text using Sentence Transformer
 */
async function generateEmbedding(text) {
  try {
    const model = await initializeModel();
    const output = await model(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two embeddings
 */
function cosineSimilarity(embedding1, embedding2) {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Extract keywords and phrases from text using semantic analysis
 */
function extractPhrases(text, baseKeyword) {
  if (!text || !baseKeyword) return [];

  const baseKeywordLower = baseKeyword.toLowerCase();
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const phrases = new Set();
  
  // Extract 2-5 word phrases containing the base keyword
  for (let i = 0; i < words.length; i++) {
    if (words[i] === baseKeywordLower || words.slice(i, i + baseKeywordLower.split(' ').length).join(' ') === baseKeywordLower) {
      // Extract phrases before, containing, and after the keyword
      for (let start = Math.max(0, i - 2); start <= i; start++) {
        for (let end = i + baseKeywordLower.split(' ').length; end <= Math.min(words.length, start + 6); end++) {
          if (end - start >= 2 && end - start <= 5) {
            const phrase = words.slice(start, end).join(' ');
            if (phrase.includes(baseKeywordLower) && phrase !== baseKeywordLower) {
              phrases.add(phrase);
            }
          }
        }
      }
    }
  }

  // Also extract common long-tail patterns
  const commonPatterns = [
    `best ${baseKeywordLower}`,
    `${baseKeywordLower} guide`,
    `${baseKeywordLower} tips`,
    `${baseKeywordLower} tools`,
    `how to ${baseKeywordLower}`,
    `${baseKeywordLower} for beginners`,
    `${baseKeywordLower} strategies`,
    `free ${baseKeywordLower}`,
    `${baseKeywordLower} examples`,
    `${baseKeywordLower} tutorial`,
    `what is ${baseKeywordLower}`,
    `${baseKeywordLower} review`,
    `${baseKeywordLower} comparison`,
    `${baseKeywordLower} vs`,
    `top ${baseKeywordLower}`,
    `${baseKeywordLower} software`,
    `${baseKeywordLower} course`,
    `${baseKeywordLower} training`,
    `${baseKeywordLower} checklist`,
    `${baseKeywordLower} template`
  ];

  commonPatterns.forEach(pattern => phrases.add(pattern));

  return Array.from(phrases);
}

/**
 * Calculate estimated search volume based on keyword characteristics
 */
function estimateSearchVolume(keyword, baseKeyword, relevanceScore) {
  const wordCount = keyword.split(' ').length;
  const baseWordCount = baseKeyword.split(' ').length;
  
  // Longer keywords typically have lower search volume
  let volume = 1000;
  
  // Adjust based on length
  if (wordCount === 2) volume = 5000;
  else if (wordCount === 3) volume = 2000;
  else if (wordCount === 4) volume = 800;
  else volume = 300;
  
  // Adjust based on relevance
  volume = Math.round(volume * (relevanceScore / 100));
  
  // Ensure minimum volume
  return Math.max(100, volume);
}

/**
 * Calculate estimated difficulty based on competitor count and keyword characteristics
 */
function estimateDifficulty(competitorCount, keywordLength, relevanceScore) {
  // More competitors = harder
  if (competitorCount >= 5) return 'Hard';
  if (competitorCount >= 3) return 'Medium';
  
  // Longer keywords = easier (long-tail)
  if (keywordLength >= 4) return 'Easy';
  if (keywordLength === 3) return 'Medium';
  
  // High relevance with many competitors = hard
  if (relevanceScore >= 80 && competitorCount >= 2) return 'Hard';
  
  return 'Easy';
}

/**
 * Perform semantic keyword research using Sentence Transformer
 */
async function performSemanticKeywordResearch(baseKeyword, competitorData) {
  try {
    console.log(`Starting semantic keyword research for: "${baseKeyword}"`);
    
    // Generate embedding for base keyword
    const baseEmbedding = await generateEmbedding(baseKeyword);
    console.log('✅ Base keyword embedding generated');

    // Extract all potential phrases from competitor data
    const allPhrases = new Map();
    
    competitorData.forEach((competitor, index) => {
      const textBlocks = [
        competitor.elements?.title || '',
        competitor.elements?.metaDescription || '',
        ...(competitor.elements?.h1Tags || []),
        ...(competitor.elements?.h2Tags || [])
      ].join(' ');

      const phrases = extractPhrases(textBlocks, baseKeyword);
      
      phrases.forEach(phrase => {
        if (!allPhrases.has(phrase)) {
          allPhrases.set(phrase, {
            keyword: phrase,
            occurrences: 0,
            competitors: new Set(),
            sources: []
          });
        }
        const entry = allPhrases.get(phrase);
        entry.occurrences += 1;
        entry.competitors.add(competitor.url || `competitor-${index}`);
        entry.sources.push({
          url: competitor.url,
          title: competitor.elements?.title || ''
        });
      });
    });

    console.log(`Found ${allPhrases.size} potential keyword phrases`);

    // Calculate semantic similarity for each phrase
    const keywordSuggestions = [];
    const phraseArray = Array.from(allPhrases.keys());
    
    // Process in batches to avoid memory issues
    const batchSize = 10;
    for (let i = 0; i < phraseArray.length; i += batchSize) {
      const batch = phraseArray.slice(i, i + batchSize);
      const embeddings = await Promise.all(
        batch.map(phrase => generateEmbedding(phrase))
      );

      batch.forEach((phrase, batchIndex) => {
        const embedding = embeddings[batchIndex];
        const similarity = cosineSimilarity(baseEmbedding, embedding);
        const relevanceScore = Math.round(similarity * 100);
        
        // Only include phrases with reasonable similarity (>= 0.3)
        if (similarity >= 0.3) {
          const phraseData = allPhrases.get(phrase);
          keywordSuggestions.push({
            keyword: phrase,
            type: phrase.split(' ').length >= 3 ? 'long-tail' : 'short-tail',
            relevanceScore: Math.max(30, relevanceScore), // Minimum 30 for relevance
            estimatedSearchVolume: estimateSearchVolume(phrase, baseKeyword, relevanceScore),
            estimatedDifficulty: estimateDifficulty(
              phraseData.competitors.size,
              phrase.split(' ').length,
              relevanceScore
            ),
            competitorCount: phraseData.competitors.size,
            occurrences: phraseData.occurrences,
            sources: phraseData.sources.slice(0, 3) // Limit sources
          });
        }
      });
    }

    // Sort by relevance score (descending)
    keywordSuggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

    console.log(`✅ Generated ${keywordSuggestions.length} semantically relevant keyword suggestions`);
    
    return keywordSuggestions;
  } catch (error) {
    console.error('Error in semantic keyword research:', error);
    throw error;
  }
}

/**
 * Generate fallback keyword suggestions when no competitor data is available
 */
async function generateFallbackSuggestions(baseKeyword) {
  try {
    console.log('Generating fallback suggestions using semantic analysis...');
    
    const baseEmbedding = await generateEmbedding(baseKeyword);
    
    // Generate common long-tail patterns
    const patterns = [
      `best ${baseKeyword}`,
      `${baseKeyword} guide`,
      `${baseKeyword} tips`,
      `${baseKeyword} tools`,
      `how to ${baseKeyword}`,
      `${baseKeyword} for beginners`,
      `${baseKeyword} strategies`,
      `free ${baseKeyword}`,
      `${baseKeyword} examples`,
      `${baseKeyword} tutorial`,
      `what is ${baseKeyword}`,
      `${baseKeyword} review`,
      `${baseKeyword} comparison`,
      `${baseKeyword} vs`,
      `top ${baseKeyword}`,
      `${baseKeyword} software`,
      `${baseKeyword} course`,
      `${baseKeyword} training`,
      `${baseKeyword} checklist`,
      `${baseKeyword} template`,
      `${baseKeyword} benefits`,
      `${baseKeyword} features`,
      `${baseKeyword} pricing`,
      `${baseKeyword} alternatives`,
      `${baseKeyword} best practices`
    ];

    const suggestions = [];
    
    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < patterns.length; i += batchSize) {
      const batch = patterns.slice(i, i + batchSize);
      const embeddings = await Promise.all(
        batch.map(pattern => generateEmbedding(pattern))
      );

      batch.forEach((pattern, batchIndex) => {
        const embedding = embeddings[batchIndex];
        const similarity = cosineSimilarity(baseEmbedding, embedding);
        const relevanceScore = Math.round(similarity * 100);

        suggestions.push({
          keyword: pattern,
          type: pattern.split(' ').length >= 3 ? 'long-tail' : 'short-tail',
          relevanceScore: Math.max(50, relevanceScore),
          estimatedSearchVolume: estimateSearchVolume(pattern, baseKeyword, relevanceScore),
          estimatedDifficulty: estimateDifficulty(0, pattern.split(' ').length, relevanceScore),
          competitorCount: Math.floor(Math.random() * 3) + 1, // Random 1-3 for fallback
          occurrences: 1,
          sources: []
        });
      });
    }

    // Sort by relevance
    suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return suggestions;
  } catch (error) {
    console.error('Error generating fallback suggestions:', error);
    // Return basic suggestions if semantic analysis fails
    return [
      `best ${baseKeyword}`,
      `${baseKeyword} guide`,
      `${baseKeyword} tips`,
      `how to ${baseKeyword}`,
      `${baseKeyword} for beginners`
    ].map((keyword, index) => ({
      keyword,
      type: 'long-tail',
      relevanceScore: 80 - (index * 5),
      estimatedSearchVolume: Math.max(100, 1000 - index * 100),
      estimatedDifficulty: index < 3 ? 'Hard' : index < 6 ? 'Medium' : 'Easy',
      competitorCount: index < 3 ? 5 : index < 6 ? 3 : 1,
      occurrences: 1,
      sources: []
    }));
  }
}

module.exports = {
  performSemanticKeywordResearch,
  generateFallbackSuggestions,
  extractPhrases,
  estimateSearchVolume,
  estimateDifficulty
};

