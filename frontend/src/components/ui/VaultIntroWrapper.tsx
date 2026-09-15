'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

// ssr: false must live inside a Client Component — this wrapper satisfies that constraint.
// Using the absolute @/ path avoids Webpack relative-module resolution failures.
const VaultIntro = dynamic(
  () => import('@/components/ui/VaultIntro'),
  { ssr: false, loading: () => null }
)

export default function VaultIntroWrapper() {
  return (
    <Suspense fallback={null}>
      <VaultIntro />
    </Suspense>
  )
}
