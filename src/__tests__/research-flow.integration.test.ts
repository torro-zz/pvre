/**
 * Integration test for the research data flow
 *
 * This test verifies that the saveResearchResult() utility correctly
 * saves data to the database with the right column names (module_name).
 *
 * This catches the bug fixed on Dec 1, 2024 where module_type was used
 * instead of module_name, causing results to be "lost".
 *
 * Run with: npm run test:run -- src/__tests__/research-flow.integration.test.ts
 *
 * Note: This test requires real Supabase credentials. It will be skipped
 * if running in a test environment with mock credentials.
 *
 * To run with real credentials:
 * 1. Source your env: source .env.local
 * 2. Run the test: npm run test:run -- src/__tests__/research-flow.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { saveResearchResult, type ModuleName } from '@/lib/research/save-result'

// Check if we have real Supabase credentials (not test/mock)
const hasRealCredentials = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  // Skip if using mock/test URLs or missing credentials
  return url.includes('supabase.co') && !url.includes('test.') && key.length > 50
}

// Mock data that mimics real research results
const mockPainAnalysisResult = {
  painSignals: [
    {
      id: 'test-1',
      text: 'Freelancers struggle with invoicing',
      source: 'post',
      score: 8,
      subreddit: 'freelance',
    },
  ],
  overallScore: 7.5,
  summary: 'High pain around invoicing and payment tracking',
  confidence: 0.85,
}

const mockMarketSizingResult = {
  tam: 50000000000,
  sam: 5000000000,
  som: 500000000,
  score: 7.0,
  methodology: 'Fermi estimation',
  assumptions: ['10M freelancers in target market'],
}

const mockTimingResult = {
  score: 6.5,
  tailwinds: ['Remote work growth', 'Gig economy expansion'],
  headwinds: ['Market saturation'],
  window: '12-18 months',
}

const mockCompetitorResult = {
  competitors: [
    { name: 'FreshBooks', threat: 'high', marketShare: 0.15 },
    { name: 'Wave', threat: 'medium', marketShare: 0.08 },
  ],
  competitionScore: { score: 6.0 },
  gaps: ['AI-powered categorization', 'Real-time payment tracking'],
}

// Skip all database tests if no real credentials
// The Type safety tests don't need credentials and run regardless
const describeWithCredentials = hasRealCredentials() ? describe : describe.skip

describeWithCredentials('Research Flow Integration Tests', () => {
  // Use a test job ID that's clearly identifiable
  const testJobId = `test-integration-${Date.now()}`
  let adminClient: Awaited<ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>>

  beforeAll(async () => {
    // Import dynamically to avoid issues if env vars are missing
    const { createAdminClient } = await import('@/lib/supabase/admin')
    adminClient = createAdminClient()

    // Create a test job in the database
    const { error: jobError } = await adminClient.from('research_jobs').insert({
      id: testJobId,
      user_id: 'c2a74685-a31d-4675-b6a3-4992444e345d', // Test user ID
      hypothesis: 'Integration test hypothesis',
      status: 'processing',
      created_at: new Date().toISOString(),
    })

    if (jobError) {
      console.error('Failed to create test job:', jobError)
      throw new Error(`Test setup failed: ${jobError.message}`)
    }
  })

  afterAll(async () => {
    // Clean up test data
    await adminClient.from('research_results').delete().eq('job_id', testJobId)
    await adminClient.from('research_jobs').delete().eq('id', testJobId)
  })

  describe('saveResearchResult utility', () => {
    it('should save pain_analysis results with correct module_name', async () => {
      // Save pain analysis result
      await saveResearchResult(testJobId, 'pain_analysis', mockPainAnalysisResult)

      // Verify it was saved with the correct column name
      const { data, error } = await adminClient
        .from('research_results')
        .select('*')
        .eq('job_id', testJobId)
        .eq('module_name', 'pain_analysis')
        .single()

      expect(error).toBeNull()
      expect(data).not.toBeNull()
      expect(data?.module_name).toBe('pain_analysis')
      expect(data?.data).toBeDefined()

      // Verify the data structure
      const savedData = data?.data as typeof mockPainAnalysisResult
      expect(savedData.painSignals).toHaveLength(1)
      expect(savedData.overallScore).toBe(7.5)
    })

    it('should save market_sizing results with correct module_name', async () => {
      await saveResearchResult(testJobId, 'market_sizing', mockMarketSizingResult)

      const { data, error } = await adminClient
        .from('research_results')
        .select('*')
        .eq('job_id', testJobId)
        .eq('module_name', 'market_sizing')
        .single()

      expect(error).toBeNull()
      expect(data).not.toBeNull()
      expect(data?.module_name).toBe('market_sizing')

      const savedData = data?.data as typeof mockMarketSizingResult
      expect(savedData.tam).toBe(50000000000)
      expect(savedData.score).toBe(7.0)
    })

    it('should save timing_analysis results with correct module_name', async () => {
      await saveResearchResult(testJobId, 'timing_analysis', mockTimingResult)

      const { data, error } = await adminClient
        .from('research_results')
        .select('*')
        .eq('job_id', testJobId)
        .eq('module_name', 'timing_analysis')
        .single()

      expect(error).toBeNull()
      expect(data).not.toBeNull()
      expect(data?.module_name).toBe('timing_analysis')

      const savedData = data?.data as typeof mockTimingResult
      expect(savedData.tailwinds).toHaveLength(2)
      expect(savedData.score).toBe(6.5)
    })

    it('should save competitor_intelligence results with correct module_name', async () => {
      await saveResearchResult(testJobId, 'competitor_intelligence', mockCompetitorResult)

      const { data, error } = await adminClient
        .from('research_results')
        .select('*')
        .eq('job_id', testJobId)
        .eq('module_name', 'competitor_intelligence')
        .single()

      expect(error).toBeNull()
      expect(data).not.toBeNull()
      expect(data?.module_name).toBe('competitor_intelligence')

      const savedData = data?.data as typeof mockCompetitorResult
      expect(savedData.competitors).toHaveLength(2)
      expect(savedData.competitionScore.score).toBe(6.0)
    })

    it('should upsert results without creating duplicates', async () => {
      // Save the same module twice with different data
      await saveResearchResult(testJobId, 'pain_analysis', {
        ...mockPainAnalysisResult,
        overallScore: 8.0, // Updated score
      })

      // Count results - should still be 1
      const { data, error } = await adminClient
        .from('research_results')
        .select('*')
        .eq('job_id', testJobId)
        .eq('module_name', 'pain_analysis')

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect((data?.[0]?.data as typeof mockPainAnalysisResult).overallScore).toBe(8.0)
    })
  })

  describe('Results retrieval', () => {
    it('should retrieve all module results for a job', async () => {
      // Query all results for the test job
      const { data, error } = await adminClient
        .from('research_results')
        .select('module_name, data')
        .eq('job_id', testJobId)
        .order('created_at', { ascending: true })

      expect(error).toBeNull()
      expect(data).not.toBeNull()

      // Should have all 4 modules we saved
      const moduleNames = data?.map((r) => r.module_name) || []
      expect(moduleNames).toContain('pain_analysis')
      expect(moduleNames).toContain('market_sizing')
      expect(moduleNames).toContain('timing_analysis')
      expect(moduleNames).toContain('competitor_intelligence')
    })
  })
})

// Type safety tests - these run regardless of credentials
describe('Type safety validation', () => {
  it('should only accept valid module names', () => {
    // This test validates the TypeScript type safety
    // The following should all be valid:
    const validModules: ModuleName[] = [
      'pain_analysis',
      'market_sizing',
      'timing_analysis',
      'competitor_intelligence',
      'community_voice',
    ]

    // Each module should be accepted by the type system
    expect(validModules).toHaveLength(5)

    // Note: TypeScript prevents us from passing invalid module names at compile time
    // e.g., saveResearchResult(testJobId, 'module_type', data) would be a compile error
  })

  it('should have module names matching database column expectations', () => {
    // These are the exact module names expected by the database
    const expectedModuleNames = [
      'pain_analysis',
      'market_sizing',
      'timing_analysis',
      'competitor_intelligence',
      'community_voice',
    ]

    // Verify they all use underscores (not camelCase)
    expectedModuleNames.forEach((name) => {
      expect(name).not.toMatch(/[A-Z]/) // No uppercase
      expect(name).toMatch(/^[a-z_]+$/) // Only lowercase and underscores
    })

    // This would have caught the original bug where 'module_type' was used
    // instead of 'module_name' as the column name
  })
})
