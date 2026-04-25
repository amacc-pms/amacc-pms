'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function HOODashboard() {
  const [jobs, setJobs] = useState([])
  const [profile, setProfile] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const [assignData, setAssignData] = useState({
    assigned_exec: '',
    assigned_reviewer: '',
    assigned_de: '',
    has_de: false,
    budgeted_hours: 80
  })
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !['hoo', 'ceo'].includes(prof.role)) { router.push('/'); return }
    setProfile(prof)
    await loadData()
  }

  async function loadData() {
    const { data: jobsData } = await supabase
      .from('jobs')
      .select(`*, clients(company_name)`)
      .order('created_at', { ascending: false })
    setJobs(jobsData || [])

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name')
    setProfiles(profilesData || [])
    setLoading(false)
  }

  function openAssign(job) {
    setSelectedJob(job)
    setAssignData({
      assigned_exec: job.assigned_exec || '',
      assigned_reviewer: job.assigned_reviewer || '',
      assigned_de: job.assigned_de || '',
      has_de: !!job.assigned_de,
      budgeted_hours: job.budgeted_hours || 80
    })
    setAssigning(true)
  }

  async function saveAssignment() {
    if (!assignData.assigned_exec) { alert('Exec wajib dipilih!'); return }

    const now = new Date()
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const execProfile = profiles.find(p => p.id === assignData.assigned_exec)
    const reviewerProfile = profiles.find(p => p.id === (assignData.assigned_reviewer || assignData.assigned_exec))
    const deProfile = assignData.has_de ? profiles.find(p => p.id === assignData.assigned_de) : null

    // 1. Tutup history lama jika ada
    if (selectedJob.assigned_exec) {
      await supabase
        .from('job_assignment_history')
        .update({ ended_at: now.toISOString() })
        .eq('job_id', selectedJob.id)
        .is('ended_at', null)
    }

    // 2. Simpan history baru
    await supabase.from('job_assignment_history').insert({
      job_id: selectedJob.id,
      exec_id: assignData.assigned_exec,
      reviewer_id: assignData.assigned_reviewer || assignData.assigned_exec,
      data_entry_id: assignData.has_de ? assignData.assigned_de : null,
      assigned_by: profile.id,
      assigned_at: now.toISOString(),
      month_year: monthYear,
      exec_name: execProfile?.full_name || '',
      reviewer_name: reviewerProfile?.full_name || '',
      data_entry_name: deProfile?.full_name || null
    })

    // 3. Update job
    const { error } = await supabase.from('jobs').update({
      assigned_exec: assignData.assigned_exec,
      assigned_reviewer: assignData.assigned_reviewer || assignData.assigned_exec,
      assigned_de: assignData.has_de ? assignData.assigned_de : null,
      budgeted_hours: assignData.budgeted_hours,
      status: 'in_progress'
    }).eq('id', selectedJob.id)

    if (error) { alert('Error: ' + error.message); return }

    alert('✅ Assignment berjaya disimpan!')
    setAssigning(false)
    setSelectedJob(null)
    await loadData()
  }

  function getStatusBadge(status) {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      review: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800'
    }
    const labels = {
      pending: 'Belum Assign',
      in_progress: 'Sedang Berjalan',
      review: 'Dalam Review',
      completed: 'Selesai'
    }
    return <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.pending}`}>{labels[status] || 'Belum Assign'}</span>
  }

  function getDivisionBadge(div) {
    const styles = { TAX: 'bg-red-100 text-red-800', ACCOUNT: 'bg-blue-100 text-blue-800', ADVISORY: 'bg-green-100 text-green-800' }
    return <span className={`px-2 py-1 rounded text-xs font-medium ${styles[div] || 'bg-gray-100 text-gray-800'}`}>{div}</span>
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-500">Loading...</div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-orange-500 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <div className="font-bold text-lg">AMACC PMS</div>
          <div className="text-sm opacity-80">Master Planner Dashboard</div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">{profile?.full_name}</span>
          <button onClick={() => router.push('/dashboard/hoo/history')} className="bg-orange-400 text-white px-3 py-1 rounded text-sm font-medium hover:bg-orange-300">📋 History</button><button onClick={() => router.push('/dashboard/hoo/timesheet-alert')} className="bg-orange-400 text-white px-3 py-1 rounded text-sm font-medium hover:bg-orange-300">⏰ Alert</button><button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="bg-white text-orange-500 px-3 py-1 rounded text-sm font-medium">Log Keluar</button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Semua Jobs ({jobs.length})</h1>

        <div className="space-y-4">
          {jobs.map(job => (
            <div key={job.id} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-800">{job.clients?.company_name}</h3>
                    {getStatusBadge(job.status)}
                    {getDivisionBadge(job.division)}
                  </div>
                  <p className="text-sm text-gray-500">{job.invoice_number} • {job.service_type}</p>
                  <p className="text-green-600 font-bold mt-1">RM {Number(job.invoice_value).toLocaleString()}</p>
                  {job.job_description && (
                    <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">📋 {job.job_description}</p>
                  )}
                  <div className="flex gap-4 mt-2 text-sm text-gray-500">
                    <span>Exec: {job.exec_name || '-'}</span>
                    <span>Reviewer: {job.reviewer_name || '-'}</span>
                    <span>Due: {job.due_date ? new Date(job.due_date).toLocaleDateString('ms-MY') : '-'}</span>
                  </div>
                </div>
                <button
                  onClick={() => openAssign(job)}
                  className={`ml-4 px-4 py-2 rounded text-sm font-medium text-white ${job.assigned_exec ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                >
                  {job.assigned_exec ? '✏️ Edit' : '👤 Assign'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assign Modal */}
      {assigning && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-1">Assign Staff</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedJob.clients?.company_name} — {selectedJob.invoice_number}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exec (Wajib)</label>
                <select value={assignData.assigned_exec} onChange={e => setAssignData({...assignData, assigned_exec: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">-- Pilih Exec --</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reviewer (kosong = sama dengan Exec)</label>
                <select value={assignData.assigned_reviewer} onChange={e => setAssignData({...assignData, assigned_reviewer: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">-- Sama dengan Exec --</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="hasDE" checked={assignData.has_de} onChange={e => setAssignData({...assignData, has_de: e.target.checked})} className="w-4 h-4" />
                <label htmlFor="hasDE" className="text-sm font-medium text-gray-700">Ada Data Entry?</label>
              </div>

              {assignData.has_de && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Entry</label>
                  <select value={assignData.assigned_de} onChange={e => setAssignData({...assignData, assigned_de: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">-- Pilih Data Entry --</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budgeted Hours</label>
                <input type="number" value={assignData.budgeted_hours} onChange={e => setAssignData({...assignData, budgeted_hours: Number(e.target.value)})} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={saveAssignment} className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600">✅ Simpan Assignment</button>
              <button onClick={() => { setAssigning(false); setSelectedJob(null) }} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}