'use client'
import { usePathname } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'

// Public site pages that show the top bar + mobile bottom bar. Mounted once in the root layout so the
// header, balance/notification polling and bottom-nav indicator persist across navigations.
const SITE_PAGES = /^\/(about|bonuses|bonus-cashout-rules|cashout-rules|contact|cookies|games|privacy|terms)(\/|$)/

export default function SiteNavbar() {
  const pathname = usePathname()
  if (pathname !== '/' && !SITE_PAGES.test(pathname)) return null
  return <Navbar />
}
