'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Area, AreaChart } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ResearchJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
}

interface OverviewChartsProps {
  jobs: ResearchJob[]
}

const COLORS = {
  completed: '#10b981', // emerald-500
  processing: '#3b82f6', // blue-500
  pending: '#f59e0b', // amber-500
  failed: '#ef4444', // red-500
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
}

export function OverviewCharts({ jobs }: OverviewChartsProps) {
  const statusData = useMemo(() => {
    const counts: Record<string, number> = { completed: 0, processing: 0, pending: 0, failed: 0 }
    jobs.forEach(j => {
      if (j.status in counts) counts[j.status]++
    })
    return Object.entries(counts)
      .filter(([_, v]) => v > 0)
      .map(([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: count,
        color: COLORS[status as keyof typeof COLORS],
      }))
  }, [jobs])

  const activityData = useMemo(() => {
    // Group by day for last 14 days
    const days: Record<string, number> = {}
    const now = new Date()
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = date.toISOString().split('T')[0]
      days[key] = 0
    }
    jobs.forEach(j => {
      const key = j.created_at.split('T')[0]
      if (key in days) days[key]++
    })
    return Object.entries(days).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count,
    }))
  }, [jobs])

  // Don't render if not enough data
  if (jobs.length < 2) return null

  return (
    <motion.div
      className="grid gap-4 sm:gap-6 md:grid-cols-2"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Status Distribution Donut */}
      <motion.div variants={itemVariants}>
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-popover border rounded-lg shadow-lg px-3 py-2 text-sm">
                            <div className="font-medium">{data.name}</div>
                            <div className="text-muted-foreground">{data.value} research</div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {statusData.map(s => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: s.color }}
                  />
                  <span className="text-muted-foreground">
                    {s.name}: <span className="font-medium text-foreground">{s.value}</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Activity Timeline */}
      <motion.div variants={itemVariants}>
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Activity (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover border rounded-lg shadow-lg px-3 py-2 text-sm">
                            <div className="font-medium">{label}</div>
                            <div className="text-muted-foreground">
                              {payload[0].value} research
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#colorCount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
