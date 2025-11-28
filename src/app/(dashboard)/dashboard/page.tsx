import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
            <p className="text-sm text-gray-500">
              Get insights on existing solutions and identify market gaps.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Research</CardTitle>
          <CardDescription>
            Your latest research projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">
            No research projects yet. Start your first one above!
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
