'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Trophy, TrendingUp, Target, Users, Timer, AlertCircle, Loader2, BarChart3 } from 'lucide-react'
import { ComparisonResponse, ComparisonHypothesis } from '@/app/api/research/comparison/route'

// Score cell colors
function getScoreColor(score: number | null): string {
  if (score === null) return 'bg-muted text-muted-foreground'
  if (score >= 7.5) return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400'
  if (score >= 5.0) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400'
  if (score >= 3.0) return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-400'
  return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'
}

function getScoreLabel(score: number | null): string {
  if (score === null) return '-'
  return score.toFixed(1)
}

function getTrendIcon(trend: 'rising' | 'stable' | 'falling' | null): string {
  if (trend === 'rising') return '↑'
  if (trend === 'falling') return '↓'
  if (trend === 'stable') return '→'
  return '-'
}

function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.substring(0, length - 3) + '...'
}

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-'
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

function ComparisonContent() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<ComparisonResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const jobIds = searchParams.get('jobs')

  useEffect(() => {
    if (!jobIds) {
      setError('No jobs selected for comparison')
      setLoading(false)
      return
    }

    async function fetchComparison() {
      try {
        const res = await fetch(`/api/research/comparison?jobs=${jobIds}`)
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to fetch comparison')
        }
        const result = await res.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchComparison()
  }, [jobIds])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Comparison Error</h3>
              <p className="text-muted-foreground mb-4">{error || 'Failed to load comparison'}</p>
              <Link href="/dashboard">
                <Button>Back to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { hypotheses, bestByCategory } = data

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Hypothesis Comparison
          </h1>
          <p className="text-muted-foreground">
            Comparing {hypotheses.length} hypotheses side-by-side
          </p>
        </div>
      </div>

      {/* Best By Category */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Best Performers
          </CardTitle>
          <CardDescription>Which hypothesis leads in each category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <BestByBadge
              label="Viability"
              icon={<Target className="h-4 w-4" />}
              winnerId={bestByCategory.viability}
              hypotheses={hypotheses}
              getValue={h => h.viability?.overallScore}
            />
            <BestByBadge
              label="Pain"
              icon={<TrendingUp className="h-4 w-4" />}
              winnerId={bestByCategory.pain}
              hypotheses={hypotheses}
              getValue={h => h.painScore}
            />
            <BestByBadge
              label="Market Size"
              icon={<Target className="h-4 w-4" />}
              winnerId={bestByCategory.market}
              hypotheses={hypotheses}
              getValue={h => h.tam}
              formatValue={formatNumber}
            />
            <BestByBadge
              label="Competition"
              icon={<Users className="h-4 w-4" />}
              winnerId={bestByCategory.competition}
              hypotheses={hypotheses}
              getValue={h => h.competitionScore}
            />
            <BestByBadge
              label="Timing"
              icon={<Timer className="h-4 w-4" />}
              winnerId={bestByCategory.timing}
              hypotheses={hypotheses}
              getValue={h => h.timingScore}
            />
            <BestByBadge
              label="Data Quality"
              icon={<BarChart3 className="h-4 w-4" />}
              winnerId={bestByCategory.confidence}
              hypotheses={hypotheses}
              getValue={h => h.postsAnalyzed}
              formatValue={n => `${n} posts`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Score Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Score Comparison</CardTitle>
          <CardDescription>
            Scores for each dimension (0-10 scale)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium w-[200px]">Hypothesis</th>
                  <th className="text-center py-3 px-2 font-medium">Overall</th>
                  <th className="text-center py-3 px-2 font-medium">Pain</th>
                  <th className="text-center py-3 px-2 font-medium">Market</th>
                  <th className="text-center py-3 px-2 font-medium">Competition</th>
                  <th className="text-center py-3 px-2 font-medium">Timing</th>
                </tr>
              </thead>
              <tbody>
                {hypotheses.map((h, idx) => (
                  <tr key={h.id} className="border-b last:border-0">
                    <td className="py-3 px-2">
                      <Link href={`/research/${h.id}`} className="hover:underline">
                        <div className="font-medium">{truncate(h.hypothesis, 40)}</div>
                        <div className="text-xs text-muted-foreground">#{idx + 1}</div>
                      </Link>
                    </td>
                    <td className="text-center py-3 px-2">
                      <ScoreCell
                        score={h.viability?.overallScore ?? null}
                        isBest={bestByCategory.viability === h.id}
                      />
                    </td>
                    <td className="text-center py-3 px-2">
                      <ScoreCell
                        score={h.painScore}
                        isBest={bestByCategory.pain === h.id}
                      />
                    </td>
                    <td className="text-center py-3 px-2">
                      <ScoreCell
                        score={h.marketScore}
                        isBest={bestByCategory.market === h.id}
                      />
                    </td>
                    <td className="text-center py-3 px-2">
                      <ScoreCell
                        score={h.competitionScore}
                        isBest={bestByCategory.competition === h.id}
                      />
                    </td>
                    <td className="text-center py-3 px-2">
                      <ScoreCell
                        score={h.timingScore}
                        isBest={bestByCategory.timing === h.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Detailed Metrics</CardTitle>
          <CardDescription>Key signals and market data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium w-[200px]">Hypothesis</th>
                  <th className="text-center py-3 px-2 font-medium">Pain Signals</th>
                  <th className="text-center py-3 px-2 font-medium">WTP Signals</th>
                  <th className="text-center py-3 px-2 font-medium">TAM</th>
                  <th className="text-center py-3 px-2 font-medium">Competitors</th>
                  <th className="text-center py-3 px-2 font-medium">Trend</th>
                  <th className="text-center py-3 px-2 font-medium">Posts</th>
                </tr>
              </thead>
              <tbody>
                {hypotheses.map((h, idx) => (
                  <tr key={h.id} className="border-b last:border-0">
                    <td className="py-3 px-2">
                      <Link href={`/research/${h.id}`} className="hover:underline">
                        <div className="font-medium">{truncate(h.hypothesis, 40)}</div>
                      </Link>
                    </td>
                    <td className="text-center py-3 px-2 font-medium">
                      {h.painSignalCount || '-'}
                    </td>
                    <td className="text-center py-3 px-2">
                      {h.willingnessToPayCount > 0 ? (
                        <Badge variant="default" className="bg-green-500">
                          {h.willingnessToPayCount}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="text-center py-3 px-2 font-medium">
                      {formatNumber(h.tam)}
                    </td>
                    <td className="text-center py-3 px-2">
                      {h.competitorCount || '-'}
                    </td>
                    <td className="text-center py-3 px-2">
                      <span className={
                        h.trend === 'rising' ? 'text-green-600 dark:text-green-400 font-medium' :
                        h.trend === 'falling' ? 'text-red-600 dark:text-red-400 font-medium' :
                        'text-muted-foreground'
                      }>
                        {getTrendIcon(h.trend)} {h.trend || '-'}
                      </span>
                    </td>
                    <td className="text-center py-3 px-2 text-muted-foreground">
                      {h.postsAnalyzed || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Individual Cards for Mobile */}
      <div className="grid md:grid-cols-2 gap-4 lg:hidden">
        {hypotheses.map((h, idx) => (
          <Card key={h.id} className={bestByCategory.viability === h.id ? 'ring-2 ring-yellow-400' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">
                  <Link href={`/research/${h.id}`} className="hover:underline">
                    {truncate(h.hypothesis, 50)}
                  </Link>
                </CardTitle>
                {bestByCategory.viability === h.id && (
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400 shrink-0">
                    <Trophy className="h-3 w-3 mr-1" />
                    Best
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-muted rounded">
                  <div className="text-muted-foreground text-xs">Overall</div>
                  <div className="font-bold">{getScoreLabel(h.viability?.overallScore ?? null)}</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="text-muted-foreground text-xs">Pain</div>
                  <div className="font-bold">{getScoreLabel(h.painScore)}</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="text-muted-foreground text-xs">Market</div>
                  <div className="font-bold">{getScoreLabel(h.marketScore)}</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="text-muted-foreground text-xs">Timing</div>
                  <div className="font-bold">{getScoreLabel(h.timingScore)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span>{h.painSignalCount} signals</span>
                <span>{formatNumber(h.tam)} TAM</span>
                <span>{getTrendIcon(h.trend)} {h.trend || 'N/A'}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Score cell component
function ScoreCell({ score, isBest }: { score: number | null; isBest: boolean }) {
  return (
    <div className={`inline-flex items-center justify-center px-3 py-1.5 rounded-md text-sm font-medium ${getScoreColor(score)} ${isBest ? 'ring-2 ring-yellow-400' : ''}`}>
      {getScoreLabel(score)}
      {isBest && score !== null && <Trophy className="h-3 w-3 ml-1 text-yellow-600" />}
    </div>
  )
}

// Best by badge component
function BestByBadge({
  label,
  icon,
  winnerId,
  hypotheses,
  getValue,
  formatValue = (n: number | null | undefined) => n?.toFixed(1) ?? '-',
}: {
  label: string
  icon: React.ReactNode
  winnerId: string | null
  hypotheses: ComparisonHypothesis[]
  getValue: (h: ComparisonHypothesis) => number | null | undefined
  formatValue?: (n: number | null | undefined) => string
}) {
  const winner = hypotheses.find(h => h.id === winnerId)
  const value = winner ? getValue(winner) : null

  return (
    <div className="p-3 bg-muted rounded-lg">
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
        {icon}
        <span>{label}</span>
      </div>
      {winner ? (
        <>
          <div className="font-bold text-sm">{formatValue(value)}</div>
          <div className="text-xs text-muted-foreground truncate" title={winner.hypothesis}>
            {truncate(winner.hypothesis, 20)}
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground">-</div>
      )}
    </div>
  )
}

export default function ComparisonPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ComparisonContent />
    </Suspense>
  )
}
