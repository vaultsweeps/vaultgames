'use client'
import { useEffect } from 'react'

/** Blocks pinch and double-tap zoom on iOS Safari, which ignores user-scalable=no. */
export default function NoPinchZoom() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault()
    let lastTouchEnd = 0
    const onTouchEnd = (e: TouchEvent) => {
      const now = Date.now()
      if (now - lastTouchEnd < 300) e.preventDefault()
      lastTouchEnd = now
    }
    document.addEventListener('gesturestart', block)
    document.addEventListener('gesturechange', block)
    document.addEventListener('touchend', onTouchEnd, { passive: false })
    return () => {
      document.removeEventListener('gesturestart', block)
      document.removeEventListener('gesturechange', block)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [])
  return null
}
