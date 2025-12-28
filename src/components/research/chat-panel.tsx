'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageCircle, X } from 'lucide-react'
import { AskAnythingSidebar, Message } from './ask-anything-sidebar'
import { cn } from '@/lib/utils'

interface ChatPanelProps {
  jobId: string
  hypothesis: string
}

export function ChatPanel({ jobId, hypothesis }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  // Lift messages state up so it persists when drawer closes
  const [messages, setMessages] = useState<Message[]>([])

  return (
    <>
      {/* Trigger Button - Fixed position with premium styling */}
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-xl',
          'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground',
          'hover:shadow-2xl hover:scale-110 active:scale-95',
          'transition-all duration-300',
          'ring-4 ring-primary/10',
          isOpen && 'hidden'
        )}
        size="icon"
        aria-label="Open chat"
      >
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          <MessageCircle className="h-6 w-6" />
        </motion.div>
        {/* Message count badge */}
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
            {messages.length > 9 ? '9+' : messages.length}
          </span>
        )}
      </Button>

      {/* Side Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setIsOpen(false)}
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={cn(
                'fixed right-0 top-0 bottom-0 z-50',
                'w-full max-w-md',
                'bg-gradient-to-b from-card to-muted/20 border-l shadow-2xl',
                'flex flex-col'
              )}
            >
              {/* Elegant Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="border-b bg-gradient-to-br from-primary/5 via-transparent to-transparent"
              >
                <div className="flex items-center justify-between px-6 py-5">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ring-2 ring-primary/20"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    >
                      <MessageCircle className="h-5 w-5 text-primary" />
                      {/* Pulsing dot indicator */}
                      <motion.div
                        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                        animate={{ scale: [1, 1.2, 1], opacity: [1, 0.8, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </motion.div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-base">AI Research Assistant</h2>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Beta</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Ask anything about your research
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl hover:bg-muted/50 h-9 w-9 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-hidden">
                <AskAnythingSidebar
                  jobId={jobId}
                  hypothesis={hypothesis}
                  messages={messages}
                  setMessages={setMessages}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
