import Link from 'next/link'
import { Wrench, Star, Shield, Settings, ArrowRight, CheckCircle, Zap, Phone, MapPin } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

async function getSettings() {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase.from('settings').select('business_name, service_area, business_phone').single()
    return data
  } catch { return null }
}

export default async function HomePage() {
  const settings = await getSettings()
  const businessName = settings?.business_name || 'Trade-Smith'
  const serviceArea = settings?.service_area || ''
  const phone = settings?.business_phone || ''

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-white overflow-x-hidden">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between backdrop-blur-md bg-gray-950/80 border-b border-white/5">
        <div className="flex items-center gap-2.5 font-bold text-xl">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <span className="text-white">{businessName}</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/gallery" className="text-sm text-gray-400 hover:text-white transition">Gallery</Link>
          <Link href="/auth/signin" className="text-gray-500 hover:text-gray-300 transition" title="Admin">
            <Settings className="w-4 h-4" />
          </Link>
          <Link
            href="/request-quote"
            className="bg-blue-500 hover:bg-blue-400 text-white text-sm px-5 py-2 rounded-lg font-medium transition"
          >
            Get a Quote
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-32 px-6 flex items-center justify-center overflow-hidden min-h-screen">
        {/* Radial glow background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-600/20 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-blue-800/15 rounded-full blur-[100px]" />
        </div>

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Business + market badge */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm px-4 py-1.5 rounded-full font-medium">
              <Zap className="w-3.5 h-3.5" />
              Instant Estimates
            </div>
            {serviceArea && (
              <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-gray-400 text-sm px-4 py-1.5 rounded-full">
                <MapPin className="w-3.5 h-3.5 text-gray-500" />
                {serviceArea}
              </div>
            )}
          </div>

          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold leading-[1.05] tracking-tight mb-6">
            Plumbing done
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent">
              right, priced
            </span>
            <br />
            upfront.
          </h1>

          <p className="text-lg text-gray-500 mb-2 font-medium">{businessName}</p>
          <p className="text-xl text-gray-400 mb-12 max-w-xl mx-auto leading-relaxed">
            Describe your job, get a detailed line-item estimate in seconds — no phone tag, no surprises.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/request-quote"
              className="group flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-8 py-4 rounded-xl text-lg font-semibold transition shadow-lg shadow-blue-500/25"
            >
              Get an Instant Quote
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/gallery"
              className="flex items-center gap-2 border border-white/10 text-gray-300 hover:text-white hover:border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition"
            >
              View Our Work
            </Link>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-14 text-sm text-gray-500">
            {['Licensed & Insured', 'No hidden fees', 'Same-day response'].map(t => (
              <span key={t} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-400" />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Floating quote card mock */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden xl:block pointer-events-none select-none">
          <div className="w-72 bg-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl">
            <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Instant Estimate</p>
            <p className="text-sm text-gray-300 mb-4">Leaking faucet under kitchen sink</p>
            <div className="space-y-2 mb-4">
              {[
                { label: 'Labor (1.5 hrs)', cost: '$187' },
                { label: 'Parts & Materials', cost: '$43' },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{row.label}</span>
                  <span className="text-gray-200">{row.cost}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 pt-3 flex justify-between">
              <span className="text-sm font-semibold text-white">Total Estimate</span>
              <span className="text-blue-400 font-bold">$230</span>
            </div>
            <div className="mt-3 w-full bg-blue-500/20 text-blue-300 text-xs text-center py-1.5 rounded-lg font-medium">
              ✓ Generated in 3 seconds
            </div>
          </div>
        </div>
      </section>

      {/* Features strip */}
      <section className="border-y border-white/5 bg-gray-900/50 px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs uppercase tracking-widest text-gray-600 font-semibold mb-14">Why homeowners choose us</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Zap, title: 'Instant Estimates', desc: 'Detailed quotes in seconds, not days', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
              { icon: Wrench, title: 'All Plumbing Jobs', desc: 'Faucets, water heaters, full remodels, emergencies', color: 'text-blue-400', bg: 'bg-blue-400/10' },
              { icon: Star, title: 'Quality Guaranteed', desc: 'Licensed, insured pros with a satisfaction promise', color: 'text-purple-400', bg: 'bg-purple-400/10' },
              { icon: Shield, title: 'Transparent Pricing', desc: 'Line-item breakdowns before any work begins', color: 'text-green-400', bg: 'bg-green-400/10' },
            ].map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="group">
                <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">How it works</h2>
            <p className="text-gray-500">Three steps to a professional estimate</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-1/3 right-1/3 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
            {[
              { step: '01', title: 'Describe your job', desc: 'Tell us what needs fixing — add photos if you have them.' },
              { step: '02', title: 'Get your estimate', desc: 'Our AI generates a detailed, line-item cost breakdown instantly.' },
              { step: '03', title: 'Book the job', desc: 'Confirm the quote and we\'ll schedule a time that works for you.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="relative text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-white/10 flex items-center justify-center mx-auto mb-5">
                  <span className="text-blue-400 font-bold text-lg font-mono">{step}</span>
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 via-blue-800/20 to-gray-950" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-500/20 rounded-full blur-[80px]" />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-gray-400 mb-10 text-lg">Get a detailed estimate in under a minute. No signup required.</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/request-quote"
              className="group flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-8 py-4 rounded-xl text-lg font-semibold transition shadow-lg shadow-blue-500/25"
            >
              Request a Quote
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            {phone && (
              <a
                href={`tel:${phone.replace(/\D/g, '')}`}
                className="flex items-center gap-2 border border-white/10 text-gray-300 hover:text-white hover:border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition"
              >
                <Phone className="w-5 h-5" />
                {phone}
              </a>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-6 text-center text-sm text-gray-600">
        © {new Date().getFullYear()} {businessName}. All rights reserved.
      </footer>
    </div>
  )
}
