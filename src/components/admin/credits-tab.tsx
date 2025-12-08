'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Users, Plus, Minus } from 'lucide-react'
import type { User } from './types'

interface CreditsTabProps {
  selectedUser: User | null
  creditAmount: string
  creditDescription: string
  actionLoading: boolean
  onCreditAmountChange: (amount: string) => void
  onDescriptionChange: (description: string) => void
  onAddCredits: () => void
  onCancel: () => void
}

export function CreditsTab({
  selectedUser,
  creditAmount,
  creditDescription,
  actionLoading,
  onCreditAmountChange,
  onDescriptionChange,
  onAddCredits,
  onCancel,
}: CreditsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add/Deduct Credits</CardTitle>
        <CardDescription>
          {selectedUser
            ? `Managing credits for ${selectedUser.email}`
            : 'Select a user from the Users tab first'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {selectedUser ? (
          <div className="space-y-4 max-w-md">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Selected User</div>
              <div className="font-medium">{selectedUser.email}</div>
              <div className="text-sm">
                Current balance: <strong>{selectedUser.credits_balance} credits</strong>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Credits to Add/Deduct</label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCreditAmountChange('1')}
                >
                  +1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCreditAmountChange('5')}
                >
                  +5
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCreditAmountChange('10')}
                >
                  +10
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCreditAmountChange('-1')}
                >
                  -1
                </Button>
              </div>
              <Input
                type="number"
                placeholder="Enter amount (negative to deduct)"
                value={creditAmount}
                onChange={(e) => onCreditAmountChange(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                placeholder="e.g., Beta tester bonus"
                value={creditDescription}
                onChange={(e) => onDescriptionChange(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={onAddCredits}
                disabled={actionLoading || !creditAmount}
              >
                {parseInt(creditAmount || '0') >= 0 ? (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Credits
                  </>
                ) : (
                  <>
                    <Minus className="h-4 w-4 mr-2" />
                    Deduct Credits
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Select a user from the Users tab to manage their credits</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
