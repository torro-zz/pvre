'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageCircle, Send, Loader2, FileText, TrendingUp, Quote, Lightbulb, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

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
    question: "What are the top pain points and how intense are they?",
    gradient: 'from-red-500/10 to-orange-500/10',
    iconColor: 'text-red-600 dark:text-red-400'
  },
  {
    icon: FileText,
    label: 'Summary',
    question: "Give me an executive summary of the key findings",
    gradient: 'from-blue-500/10 to-cyan-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400'
  },
  {
    icon: Quote,
    label: 'Key quotes',
    question: "Show me the most compelling quotes from the research",
    gradient: 'from-purple-500/10 to-pink-500/10',
    iconColor: 'text-purple-600 dark:text-purple-400'
  },
  {
    icon: Lightbulb,
    label: 'Opportunities',
    question: "What product opportunities exist based on this research?",
    gradient: 'from-amber-500/10 to-yellow-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400'
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
    <div className="flex flex-col h-full">
      {/* Quick Skills - only show when no messages */}
      <AnimatePresence>
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-5 border-b bg-muted/30"
          >
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-4 w-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Actions</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {QUICK_SKILLS.map((skill, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-auto py-3 px-3 flex flex-col items-center gap-2 text-center w-full',
                      'hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200',
                      'bg-gradient-to-br border',
                      skill.gradient
                    )}
                    onClick={() => handleSubmit(skill.question)}
                    disabled={isLoading}
                  >
                    <skill.icon className={cn('h-4 w-4', skill.iconColor)} />
                    <span className="text-xs font-medium">{skill.label}</span>
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4" role="log" aria-live="polite" aria-atomic="false">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="text-center text-muted-foreground py-12"
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
              <MessageCircle className="h-6 w-6 text-primary/50" />
            </div>
            <p className="text-sm font-medium mb-1">Start a conversation</p>
            <p className="text-xs text-muted-foreground/70 max-w-[180px] mx-auto">
              Ask questions or use a quick action above
            </p>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={cn(
                  'flex gap-3',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center flex-shrink-0 mt-1 ring-1 ring-primary/10">
                    <Brain className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    'rounded-2xl px-4 py-3 max-w-[85%]',
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-primary to-primary/95 text-primary-foreground shadow-sm rounded-br-md'
                      : 'bg-muted/60 border border-border/50 shadow-sm rounded-bl-md'
                  )}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/90 flex items-center justify-center flex-shrink-0 mt-1 ring-2 ring-primary/20">
                    <MessageCircle className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex gap-3 justify-start"
            role="status"
            aria-label="Processing your question"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center flex-shrink-0 ring-1 ring-primary/10">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-muted/60 border border-border/50 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - Sticky at bottom with premium styling */}
      <div className="p-5 border-t bg-gradient-to-t from-background via-background to-transparent">
        <div className="flex gap-2.5">
          <Input
            placeholder="Ask anything about your research..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className={cn(
              "flex-1 h-11 rounded-xl border-border/50",
              "focus-visible:ring-2 focus-visible:ring-primary/20",
              "transition-all placeholder:text-muted-foreground/60"
            )}
            aria-label="Ask a question about your research"
          />
          <Button
            onClick={() => handleSubmit(input)}
            disabled={!input.trim() || isLoading}
            size="icon"
            className={cn(
              "shrink-0 h-11 w-11 rounded-xl",
              "bg-gradient-to-br from-primary to-primary/90",
              "hover:shadow-lg hover:scale-105 active:scale-95",
              "transition-all duration-200",
              (!input.trim() || isLoading) && "opacity-50 hover:scale-100"
            )}
            aria-label={isLoading ? "Sending message" : "Send message"}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground/60 mt-2.5 text-center">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted/50 text-[10px] font-mono border border-border/50">Enter</kbd> to send
        </p>
      </div>
    </div>
  )
}
