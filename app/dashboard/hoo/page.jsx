
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function HOODashboard() {
  const [jobs, setJobs] = useState([])
  const [profile, setProfile] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [clients, setClients] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const [assignData, setAssignData] = useState({
    assigned_exec: '',
    assigned_reviewer: '',
    assigned_de: '',
    has_data_entry: false,
    budgeted_hours: 80
  })
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!p || (p.role !== 'hoo' && p.role !== 'hoo_mp')) { router.push('/'); return }
    setProfile(p)
    fetchJobs(p)
    fetchProfiles(p)
  }

  const fetchJobs = async (p) => {
    let query = supabase.from('jobs').select('*').order('created_at', { ascending: false })
    if (p.role !== 'hoo_mp') {
      query = query.eq('division', p.division)
    }
    const { data } = await query
    if (data) setJobs(data)

    const { data: clientData } = await supabase.from('clients').select('id, company_name')
    if (clientData) {
      const c = {}
      clientData.forEach(x => { c[x.id] = x.company_name })
      setClients(c)
    }
    setLoading(false)
  }

  const fetchProfiles = async (p) => {
    let query = supabase.from('profiles').select('id, full_name, role, division').eq('is_active', true)
    if (p.role !== 'hoo_mp') {
      query = query.eq('division', p.division)
    }
    const { data } = await query
    if (data) setProfiles(data.filter(x => x.role === 'staff' || x.role === 'hoo' || x.role === 'hoo_mp'))
  }

  const canAssign = (job) => {
    if (!profile) return false
    if (profile.role === 'hoo_mp') return true
    return job.division === profile.division
  }

  const handleAssign = async () => {
    if (!assignData.assigned_exec) { alert('Sila pilih Exec!'); return }
    setAssigning(true)
    const { error } = await supabase.from('jobs').update({
      assigned_exec: assignData.assigned_exec,
      assigned_reviewer: assignData.assigned_reviewer || assignData.assigned_exec,
      assigned_de: assignData.assigned_de || null,
      has_data_entry: assignData.has_data_entry,
      budgeted_hours: assignData.budgeted_hours,
      status: 'in_progress'
    }).eq('id', selectedJob.id)

    if (error) alert('Error: ' + error.message)
    else {
      alert('✅ Staff berjaya diassign!')
      setSelectedJob(null)
      fetchJobs(profile)
    }
    setAssigning(false)
  }

  const getStatusBadge = (status) => {
    const styles = { 'pending': 'bg-yellow-100 text-yellow-700', 'in_progress': 'bg-blue-100 text-blue-700', 'review': 'bg-purple-100 text-purple-700', 'completed': 'bg-green-100 text-green-700' }
    return styles[status] || 'bg-gray-100 text-gray-700'
  }

  const getStatusLabel = (status) => {
    const labels = { 'pending': 'Belum Assign', 'in_progress': 'Sedang Berjalan', 'review': 'Review', 'completed': 'Selesai' }
    return labels[status] || status
  }

  const getDivisionBadge = (division) => {
    const styles = { 'tax': 'bg-orange-100 text-orange-700', 'account': 'bg-blue-100 text-blue-700', 'advisory': 'bg-green-100 text-green-700', 'crm': 'bg-pink-100 text-pink-700' }
    return styles[division] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-orange-500 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">AMACC PMS</h1>
          <p className="text-orange-100 text-sm">
            {profile?.role === 'hoo_mp' ? 'Master Planner Dashboard' : `HOO Dashboard — ${profile?.division?.toUpperCase()}`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">{profile?.full_name}</span>
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }}
            className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg text-sm">Log Keluar</button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          {profile?.role === 'hoo_mp' ? `Semua Jobs (${jobs.length})` : `Senarai Job — ${profile?.division?.toUpperCase()} (${jobs.length})`}
        </h2>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500">Tiada job untuk division ini.</div>
        ) : (
          <div className="space-y-4">
            {jobs.map(job => (
              <div key={job.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="font-bold text-gray-800">{clients[job.client_id] || '-'}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(job.status)}`}>
                        {getStatusLabel(job.status)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDivisionBadge(job.division)}`}>
                        {job.division?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{job.invoice_number} • {job.service_type}</p>
                    <p className="text-green-600 font-semibold mt-1">RM {Number(job.invoice_value || 0).toLocaleString()}</p>
                    {job.job_description && <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">{job.job_description}</p>}
                    <div className="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                      <span>Exec: {profiles.find(p => p.id === job.assigned_exec)?.full_name || '-'}</span>
                      <span>Reviewer: {profiles.find(p => p.id === job.assigned_reviewer)?.full_name || '-'}</span>
                      <span>Due: {job.due_date ? new Date(job.due_date).toLocaleDateString('ms-MY') : '-'}</span>
                    </div>
                  </div>
                  {canAssign(job) && (
                    <button onClick={() => { setSelectedJob(job); setAssignData({ assigned_exec: job.assigned_exec || '', assigned_reviewer: job.assigned_reviewer || '', assigned_de: job.assigned_de || '', has_data_entry: job.has_data_entry || false, budgeted_hours: job.budgeted_hours || 80 }) }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm ml-4 shrink-0">
                      {job.assigned_exec ? '✏️ Edit' : '👤 Assign'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-1">Assign Staff</h3>
            <p className="text-sm text-gray-500 mb-4">{clients[selectedJob.client_id]} — {selectedJob.invoice_number}</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Exec (Wajib)</label>
                <select value={assignData.assigned_exec} onChange={e => setAssignData({...assignData, assigned_exec: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Pilih Exec —</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Reviewer (kosong = sama dengan Exec)</label>
                <select value={assignData.assigned_reviewer} onChange={e => setAssignData({...assignData, assigned_reviewer: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Sama dengan Exec —</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="hasDE" checked={assignData.has_data_entry}
                  onChange={e => setAssignData({...assignData, has_data_entry: e.target.checked})} className="rounded" />
                <label htmlFor="hasDE" className="text-sm font-medium text-gray-700">Ada Data Entry?</label>
              </div>
              {assignData.has_data_entry && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Data Entry</label>
                  <select value={assignData.assigned_de} onChange={e => setAssignData({...assignData, assigned_de: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Pilih Data Entry —</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">Budgeted Hours</label>
                <input type="number" value={assignData.budgeted_hours} onChange={e => setAssignData({...assignData, budgeted_hours: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleAssign} disabled={assigning}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {assigning ? 'Menyimpan...' : '✅ Simpan Assignment'}
              </button>
              <button onClick={() => setSelectedJob(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}