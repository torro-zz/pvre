import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { CommunityVoiceResults } from '@/components/research/community-voice-results'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Calendar, Clock, AlertCircle } from 'lucide-react'
import { CommunityVoiceResult } from '@/app/api/research/community-voice/route'

export const dynamic = 'force-dynamic'

interface ResearchJob {
  id: string
  hypothesis: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
  user_id: string
}

interface ResearchResult {
  id: string
  job_id: string
  module_name: string
  data: CommunityVoiceResult
  created_at: string
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function ResearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch the research job
  const { data: job, error: jobError } = await supabase
    .from('research_jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (jobError || !job) {
    notFound()
  }

  const researchJob = job as ResearchJob

  // Verify user owns this job
  if (researchJob.user_id !== user.id) {
    notFound()
  }

  // Fetch the research results
  const { data: resultData, error: resultError } = await supabase
    .from('research_results')
    .select('*')
    .eq('job_id', id)
    .eq('module_name', 'community_voice')
    .single()

  console.log('Fetching results for job:', id)
  console.log('Result data:', resultData ? 'Found' : 'Not found')
  console.log('Result error:', resultError?.message || 'None')

  const result = resultData as ResearchResult | null

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back button and header */}
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2">{researchJob.hypothesis}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(researchJob.created_at)}
                </span>
                {result?.data?.metadata?.processingTimeMs && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {(result.data.metadata.processingTimeMs / 1000).toFixed(1)}s processing
                  </span>
                )}
              </div>
            </div>
            <Badge
              className={
                researchJob.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : researchJob.status === 'processing'
                  ? 'bg-blue-100 text-blue-700'
                  : researchJob.status === 'failed'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700'
              }
            >
              {researchJob.status.charAt(0).toUpperCase() + researchJob.status.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Results or status message */}
        {result?.data ? (
          <CommunityVoiceResults results={result.data} />
        ) : researchJob.status === 'completed' ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Results Not Available</h3>
                <p className="text-muted-foreground mb-4">
                  This research was completed but the detailed results were not saved.
                  This can happen with older research jobs. Please run the research again.
                </p>
                <Link href="/research">
                  <Button>Run New Research</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : researchJob.status === 'processing' ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Research in Progress</h3>
                <p className="text-muted-foreground">
                  Your research is still being processed. Please check back in a few moments.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : researchJob.status === 'failed' ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Research Failed</h3>
                <p className="text-muted-foreground mb-4">
                  Unfortunately, the research process encountered an error.
                </p>
                <Link href="/research">
                  <Button>Try Again</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Research Pending</h3>
                <p className="text-muted-foreground">
                  This research job is waiting to be processed.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
