import Image from 'next/image'
import Link from 'next/link'

export default function CashMethodsBanner() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 mb-12">
      <div className="relative w-full rounded-[2rem] overflow-hidden bg-gradient-to-r from-[#1eb854] to-[#6bb7d9] h-[320px] flex items-center shadow-2xl">
        {/* Left Content */}
        <div className="relative z-10 p-8 md:p-12 lg:pl-16 md:w-1/2">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-2 uppercase tracking-tighter" style={{ fontFamily: "'Inter', sans-serif" }}>
            DEPOSITS
          </h2>
          <p className="text-xl md:text-2xl font-bold text-white mb-3 tracking-tight">
            Make deposits your way
          </p>
          <p className="text-sm md:text-base text-white/90 mb-8 max-w-md font-medium leading-relaxed">
            Deposit instantly via Crypto (BTC, USDT, ETH) or cash methods (CashApp, PayPal, Chime).
          </p>
          <Link 
            href="/dashboard/deposits" 
            className="inline-block bg-[#3bbdf8] hover:bg-[#20a9e8] text-white font-bold py-3.5 px-8 rounded-2xl transition-all shadow-lg hover:shadow-[#3bbdf8]/50 hover:-translate-y-1"
          >
            Make Deposit
          </Link>
          
          {/* Slider indicators (decorative for the poster look) */}
          <div className="flex gap-2 mt-8">
            <div className="w-4 h-1 bg-white/40 rounded-full"></div>
            <div className="w-8 h-1 bg-yellow-400 rounded-full"></div>
            <div className="w-4 h-1 bg-white/40 rounded-full"></div>
          </div>
        </div>

        {/* Right Side: Girl Image */}
        {/* Note: The image should have a transparent background and be placed in public/images/promo-girl.png */}
        <div className="absolute bottom-0 right-0 h-[115%] w-1/2 flex justify-end items-end pointer-events-none origin-bottomright hidden md:flex">
          {/* We use a standard img tag here so it doesn't hard-crash Next.js if the image is missing before you upload it */}
          <img 
            src="/images/promo-girl.png" 
            alt="Promo Girl" 
            width={600}
            height={800}
            className="object-contain object-bottom right-0 h-full drop-shadow-2xl"
          />
        </div>
      </div>
    </div>
  )
}
