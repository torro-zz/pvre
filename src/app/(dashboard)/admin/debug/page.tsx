'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertCircle,
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  DollarSign,
  MessageSquare,
  ExternalLink,
  Filter,
} from 'lucide-react'
import { CommunityVoiceResult } from '@/app/api/research/community-voice/route'

interface ResearchJob {
  id: string
  hypothesis: string
  status: string
  created_at: string
  updated_at: string
}

interface ResearchResult {
  id: string
  job_id: string
  module_name: string
  data: CommunityVoiceResult
  created_at: string
}

interface JobWithResults extends ResearchJob {
  results: ResearchResult[]
}

export default function AdminDebugPage() {
  const [jobs, setJobs] = useState<JobWithResults[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())
  const [expandedSignals, setExpandedSignals] = useState<Set<string>>(new Set())

  // Check if we're in dev mode
  const isDev = process.env.NODE_ENV !== 'production'

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/admin/debug')
        if (!response.ok) {
          throw new Error('Failed to fetch debug data')
        }
        const data = await response.json()
        setJobs(data.jobs || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const toggleJob = (jobId: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev)
      if (next.has(jobId)) {
        next.delete(jobId)
      } else {
        next.add(jobId)
      }
      return next
    })
  }

  const toggleSignal = (signalId: string) => {
    setExpandedSignals((prev) => {
      const next = new Set(prev)
      if (next.has(signalId)) {
        next.delete(signalId)
      } else {
        next.add(signalId)
      }
      return next
    })
  }

  const exportJobData = (job: JobWithResults) => {
    const dataStr = JSON.stringify(job, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pvre-debug-${job.id}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const filteredJobs = jobs.filter(
    (job) =>
      job.hypothesis.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.id.includes(searchQuery)
  )

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getWtpColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-emerald-100 text-emerald-700'
      case 'medium':
        return 'bg-blue-100 text-blue-700'
      case 'low':
        return 'bg-gray-100 text-gray-700'
      default:
        return ''
    }
  }

  const highlightKeywords = (text: string, signals: string[]) => {
    if (!signals || signals.length === 0) return text

    let result = text
    signals.forEach((signal) => {
      const regex = new RegExp(`(${signal})`, 'gi')
      result = result.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>')
    })
    return result
  }

  if (!isDev) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-700">Access Denied</h2>
            <p className="text-red-600 mt-2">
              This page is only available in development mode.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Debug Dashboard</h1>
          <p className="text-muted-foreground">
            Inspect raw research data, validate scoring accuracy, and identify issues.
          </p>
          <Badge variant="outline" className="mt-2 bg-yellow-50 border-yellow-300 text-yellow-700">
            Development Mode Only
          </Badge>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by hypothesis or job ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{jobs.length}</div>
              <div className="text-sm text-muted-foreground">Total Jobs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {jobs.reduce((acc, job) => {
                  const cvResult = job.results?.find((r) => r.module_name === 'community_voice')
                  return acc + (cvResult?.data?.painSignals?.length || 0)
                }, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Signals</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {jobs.reduce((acc, job) => {
                  const cvResult = job.results?.find((r) => r.module_name === 'community_voice')
                  return (
                    acc +
                    (cvResult?.data?.painSignals?.filter((s) => s.willingnessToPaySignal)?.length ||
                      0)
                  )
                }, 0)}
              </div>
              <div className="text-sm text-muted-foreground">WTP Signals</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {jobs.reduce((acc, job) => {
                  const cvResult = job.results?.find((r) => r.module_name === 'community_voice')
                  return (
                    acc +
                    (cvResult?.data?.painSignals?.filter((s) => s.intensity === 'high')?.length || 0)
                  )
                }, 0)}
              </div>
              <div className="text-sm text-muted-foreground">High Intensity</div>
            </CardContent>
          </Card>
        </div>

        {/* Loading/Error States */}
        {loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p>Loading research data...</p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-6">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Jobs List */}
        {!loading && !error && (
          <div className="space-y-4">
            {filteredJobs.map((job) => {
              const isExpanded = expandedJobs.has(job.id)
              const cvResult = job.results?.find((r) => r.module_name === 'community_voice')
              const painSignals = cvResult?.data?.painSignals || []
              const painSummary = cvResult?.data?.painSummary

              return (
                <Card key={job.id} className="overflow-hidden">
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleJob(job.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 mt-1 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 mt-1 text-muted-foreground" />
                        )}
                        <div>
                          <CardTitle className="text-lg">{job.hypothesis}</CardTitle>
                          <CardDescription className="mt-1">
                            Job ID: {job.id} | Created:{' '}
                            {new Date(job.created_at).toLocaleString()}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {painSummary && (
                          <>
                            <Badge variant="outline">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Pain: {painSummary.averageScore?.toFixed(1) || 'N/A'}/10
                            </Badge>
                            <Badge variant="outline">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              {painSignals.length} signals
                            </Badge>
                            <Badge variant="outline" className={getWtpColor('high')}>
                              <DollarSign className="h-3 w-3 mr-1" />
                              {painSummary.willingnessToPayCount || 0} WTP
                            </Badge>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            exportJobData(job)
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="border-t bg-muted/30">
                      <Tabs defaultValue="signals" className="mt-4">
                        <TabsList>
                          <TabsTrigger value="signals">Pain Signals ({painSignals.length})</TabsTrigger>
                          <TabsTrigger value="summary">Summary</TabsTrigger>
                          <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                        </TabsList>

                        <TabsContent value="signals" className="mt-4">
                          <div className="space-y-3 max-h-[600px] overflow-y-auto">
                            {painSignals.map((signal, idx) => {
                              const signalId = `${job.id}-${idx}`
                              const isSignalExpanded = expandedSignals.has(signalId)

                              return (
                                <div
                                  key={signalId}
                                  className="border rounded-lg bg-white p-4"
                                >
                                  <div
                                    className="flex items-start justify-between cursor-pointer"
                                    onClick={() => toggleSignal(signalId)}
                                  >
                                    <div className="flex items-start gap-3 flex-1">
                                      {isSignalExpanded ? (
                                        <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground" />
                                      )}
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Badge
                                            className={getIntensityColor(signal.intensity)}
                                          >
                                            {signal.intensity}
                                          </Badge>
                                          <Badge variant="outline">
                                            Score: {signal.score?.toFixed(1)}/10
                                          </Badge>
                                          {signal.willingnessToPaySignal && (
                                            <Badge className={getWtpColor(signal.wtpConfidence || 'low')}>
                                              WTP: {signal.wtpConfidence}
                                            </Badge>
                                          )}
                                          {signal.solutionSeeking && (
                                            <Badge variant="outline" className="bg-purple-50 text-purple-700">
                                              Solution Seeking
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                          {signal.text?.substring(0, 200)}...
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground text-right ml-4">
                                      <div>r/{signal.source?.subreddit}</div>
                                      <div>{signal.source?.type}</div>
                                    </div>
                                  </div>

                                  {isSignalExpanded && (
                                    <div className="mt-4 pt-4 border-t space-y-4">
                                      {/* Full Text */}
                                      <div>
                                        <div className="text-xs font-medium text-muted-foreground mb-2">
                                          FULL TEXT (with keyword highlights)
                                        </div>
                                        <div
                                          className="text-sm bg-gray-50 p-3 rounded border max-h-48 overflow-y-auto"
                                          dangerouslySetInnerHTML={{
                                            __html: highlightKeywords(
                                              signal.text || '',
                                              signal.signals || []
                                            ),
                                          }}
                                        />
                                      </div>

                                      {/* Matched Keywords */}
                                      <div>
                                        <div className="text-xs font-medium text-muted-foreground mb-2">
                                          MATCHED KEYWORDS
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {signal.signals?.map((keyword, kidx) => (
                                            <Badge
                                              key={kidx}
                                              variant="outline"
                                              className="bg-yellow-50"
                                            >
                                              {keyword}
                                            </Badge>
                                          ))}
                                          {(!signal.signals || signal.signals.length === 0) && (
                                            <span className="text-sm text-muted-foreground">
                                              No keywords detected
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Score Breakdown */}
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <div className="text-xs font-medium text-muted-foreground mb-2">
                                            SCORE BREAKDOWN
                                          </div>
                                          <div className="text-sm space-y-1">
                                            <div>
                                              Intensity: <strong>{signal.intensity}</strong>
                                            </div>
                                            <div>
                                              Base Score: <strong>{signal.score?.toFixed(2)}</strong>
                                            </div>
                                            <div>
                                              Engagement:{' '}
                                              <strong>{signal.source?.engagementScore || 'N/A'}</strong>
                                            </div>
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-xs font-medium text-muted-foreground mb-2">
                                            SOURCE
                                          </div>
                                          <div className="text-sm space-y-1">
                                            <div>
                                              Subreddit:{' '}
                                              <strong>r/{signal.source?.subreddit}</strong>
                                            </div>
                                            <div>
                                              Type: <strong>{signal.source?.type}</strong>
                                            </div>
                                            {signal.source?.url && (
                                              <a
                                                href={signal.source.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline flex items-center gap-1"
                                              >
                                                View on Reddit
                                                <ExternalLink className="h-3 w-3" />
                                              </a>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                            {painSignals.length === 0 && (
                              <div className="text-center py-8 text-muted-foreground">
                                No pain signals found for this job.
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="summary" className="mt-4">
                          {painSummary ? (
                            <div className="grid grid-cols-2 gap-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-base">Signal Distribution</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-2">
                                    <div className="flex justify-between">
                                      <span>High Intensity:</span>
                                      <Badge className={getIntensityColor('high')}>
                                        {painSummary.highIntensityCount}
                                      </Badge>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Medium Intensity:</span>
                                      <Badge className={getIntensityColor('medium')}>
                                        {painSummary.mediumIntensityCount}
                                      </Badge>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Low Intensity:</span>
                                      <Badge className={getIntensityColor('low')}>
                                        {painSummary.lowIntensityCount}
                                      </Badge>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-base">Key Metrics</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-2">
                                    <div className="flex justify-between">
                                      <span>Total Signals:</span>
                                      <strong>{painSummary.totalSignals}</strong>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Average Score:</span>
                                      <strong>{painSummary.averageScore?.toFixed(2)}/10</strong>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>WTP Count:</span>
                                      <strong>{painSummary.willingnessToPayCount}</strong>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Solution Seeking:</span>
                                      <strong>{painSummary.solutionSeekingCount}</strong>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              No summary data available.
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="raw" className="mt-4">
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-[500px] text-xs">
                            {JSON.stringify(cvResult?.data, null, 2)}
                          </pre>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  )}
                </Card>
              )
            })}

            {filteredJobs.length === 0 && !loading && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No research jobs found matching your search.
                </CardContent>
              </Card>
            )}
          </div>
        )}
    </div>
  )
}
