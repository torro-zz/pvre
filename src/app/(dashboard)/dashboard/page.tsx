import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Clock, ArrowRight, FileText, CheckCircle2, Loader2, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface ResearchJob {
  id: string
  hypothesis: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

function getStatusBadge(status: ResearchJob['status']) {
  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      )
    case 'processing':
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Processing
        </Badge>
      )
    case 'failed':
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      )
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch user's research jobs
  const { data: jobs } = await supabase
    .from('research_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  const researchJobs = (jobs || []) as ResearchJob[]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}!</h1>
        <p className="text-gray-600 mt-2">
          Get automated market research for your business hypothesis
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>New Research</CardTitle>
            <CardDescription>
              Start a new pre-validation research project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/research">
              <Button className="w-full">Start Research</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Community Voice Mining</CardTitle>
            <CardDescription>
              Discover pain points from Reddit discussions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Our AI analyzes Reddit to find real customer pain points related to your hypothesis.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Competitor Analysis</CardTitle>
            <CardDescription>
              Understand your competitive landscape
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Get insights on existing solutions and identify market gaps.
            </p>
            <Link href="/research/competitors">
              <Button variant="outline" className="w-full">Run Competitor Analysis</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Research
          </CardTitle>
          <CardDescription>
            Your latest research projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          {researchJobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                No research projects yet. Start your first one above!
              </p>
              <Link href="/research">
                <Button variant="outline">
                  Start Your First Research
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {researchJobs.map((job) => (
                <Link
                  key={job.id}
                  href={job.status === 'completed' ? `/research/${job.id}` : '#'}
                  className={`block ${job.status !== 'completed' ? 'cursor-default' : ''}`}
                >
                  <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {truncateText(job.hypothesis, 60)}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(job.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      {getStatusBadge(job.status)}
                      {job.status === 'completed' && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
