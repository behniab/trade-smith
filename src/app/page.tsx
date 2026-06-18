import Link from 'next/link'
import { Wrench, Clock, Star, Shield } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xl text-blue-600">
          <Wrench className="w-5 h-5" />
          Trade-Smith
        </div>
        <div className="flex items-center gap-4">
          <Link href="/gallery" className="text-sm text-gray-600 hover:text-gray-900">Gallery</Link>
          <Link href="/request-quote" className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
            Get a Quote
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 bg-gradient-to-br from-blue-50 to-white px-6 py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Professional Plumbing,<br />
            <span className="text-blue-600">Instant Estimates</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-xl mx-auto">
            Describe your job, upload photos, and get an AI-powered cost estimate in seconds. No waiting, no guessing.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/request-quote" className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-700 transition">
              Get an Instant Quote
            </Link>
            <Link href="/gallery" className="border border-gray-300 text-gray-700 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-50 transition">
              View Our Work
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white px-6 py-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { icon: Clock, title: 'Instant Estimates', desc: 'AI-powered quotes based on your description and photos' },
            { icon: Wrench, title: 'All Plumbing Jobs', desc: 'From leaky faucets to full remodels and emergency repairs' },
            { icon: Star, title: 'Quality Guaranteed', desc: 'Licensed, insured professionals with a satisfaction guarantee' },
            { icon: Shield, title: 'Transparent Pricing', desc: 'Clear line-item estimates before any work begins' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Icon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 px-6 py-16 text-center text-white">
        <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
        <p className="text-blue-100 mb-8">Describe your job and get a quote in under a minute.</p>
        <Link href="/request-quote" className="bg-white text-blue-600 font-semibold px-8 py-4 rounded-xl hover:bg-blue-50 transition">
          Request a Quote Now
        </Link>
      </section>

      <footer className="border-t px-6 py-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Trade-Smith. All rights reserved.
      </footer>
    </div>
  )
}
