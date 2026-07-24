import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-4xl mx-auto glass rounded-2xl p-8 md:p-12">
          <h1 className="text-3xl font-bold text-white mb-6">Terms of Service</h1>
          <div className="space-y-4 text-sm text-secondary leading-relaxed">
            <p>
              Welcome to Vault Sweeps. These Terms of Service ("Terms") constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and Vault Sweeps, concerning your access to and use of our website as well as any other media form, media channel, mobile website or mobile application related, linked, or otherwise connected thereto.
            </p>
            <h2 className="text-lg font-bold text-white mt-6 mb-2">1. Eligibility</h2>
            <p>
              You must be at least 18 years of age to use the Services. By using the Services, you represent and warrant that you are at least 18 years of age and that you have the right, authority, and capacity to enter into these Terms and to abide by all of the terms and conditions set forth herein.
            </p>
            <h2 className="text-lg font-bold text-white mt-6 mb-2">2. Account Responsibilities</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account and password and for restricting access to your computer or device, and you agree to accept responsibility for all activities that occur under your account or password. We reserve the right to refuse service, terminate accounts, remove or edit content, or cancel sweepstakes entries in our sole discretion.
            </p>
            <h2 className="text-lg font-bold text-white mt-6 mb-2">3. Prohibited Activities</h2>
            <p>
              You may not access or use the Site for any purpose other than that for which we make the Site available. The Site may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us. Fraudulent activities, cheating, or manipulation of sweepstakes outcomes are strictly prohibited.
            </p>
            <h2 className="text-lg font-bold text-white mt-6 mb-2">4. Sweepstakes Rules</h2>
            <p>
              Participation in any sweepstakes or games on Vault Sweeps is subject to our official sweepstakes rules. No purchase is necessary to enter or win. Purchasing will not increase your chances of winning. Void where prohibited by law.
            </p>
            <h2 className="text-lg font-bold text-white mt-6 mb-2">5. Modifications to Terms</h2>
            <p>
              We reserve the right, in our sole discretion, to make changes or modifications to these Terms of Service at any time and for any reason. We will alert you about any changes by updating the "Last updated" date of these Terms, and you waive any right to receive specific notice of each such change.
            </p>
            <p className="mt-8 text-xs text-muted">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
