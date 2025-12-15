'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageCircle, Send, Loader2, Sparkles, FileText, TrendingUp, Quote, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AskAnythingSidebarProps {
  jobId: string
  hypothesis: string
}

const QUICK_SKILLS = [
  {
    icon: TrendingUp,
    label: 'Pain points',
    question: "What are the top pain points and how intense are they?"
  },
  {
    icon: FileText,
    label: 'Summary',
    question: "Give me an executive summary of the key findings"
  },
  {
    icon: Quote,
    label: 'Key quotes',
    question: "Show me the most compelling quotes from the research"
  },
  {
    icon: Lightbulb,
    label: 'Opportunities',
    question: "What product opportunities exist based on this research?"
  },
]

export function AskAnythingSidebar({ jobId, hypothesis }: AskAnythingSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (question: string) => {
    if (!question.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: question }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/research/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, question }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to get answer')
      }

      const data = await response.json()
      const assistantMessage: Message = { role: 'assistant', content: data.answer }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, I couldn't process that. ${error instanceof Error ? error.message : 'Please try again.'}`,
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(input)
    }
  }

  return (
    <div className="flex flex-col h-full bg-card border-l">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Chat with your data</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Ask questions and get instant insights
        </p>
      </div>

      {/* Quick Skills - only show when no messages */}
      {messages.length === 0 && (
        <div className="p-4 border-b">
          <p className="text-xs text-muted-foreground mb-3">Quick actions</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_SKILLS.map((skill, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="h-auto py-3 px-3 flex flex-col items-center gap-1.5 text-xs hover:bg-primary/5 hover:border-primary/30"
                onClick={() => handleSubmit(skill.question)}
                disabled={isLoading}
              >
                <skill.icon className="h-4 w-4 text-muted-foreground" />
                <span>{skill.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p>Ask anything about your research</p>
            <p className="text-xs mt-1">or use a quick action above</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex gap-2',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  'rounded-lg px-3 py-2 max-w-[85%] text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MessageCircle className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1 text-sm"
          />
          <Button
            onClick={() => handleSubmit(input)}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
