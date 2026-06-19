import Link from 'next/link'
import { Wrench, ArrowRight, Calendar, DollarSign, AlertTriangle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

interface PortfolioImage { url: string; caption: string }
interface PortfolioItem {
  id: string
  title: string
  description: string
  job_type: string | null
  completed_date: string | null
  labor_cost: number | null
  parts_cost: number | null
  total_cost: number | null
  emergent_issues: string | null
  explanation: string | null
  images: PortfolioImage[]
}

async function getPortfolio(): Promise<PortfolioItem[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('portfolio')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
  return (data as PortfolioItem[]) ?? []
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default async function GalleryPage() {
  const items = await getPortfolio()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 px-6 py-4 flex items-center justify-between backdrop-blur-md bg-gray-950/80 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-lg">
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
            <Wrench className="w-3.5 h-3.5 text-white" />
          </div>
          <span>Trade<span className="text-blue-400">Smith</span></span>
        </Link>
        <Link href="/request-quote"
          className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-400 text-white text-sm px-4 py-2 rounded-lg font-medium transition">
          Get a Quote <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </nav>

      <div className="relative max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">Our Work</h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Browse completed jobs — real projects, real results, with full cost breakdowns.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-24 text-gray-600">
            <p>No portfolio entries yet. Check back soon.</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
            {items.map(item => {
              const cover = item.images?.[0]
              return (
                <div key={item.id} className="break-inside-avoid bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
                  {cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.url} alt={item.title} className="w-full object-cover max-h-72" />
                  )}

                  {/* Additional images strip */}
                  {item.images?.length > 1 && (
                    <div className="flex gap-1 p-1">
                      {item.images.slice(1, 4).map((img, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={img.url} alt={img.caption || ''} className="h-16 flex-1 object-cover rounded-lg" />
                      ))}
                      {item.images.length > 4 && (
                        <div className="h-16 flex-1 bg-black/40 rounded-lg flex items-center justify-center text-xs text-gray-400 font-medium">
                          +{item.images.length - 4}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-5 space-y-3">
                    <div>
                      {item.job_type && (
                        <span className="text-xs text-blue-400 font-medium">{item.job_type}</span>
                      )}
                      <h3 className="text-white font-semibold text-base mt-0.5">{item.title}</h3>
                      <p className="text-gray-400 text-sm mt-1 leading-relaxed">{item.description}</p>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      {item.completed_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.completed_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      {item.total_cost && (
                        <span className="flex items-center gap-1 text-green-400">
                          <DollarSign className="w-3 h-3" />
                          {fmt(item.total_cost)}
                        </span>
                      )}
                    </div>

                    {/* Cost breakdown */}
                    {(item.labor_cost || item.parts_cost) && (
                      <div className="bg-white/5 rounded-xl px-4 py-3 text-xs space-y-1">
                        {item.labor_cost && (
                          <div className="flex justify-between text-gray-400">
                            <span>Labor</span><span>{fmt(item.labor_cost)}</span>
                          </div>
                        )}
                        {item.parts_cost && (
                          <div className="flex justify-between text-gray-400">
                            <span>Parts & Materials</span><span>{fmt(item.parts_cost)}</span>
                          </div>
                        )}
                        {item.total_cost && (
                          <div className="flex justify-between text-white font-semibold border-t border-white/10 pt-1 mt-1">
                            <span>Total</span><span>{fmt(item.total_cost)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Emergent issues */}
                    {item.emergent_issues && (
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2.5">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-orange-400 mb-1">
                          <AlertTriangle className="w-3 h-3" /> Emergent Issue
                        </p>
                        <p className="text-xs text-orange-200/70 leading-relaxed">{item.emergent_issues}</p>
                      </div>
                    )}

                    {/* Explanation */}
                    {item.explanation && (
                      <div className="border-t border-white/5 pt-3">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Notes</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{item.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-20">
          <p className="text-gray-500 mb-6">Like what you see? Let&apos;s talk about your project.</p>
          <Link href="/request-quote"
            className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-8 py-4 rounded-xl font-semibold transition shadow-lg shadow-blue-500/20">
            Get an Instant Quote <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
