'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Loader from '@/components/ui/Loader'

/**
 * NavigationLoader
 *
 * Shows the full-screen Loader whenever the route changes.
 * Strategy:
 *  - On pathname/searchParams change → show loader immediately
 *  - Hide after a short minimum display time so the loader never flickers
 *  - Hide once the new page content has mounted (via requestIdleCallback / setTimeout fallback)
 */
const MIN_DISPLAY_MS = 400   // never hide sooner than this after showing
const MAX_DISPLAY_MS = 6000  // safety cap — always hide after 6 s

export default function NavigationLoader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const shownAt = useRef<number>(0)
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const minTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleRef  = useRef<ReturnType<typeof requestIdleCallback> | null>(null)
  const prevPath = useRef<string>('')

  const hide = useCallback(() => {
    const elapsed = Date.now() - shownAt.current
    const delay = Math.max(0, MIN_DISPLAY_MS - elapsed)
    minTimer.current = setTimeout(() => setVisible(false), delay)
  }, [])

  // Cleanup helpers
  const clearAll = useCallback(() => {
    if (maxTimer.current) clearTimeout(maxTimer.current)
    if (minTimer.current) clearTimeout(minTimer.current)
    if (idleRef.current && typeof cancelIdleCallback !== 'undefined') {
      cancelIdleCallback(idleRef.current)
    }
  }, [])

  useEffect(() => {
    const currentPath = pathname + searchParams.toString()

    // Skip on first render (initial page load has its own loading.tsx)
    if (!prevPath.current) {
      prevPath.current = currentPath
      return
    }

    // Route actually changed
    if (currentPath !== prevPath.current) {
      prevPath.current = currentPath

      clearAll()
      shownAt.current = Date.now()
      setVisible(true)

      // Safety cap — always hide after MAX_DISPLAY_MS
      maxTimer.current = setTimeout(() => setVisible(false), MAX_DISPLAY_MS)

      // Hide once browser is idle (new page has painted)
      if (typeof requestIdleCallback !== 'undefined') {
        idleRef.current = requestIdleCallback(hide, { timeout: MAX_DISPLAY_MS })
      } else {
        // Fallback for browsers without requestIdleCallback (Safari < 16)
        minTimer.current = setTimeout(hide, MIN_DISPLAY_MS + 200)
      }
    }

    return clearAll
  }, [pathname, searchParams, clearAll, hide])

  if (!visible) return null
  return <Loader fullScreen />
}
