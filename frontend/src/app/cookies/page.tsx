import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-4xl mx-auto glass rounded-2xl p-8 md:p-12">
          <h1 className="text-3xl font-bold text-white mb-6">Cookie Policy</h1>
          <div className="space-y-4 text-sm text-secondary leading-relaxed">
            <p>
              This Cookie Policy explains how Vault Sweeps uses cookies and similar technologies to recognize you when you visit our website. It explains what these technologies are and why we use them, as well as your rights to control our use of them.
            </p>
            <h2 className="text-lg font-bold text-white mt-6 mb-2">1. What are cookies?</h2>
            <p>
              Cookies are small data files that are placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners in order to make their websites work, or to work more efficiently, as well as to provide reporting information.
            </p>
            <h2 className="text-lg font-bold text-white mt-6 mb-2">2. Why do we use cookies?</h2>
            <p>
              We use first and third party cookies for several reasons. Some cookies are required for technical reasons in order for our website to operate, and we refer to these as "essential" or "strictly necessary" cookies. Other cookies also enable us to track and target the interests of our users to enhance the experience on our Online Properties. Third parties serve cookies through our website for advertising, analytics and other purposes.
            </p>
            <h2 className="text-lg font-bold text-white mt-6 mb-2">3. How can I control cookies?</h2>
            <p>
              You have the right to decide whether to accept or reject cookies. You can exercise your cookie rights by setting your preferences in the Cookie Consent Manager. You can also set or amend your web browser controls to accept or refuse cookies. If you choose to reject cookies, you may still use our website though your access to some functionality and areas of our website may be restricted.
            </p>
            <h2 className="text-lg font-bold text-white mt-6 mb-2">4. Essential Cookies</h2>
            <p>
              These cookies are strictly necessary to provide you with services available through our website and to use some of its features, such as access to secure areas, maintaining your logged-in session, and protecting against fraudulent activity during gaming sessions.
            </p>
            <h2 className="text-lg font-bold text-white mt-6 mb-2">5. Updates to this Policy</h2>
            <p>
              We may update this Cookie Policy from time to time in order to reflect, for example, changes to the cookies we use or for other operational, legal or regulatory reasons. Please therefore re-visit this Cookie Policy regularly to stay informed about our use of cookies and related technologies.
            </p>
            <p className="mt-8 text-xs text-muted">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
