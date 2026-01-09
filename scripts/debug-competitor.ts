/**
 * Debug script to test competitor analysis with App Gap parameters
 * Run with: ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env.local | cut -d= -f2) npx tsx scripts/debug-competitor.ts
 */

import Anthropic from '@anthropic-ai/sdk'

async function debugCompetitorAnalysis() {
  console.log('=== Debug Competitor Analysis ===\n')

  // Check if API key is set
  const apiKey = process.env.ANTHROPIC_API_KEY
  console.log('API Key present:', !!apiKey)
  console.log('API Key prefix:', apiKey?.substring(0, 10) + '...')

  // Test API directly
  console.log('\nTesting Anthropic API directly...')

  try {
    const anthropic = new Anthropic({ apiKey })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say "API working" in 3 words max' }],
    })

    console.log('API Response:', response.content[0])
    console.log('✅ API call succeeded!')
  } catch (error) {
    console.log('❌ API call failed!')
    console.log('Error:', error)
  }
}

debugCompetitorAnalysis().catch(console.error)
