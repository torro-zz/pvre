'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Plus } from 'lucide-react'
import type { User } from './types'

interface UsersTabProps {
  users: User[]
  searchQuery: string
  onSearchChange: (query: string) => void
  onSearch: () => void
  onSelectUser: (user: User) => void
}

export function UsersTab({
  users,
  searchQuery,
  onSearchChange,
  onSearch,
  onSelectUser,
}: UsersTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Users</CardTitle>
        <CardDescription>View and manage user accounts</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={onSearch}>Search</Button>
        </div>

        {/* Users Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">User</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Credits</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">$/Credit</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Runs</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Joined</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{user.email}</div>
                    <div className="text-sm text-gray-500">{user.full_name || 'No name'}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant={user.credits_balance > 0 ? 'default' : 'secondary'}>
                      {user.credits_balance}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500">
                    {user.avg_spend_per_credit ? `$${user.avg_spend_per_credit}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {user.total_research_runs}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectUser(user)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Credits
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
