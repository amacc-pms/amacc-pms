'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function HOOProgress() {
  const [profile, setProfile] = useState(null)
  const [jobs, setJobs] = useState([])
  const [staff, setStaff] = useState([])
  const [timesheets, setTimesheets] = useState({})
  const [loading, setLoading] = useState(true)
  const [filterStaff, setFilterStaff] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [expandedJob, setExpandedJob] = useState(null)
  const [assignments, setAssignments] = useState({})
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    if (!profileData || profileData.role !== 'hoo') { router.push('/'); return }
    setProfile(profileData)
    fetchData(profileData.division)
  }

  const fetchData = async (division) => {
    const serviceMap = {
      tax: ['Form C', 'Form B', 'Form E', 'Form TF', 'Form N', 'Form Q', 'Form BE', 'Tax Audit', 'Tax MA', 'CP204', 'Tax Estimation'],
      accounting: ['Account Yearly (Current)', 'Account Yearly (Backlog)', 'Account Monthly', 'Account In Advance', 'Account Dormant', 'Accounts Review'],
      advisory: ['SPC', 'SST Registration', 'Coaching & Training', 'Advisory services']
    }
    const services = serviceMap[division] || []

    const [jobsRes, staffRes] = await Promise.all([
      supabase.from('jobs').select('*, clients(company_name)').in('service_type', services).order('due_date', { ascending: true }),
      supabase.from('profiles').select('id, full_name').in('role', ['staff', 'hoo']).order('full_name')
    ])

    if (staffRes.data) setStaff(staffRes.data)

    if (jobsRes.data) {
      setJobs(jobsRes.data)
      const jobIds = jobsRes.data.map(j => j.id)
      const { data: assignData } = await supabase
        .from('job_assignments')
        .select('*')
        .in('job_id', jobIds)

      if (assignData) {
        const grouped = {}
        assignData.forEach(a => {
          if (!grouped[a.job_id]) grouped[a.job_id] = []
          grouped[a.job_id].push(a)
        })
        setAssignments(grouped)
      }
    }
    setLoading(false)
  }

  const fetchTimesheets = async (jobId) => {
    if (expandedJob === jobId) { setExpandedJob(null); return }
    if (!timesheets[jobId]) {
      const { data } = await supabase
        .from('timesheets')
        .select('*')
        .eq('job_id', jobId)
        .order('log_date', { ascending: false })
      setTimesheets(prev => ({ ...prev, [jobId]: data || [] }))
    }
    setExpandedJob(jobId)
  }

  const getStaffName = (staffId) => {
    return staff.find(s => s.id === staffId)?.full_name || '-'
  }

  const getStatusBadge = (status) => {
    const badges = { pending: 'bg-yellow-100 text-yellow-700', in_progress: 'bg-blue-100 text-blue-700', review: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700' }
    return badges[status] || 'bg-gray-100 text-gray-700'
  }

  const getStatusLabel = (status) => {
    const labels = { pending: 'Belum Mula', in_progress: 'Sedang Berjalan', review: 'Dalam Semakan', completed: 'Selesai' }
    return labels[status] || status
  }

  const getTotalHours = (jobId) => (timesheets[jobId] || []).reduce((sum, t) => sum + (t.hours_logged || 0), 0)

  const isOverdue = (dueDate, status) => {
    if (!dueDate || status === 'completed') return false
    return new Date(dueDate) < new Date()
  }

  const filteredJobs = jobs.filter(job => {
    const jobAssignments = assignments[job.id] || []
    const matchStaff = filterStaff === '' || jobAssignments.some(a => a.staff_id === filterStaff)
    const matchStatus = filterStatus === '' || job.status === filterStatus
    return matchStaff && matchStatus
  })

  if (!profile) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-orange-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">AMACC PMS</h1>
          <p className="text-orange-200 text-sm">Job Progress — {profile.division?.toUpperCase()}</p>
        </div>
        <button onClick={() => router.push('/dashboard/hoo')} className="bg-orange-700 hover:bg-orange-800 px-4 py-2 rounded-lg text-sm">← Balik Dashboard</button>
      </div>

      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Trail Progress Job</h2>

        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex gap-4 flex-wrap items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Staff</label>
            <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 min-w-48">
              <option value="">— Semua Staff —</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">— Semua Status —</option>
              <option value="pending">Belum Mula</option>
              <option value="in_progress">Sedang Berjalan</option>
              <option value="review">Dalam Semakan</option>
              <option value="completed">Selesai</option>
            </select>
          </div>
          <button onClick={() => { setFilterStaff(''); setFilterStatus('') }}
            className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-200">
            Reset Filter
          </button>
        </div>

        {loading ? <p className="text-gray-500">Loading...</p> : (
          <div className="space-y-4">
            {filteredJobs.length === 0 && (
              <div className="bg-white rounded-xl border p-8 text-center">
                <p className="text-gray-400">Tiada job dijumpai.</p>
              </div>
            )}
            {filteredJobs.map((job) => (
              <div key={job.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-800">{job.clients?.company_name}</h3>
                      <p className="text-sm text-gray-500">{job.invoice_number} • {job.service_type}</p>
                      <p className="text-sm font-semibold text-green-600">RM {Number(job.invoice_value).toLocaleString('ms-MY', {minimumFractionDigits: 2})}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(job.status)}`}>
                        {getStatusLabel(job.status)}
                      </span>
                      {job.due_date && (
                        <span className={`text-xs ${isOverdue(job.due_date, job.status) ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                          Due: {new Date(job.due_date).toLocaleDateString('ms-MY')}
                          {isOverdue(job.due_date, job.status) && ' ⚠️ OVERDUE'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap mb-3">
                    {(assignments[job.id] || []).length === 0 ? (
                      <span className="text-xs text-gray-400">Belum ada staff diassign</span>
                    ) : (
                      (assignments[job.id] || []).map(a => (
                        <span key={a.id} className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-xs">
                          {getStaffName(a.staff_id)} ({a.role})
                        </span>
                      ))
                    )}
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${job.percent_complete || 0}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-600 w-10">{job.percent_complete || 0}%</span>
                  </div>

                  <button onClick={() => fetchTimesheets(job.id)} className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                    {expandedJob === job.id ? '▲ Tutup Log' : '▼ Lihat Log Kerja'}
                  </button>
                </div>

                {expandedJob === job.id && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      📋 Log Kerja Staff
                      {(timesheets[job.id] || []).length > 0 && <span className="ml-2 text-gray-500">(Jumlah: {getTotalHours(job.id)} jam)</span>}
                    </p>
                    {(timesheets[job.id] || []).length === 0 ? (
                      <p className="text-sm text-gray-400">Belum ada log kerja.</p>
                    ) : (
                      <div className="space-y-2">
                        {timesheets[job.id].map((t) => (
                          <div key={t.id} className="bg-white rounded-lg p-3 border border-gray-100">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-medium text-gray-700">{t.profiles?.full_name || getStaffName(t.staff_id)}</p>
                                <p className="text-xs text-gray-500">{t.log_date}</p>
                                {t.note && <p className="text-sm text-gray-600 mt-1">{t.note}</p>}
                              </div>
                              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm font-medium">{t.hours_logged} jam</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}