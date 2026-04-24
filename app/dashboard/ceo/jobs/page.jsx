'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AllJobs() {
  const [jobs, setJobs] = useState([])
  const [profiles, setProfiles] = useState({})
  const [clients, setClients] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchAll()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'ceo') router.push('/')
  }

  const fetchAll = async () => {
    const [jobsRes, profilesRes, clientsRes] = await Promise.all([
      supabase.from('jobs').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('clients').select('id, company_name')
    ])
    if (profilesRes.data) {
      const p = {}
      profilesRes.data.forEach(x => { p[x.id] = x.full_name })
      setProfiles(p)
    }
    if (clientsRes.data) {
      const c = {}
      clientsRes.data.forEach(x => { c[x.id] = x.company_name })
      setClients(c)
    }
    if (jobsRes.data) setJobs(jobsRes.data)
    setLoading(false)
  }

  const getStatusBadge = (status) => {
    const styles = { 'pending': 'bg-yellow-100 text-yellow-700', 'in_progress': 'bg-blue-100 text-blue-700', 'review': 'bg-purple-100 text-purple-700', 'completed': 'bg-green-100 text-green-700', 'overdue': 'bg-red-100 text-red-700' }
    return styles[status] || 'bg-gray-100 text-gray-700'
  }

  const getStatusLabel = (status) => {
    const labels = { 'pending': 'Pending', 'in_progress': 'In Progress', 'review': 'Review', 'completed': 'Completed', 'overdue': 'Overdue' }
    return labels[status] || status
  }

  const isOverdue = (dueDate, status) => {
    if (status === 'completed') return false
    return dueDate && new Date(dueDate) < new Date()
  }

  const filteredJobs = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">AMACC PMS</h1>
          <p className="text-blue-200 text-sm">All Jobs</p>
        </div>
        <Link href="/dashboard/ceo" className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg text-sm">← Balik Dashboard</Link>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Semua Jobs ({filteredJobs.length})</h2>
          <div className="flex gap-2 flex-wrap">
            {['all','pending','in_progress','review','completed'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${filter === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>
                {s === 'all' ? 'Semua' : getStatusLabel(s)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Tiada jobs lagi</div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Klien</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Invoice</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Servis</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nilai (RM)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Exec</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Reviewer</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Due Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className={`hover:bg-gray-50 ${isOverdue(job.due_date, job.status) ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{clients[job.client_id] || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{job.invoice_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{job.service_type || '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{Number(job.invoice_value || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{profiles[job.assigned_exec] || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{profiles[job.assigned_reviewer] || '-'}</td>
                    <td className={`px-4 py-3 text-sm ${isOverdue(job.due_date, job.status) ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {job.due_date ? new Date(job.due_date).toLocaleDateString('ms-MY') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(isOverdue(job.due_date, job.status) ? 'overdue' : job.status)}`}>
                        {getStatusLabel(isOverdue(job.due_date, job.status) ? 'overdue' : job.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{job.completion_percentage || 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}