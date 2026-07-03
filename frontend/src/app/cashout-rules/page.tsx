import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { CheckCircle, Clock, Shield, AlertCircle } from 'lucide-react'

const RULES = [
  { icon: CheckCircle, title: 'Minimum Cashout', value: '$50', desc: 'The minimum amount per withdrawal request is $50 USD.', color: '#00D4FF' },
  { icon: CheckCircle, title: 'Maximum Cashout', value: '$1000', desc: 'Maximum single withdrawal is $1000 per transaction.', color: '#7B2FFF' },
  { icon: Clock, title: 'Processing Time', value: 'Under 10 Mins', desc: 'Cashouts are reviewed and processed by our team in under 10 minutes.', color: '#00FFC8' },
]

const STEPS = [
  { step: '01', title: 'Submit Request', desc: 'Go to Dashboard > Cashouts and fill in your withdrawal details.' },
  { step: '02', title: 'Admin Review', desc: 'Our team reviews your request in under 10 minutes for security checks.' },
  { step: '03', title: 'Approval', desc: 'Once approved, your cashout is processed to your chosen payment method.' },
  { step: '04', title: 'Funds Received', desc: 'Funds arrive based on your payment method (crypto is fastest).' },
]

export default function CashoutRulesPage() {
  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="font-mono text-xs tracking-[0.3em] text-neon-blue uppercase mb-3">Withdrawals</p>
            <h1 className="font-display font-bold text-5xl text-white mb-4">CASHOUT <span className="gradient-text">RULES</span></h1>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">Everything you need to know about withdrawing your winnings.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-14">
            {RULES.map((r, i) => (
              <div key={i} className="glass-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${r.color}15`, border: `1px solid ${r.color}30` }}>
                    <r.icon className="w-5 h-5" style={{ color: r.color }} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-mono">{r.title}</p>
                    <p className="text-white font-bold font-display">{r.value}</p>
                  </div>
                </div>
                <p className="text-slate-400 text-sm">{r.desc}</p>
              </div>
            ))}
          </div>

          <div className="glass-card p-8 mb-10">
            <h2 className="font-display font-bold text-2xl text-white mb-6 text-center">HOW IT <span className="gradient-text">WORKS</span></h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {STEPS.map((s, i) => (
                <div key={i} className="flex gap-4">
                  <div className="font-display font-black text-4xl text-neon-blue/20 flex-shrink-0 leading-none">{s.step}</div>
                  <div>
                    <h3 className="font-display font-bold text-white mb-1">{s.title}</h3>
                    <p className="text-slate-400 text-sm">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-8 mb-10 overflow-hidden">
            <h2 className="font-display font-bold text-2xl text-white mb-6 text-center">CASHOUT <span className="gradient-text">LIMITS</span></h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-blue-600/20 text-white font-display uppercase tracking-wider text-sm border-b border-white/10">
                    <th className="py-4 px-6 text-blue-400">Deposit</th>
                    <th className="py-4 px-6 text-blue-400">Minimum</th>
                    <th className="py-4 px-6 text-blue-400">Maximum</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300 font-mono text-sm">
                  <tr className="border-b border-white/5 bg-white/[0.02]"><td className="py-3 px-6 font-bold">$5</td><td className="py-3 px-6">$50</td><td className="py-3 px-6">$50</td></tr>
                  <tr className="border-b border-white/5 bg-white/[0.01]"><td className="py-3 px-6 font-bold">$6-$9</td><td className="py-3 px-6">$50</td><td className="py-3 px-6">$100</td></tr>
                  <tr className="border-b border-white/5 bg-white/[0.02]"><td className="py-3 px-6 font-bold">$10-$15</td><td className="py-3 px-6">$50</td><td className="py-3 px-6">X15</td></tr>
                  <tr className="border-b border-white/5 bg-white/[0.01]"><td className="py-3 px-6 font-bold">$16-$25</td><td className="py-3 px-6">X3</td><td className="py-3 px-6">X15</td></tr>
                  <tr className="border-b border-white/5 bg-white/[0.02]"><td className="py-3 px-6 font-bold">$26-$35</td><td className="py-3 px-6">X3</td><td className="py-3 px-6">X15</td></tr>
                  <tr className="border-b border-white/5 bg-white/[0.01]"><td className="py-3 px-6 font-bold">$36-$50</td><td className="py-3 px-6">X3</td><td className="py-3 px-6">X15</td></tr>
                  <tr className="border-b border-white/5 bg-white/[0.02]"><td className="py-3 px-6 font-bold">$50+</td><td className="py-3 px-6">X3</td><td className="py-3 px-6">$1000</td></tr>
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-dark-800/50 p-4 rounded-xl border border-white/5">
              <div>
                <p className="text-white font-mono text-sm mb-1 uppercase tracking-wider">Minimum Deposit: <span className="text-neon-blue">$5</span></p>
                <p className="text-white font-mono text-sm uppercase tracking-wider">Maximum Cashout in a Day: <span className="text-neon-blue">$1000</span></p>
              </div>
              <div className="flex gap-2 items-center text-sm">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <p className="text-slate-300">NOTE: winning above the maximum limit is voided by the system</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 border border-yellow-400/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-400 font-medium mb-2">Important Terms & Conditions</p>
                <ul className="space-y-1.5 text-sm text-slate-400">
                  <li>• Bonus funds are subject to wagering requirements before withdrawal eligibility</li>
                  <li>• Withdrawal requests may be delayed during peak periods or for additional verification</li>
                  <li>• All withdrawals are processed in USD equivalent; crypto rates apply at time of processing</li>
                  <li>• Users must provide accurate and verified payment information</li>
                  <li>• Vault Sweeps reserves the right to request identity verification at any time</li>
                  <li>• Daily withdrawal limit: $10,000 for standard accounts; $100,000 for VIP accounts</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
