import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { Link } from 'lucide-react'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-4xl mx-auto glass rounded-2xl p-8 md:p-12">
          <h1 className="text-3xl font-bold text-white mb-6">Privacy Policy</h1>
          <div className="space-y-4 text-sm text-secondary leading-relaxed">
            <p>
              Welcome to Vault Sweeps. Your privacy is critically important to us. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our sweepstakes gaming platform.
            </p>
            <h2 className="text-lg font-bold text-white mt-6 mb-2">1. Information We Collect</h2>
            <p>
              We may collect personal information that you voluntarily provide to us when you register on the site, express an interest in obtaining information about us or our products and services, or otherwise when you contact us. The personal information we collect may include names, email addresses, usernames, passwords, contact preferences, contact or authentication data, and billing addresses.
            </p>
            <h2 className="text-lg font-bold text-white mt-6 mb-2">2. How We Use Your Information</h2>
            <p>
              We use the information we collect or receive to facilitate account creation and logon process, to send you marketing and promotional communications, to fulfill and manage your orders, to post testimonials, and to protect our Services. We may also use it to manage user accounts and for other business purposes.
            </p>
            <h2 className="text-lg font-bold text-white mt-6 mb-2">3. Information Sharing</h2>
            <p>
              We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations. We may process or share your data if we have reasonably determined that it is necessary for our legitimate business interests.
            </p>
            <h2 className="text-lg font-bold text-white mt-6 mb-2">4. Data Security</h2>
            <p>
              We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure.
            </p>
            <h2 className="text-lg font-bold text-white mt-6 mb-2">5. Contact Us</h2>
            <p>
              If you have questions or comments about this notice, you may email us at support@vaultsweeps.com or by contacting our support team via our dashboard.
            </p>
            <p className="mt-8 text-xs text-muted">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
