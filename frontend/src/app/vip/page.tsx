import { redirect } from 'next/navigation'

// VIP page is currently under development — redirect to Bonuses
export default function VipPage() {
  redirect('/bonuses')
}
