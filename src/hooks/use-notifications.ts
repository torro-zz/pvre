'use client'

/**
 * Hook for browser notifications when research completes.
 * Requests permission on first use and shows notification when called.
 */
export function useNotifications() {
  const requestPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'denied') {
      return false
    }

    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  const showNotification = async (title: string, options?: NotificationOptions) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    // Only show if document is hidden (user is on another tab)
    if (document.visibilityState === 'visible') {
      return
    }

    const hasPermission = await requestPermission()
    if (!hasPermission) {
      return
    }

    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    })

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000)

    // Focus the window when clicked
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }

  const notifyResearchComplete = (hypothesis: string) => {
    const truncated = hypothesis.length > 50
      ? hypothesis.slice(0, 47) + '...'
      : hypothesis

    showNotification('Research Complete!', {
      body: `Your research for "${truncated}" is ready to view.`,
      tag: 'research-complete', // Prevents duplicate notifications
    })
  }

  return {
    requestPermission,
    showNotification,
    notifyResearchComplete,
  }
}
