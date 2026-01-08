// Quick test script to verify web search is working
const webSearchService = require('./services/webSearchService');

async function test() {
  console.log('Testing web search for keyword: "safi"\n');
  
  try {
    const results = await webSearchService.searchWebForCompetitors('safi', 5);
    console.log('\n=== RESULTS ===');
    console.log(`Found ${results.length} competitors:`);
    results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.title}`);
      console.log(`   URL: ${r.url}`);
      console.log(`   Rank: ${r.rank}\n`);
    });
    
    if (results.length === 0) {
      console.log('❌ No results found - web search is not working');
      console.log('Check if DuckDuckGo/Google is accessible');
      console.log('\nPossible issues:');
      console.log('1. Network connectivity');
      console.log('2. Search engine blocking automated requests');
      console.log('3. HTML structure changed');
    } else {
      console.log('✅ Web search is working!');
      console.log(`Found ${results.length} real competitors from web search.`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

test();



