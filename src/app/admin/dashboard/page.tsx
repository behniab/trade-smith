import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency, formatDate, JOB_STATUS_COLORS, JOB_STATUS_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { Briefcase, Users, FileText, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createAdminClient()

  const [{ count: jobCount }, { count: clientCount }, { count: invoiceCount }, { data: recentJobs }] =
    await Promise.all([
      supabase.from('jobs').select('*', { count: 'exact', head: true }),
      supabase.from('clients').select('*', { count: 'exact', head: true }),
      supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
      supabase
        .from('jobs')
        .select('*, clients(name)')
        .order('created_at', { ascending: false })
        .limit(8),
    ])

  const stats = [
    { label: 'Total Jobs', value: jobCount ?? 0, icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Clients', value: clientCount ?? 0, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Pending Invoices', value: invoiceCount ?? 0, icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Active Jobs', value: recentJobs?.filter(j => j.status === 'in_progress').length ?? 0, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border p-5">
            <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-sm text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Jobs</h2>
          <Link href="/admin/jobs" className="text-sm text-blue-600 hover:underline">View all</Link>
        </div>
        <div className="divide-y">
          {recentJobs?.map(job => (
            <Link key={job.id} href="/admin/jobs" className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition">
              <div>
                <p className="text-sm font-medium text-gray-900">{job.title}</p>
                <p className="text-xs text-gray-500">{(job.clients as { name: string } | null)?.name} · {formatDate(job.created_at)}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${JOB_STATUS_COLORS[job.status]}`}>
                {JOB_STATUS_LABELS[job.status]}
              </span>
            </Link>
          ))}
          {!recentJobs?.length && (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">No jobs yet. Share your quote link to get started.</p>
          )}
        </div>
      </div>
    </div>
  )
}
