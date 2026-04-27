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
  const [assignData, setAssignData] = useState({ assigned_exec: '', assigned_reviewer: '', assigned_de: '', has_de: false, budgeted_hours: 80 })
  const [searchText, setSearchText] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDiv, setFilterDiv] = useState('')
  const router = useRouter()

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !['hoo', 'ceo'].includes(prof.role)) { router.push('/'); return }
    setProfile(prof)
    await loadData(prof)
  }

  async function loadData(prof) {
    let query = supabase.from('jobs').select('*, clients!jobs_client_id_fkey(company_name)').order('created_at', { ascending: false })
    if (prof?.role === 'hoo' && prof?.division) {
      query = query.eq('division', prof.division)
    }
    const { data: jobsData } = await query
    setJobs(jobsData || [])
    const { data: profilesData } = await supabase.from('profiles').select('id, full_name, role, is_active').eq('is_active', true).order('full_name')
    setProfiles(profilesData || [])
    setLoading(false)
  }

  function openAssign(job) {
    setSelectedJob(job)
    setAssignData({ assigned_exec: job.assigned_exec || '', assigned_reviewer: job.assigned_reviewer || '', assigned_de: job.assigned_de || '', has_de: !!job.assigned_de, budgeted_hours: job.budgeted_hours || 80 })
    setAssigning(true)
  }

  async function saveAssignment() {
    if (!assignData.assigned_exec) { alert('Exec wajib dipilih!'); return }
    const now = new Date()
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const execProfile = profiles.find(p => p.id === assignData.assigned_exec)
    const reviewerProfile = profiles.find(p => p.id === (assignData.assigned_reviewer || assignData.assigned_exec))
    const deProfile = assignData.has_de ? profiles.find(p => p.id === assignData.assigned_de) : null
    if (selectedJob.assigned_exec) {
      await supabase.from('job_assignment_history').update({ ended_at: now.toISOString() }).eq('job_id', selectedJob.id).is('ended_at', null)
    }
    await supabase.from('job_assignment_history').insert({ job_id: selectedJob.id, exec_id: assignData.assigned_exec, reviewer_id: assignData.assigned_reviewer || assignData.assigned_exec, data_entry_id: assignData.has_de ? assignData.assigned_de : null, assigned_by: profile.id, assigned_at: now.toISOString(), month_year: monthYear, exec_name: execProfile?.full_name || '', reviewer_name: reviewerProfile?.full_name || '', data_entry_name: deProfile?.full_name || null })
    const { error } = await supabase.from('jobs').update({ assigned_exec: assignData.assigned_exec, assigned_reviewer: assignData.assigned_reviewer || assignData.assigned_exec, assigned_de: assignData.has_de ? assignData.assigned_de : null, budgeted_hours: assignData.budgeted_hours, status: 'in_progress' }).eq('id', selectedJob.id)
    if (error) { alert('Error: ' + error.message); return }
    alert('✅ Assignment berjaya disimpan!')
    setAssigning(false)
    setSelectedJob(null)
    await loadData(profile)
  }

  const STATUS_LABELS = { not_started: '⚪ Belum Mula', in_progress: '🔵 Dalam Proses', pending_client: '🟡 Pending Client', pending_authority: '🟠 Pending LHDN', kiv: '📌 KIV', completed: '✅ Selesai' }
  const STATUS_COLORS = { not_started: '#94a3b8', in_progress: '#3b82f6', pending_client: '#f59e0b', pending_authority: '#f97316', kiv: '#8b5cf6', completed: '#10b981' }
  const DIV_COLORS = { TAX: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' }, ACCOUNT: { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' }, ADVISORY: { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' } }

  const filteredJobs = jobs.filter(job => {
    const matchSearch = searchText === '' || (job.clients?.company_name ?? '').toLowerCase().includes(searchText.toLowerCase())
    const matchStatus = filterStatus === '' || job.status === filterStatus
    const matchDiv = filterDiv === '' || job.division === filterDiv
    return matchSearch && matchStatus && matchDiv
  })

  const metrics = {
    total: filteredJobs.length,
    unassigned: filteredJobs.filter(j => !j.assigned_exec).length,
    inProgress: filteredJobs.filter(j => j.status === 'in_progress').length,
    pending: filteredJobs.filter(j => ['pending_client','pending_authority'].includes(j.status)).length,
    overdue: filteredJobs.filter(j => j.due_date && j.due_date < today && j.status !== 'completed').length,
    completed: filteredJobs.filter(j => j.status === 'completed').length,
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><p>Memuatkan...</p></div>

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* TOP NAV */}
      <div style={{ background: '#ea580c', color: 'white', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>AMACC PMS</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>{profile?.full_name} • HOO {profile?.division}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/dashboard/hoo/timesheet-alert')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>⏰ Alert</button>
          <button onClick={() => router.push('/dashboard/hoo/osm')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>📋 OSM</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} style={{ background: 'white', border: 'none', color: '#ea580c', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Keluar</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px' }}>

        {/* METRICS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Jumlah Job', value: metrics.total, color: '#1e293b', bg: '#f1f5f9' },
            { label: 'Belum Assign', value: metrics.unassigned, color: '#dc2626', bg: '#fef2f2' },
            { label: 'In Progress', value: metrics.inProgress, color: '#2563eb', bg: '#eff6ff' },
            { label: 'Pending', value: metrics.pending, color: '#d97706', bg: '#fffbeb' },
            { label: 'Overdue', value: metrics.overdue, color: '#dc2626', bg: '#fef2f2' },
            { label: 'Selesai', value: metrics.completed, color: '#16a34a', bg: '#f0fdf4' },
          ].map((m, i) => (
            <div key={i} style={{ background: m.bg, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* SEARCH & FILTER */}
        <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Cari Client</label>
              <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Nama client..."
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                <option value="">Semua Status</option>
                <option value="not_started">⚪ Belum Mula</option>
                <option value="in_progress">🔵 Dalam Proses</option>
                <option value="pending_client">🟡 Pending Client</option>
                <option value="pending_authority">🟠 Pending LHDN</option>
                <option value="kiv">📌 KIV</option>
                <option value="completed">✅ Selesai</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Division</label>
              <select value={filterDiv} onChange={e => setFilterDiv(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                <option value="">Semua Division</option>
                <option value="TAX">TAX</option>
                <option value="ACCOUNT">ACCOUNT</option>
                <option value="ADVISORY">ADVISORY</option>
              </select>
            </div>
          </div>
          {(searchText || filterStatus || filterDiv) && (
            <button onClick={() => { setSearchText(''); setFilterStatus(''); setFilterDiv('') }}
              style={{ marginTop: 10, background: '#fee2e2', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>
              ✕ Clear Filter
            </button>
          )}
        </div>

        {/* JOB LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', background: 'white', borderRadius: 12 }}>
              <div style={{ fontSize: 40 }}>📭</div>
              <p style={{ marginTop: 8 }}>Tiada job dijumpai</p>
            </div>
          ) : filteredJobs.map(job => {
            const isOverdue = job.due_date && job.due_date < today && job.status !== 'completed'
            const divStyle = DIV_COLORS[job.division] || { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' }
            return (
              <div key={job.id} style={{ background: 'white', borderRadius: 12, padding: 16, border: `1px solid ${isOverdue ? '#fecaca' : '#e2e8f0'}`, background: isOverdue ? '#fff5f5' : 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{job.clients?.company_name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: divStyle.bg, color: divStyle.color, border: `1px solid ${divStyle.border}` }}>{job.division}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: (STATUS_COLORS[job.status] || '#94a3b8') + '20', color: STATUS_COLORS[job.status] || '#94a3b8' }}>{STATUS_LABELS[job.status] || 'Belum Assign'}</span>
                      {isOverdue && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef2f2', color: '#dc2626' }}>⚠️ OVERDUE</span>}
                    </div>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>{job.invoice_number} • {job.service_type}</p>
                    {job.invoice_value && <p style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', margin: '0 0 4px' }}>RM {Number(job.invoice_value).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</p>}
                    {job.job_description && <p style={{ fontSize: 12, color: '#475569', margin: '4px 0', background: '#fffbeb', padding: '6px 10px', borderRadius: 6, borderLeft: '3px solid #f59e0b' }}>📋 {job.job_description}</p>}
                    <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
                      <span>👤 Exec: <strong style={{ color: '#1e293b' }}>{job.exec_name || '—'}</strong></span>
                      <span>🔍 Reviewer: <strong style={{ color: '#1e293b' }}>{job.reviewer_name || '—'}</strong></span>
                      <span>📅 Due: <strong style={{ color: isOverdue ? '#dc2626' : '#1e293b' }}>{job.due_date ? new Date(job.due_date).toLocaleDateString('ms-MY') : '—'}</strong></span>
                      <span>⏱️ Budget: <strong style={{ color: '#1e293b' }}>{job.budgeted_hours || 0} jam</strong></span>
                    </div>
                  </div>
                  <button onClick={() => openAssign(job)}
                    style={{ marginLeft: 12, padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: job.assigned_exec ? '#16a34a' : '#2563eb', color: 'white', whiteSpace: 'nowrap' }}>
                    {job.assigned_exec ? '✏️ Edit' : '👤 Assign'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ASSIGN MODAL */}
      {assigning && selectedJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px' }}>Assign Staff</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>{selectedJob.clients?.company_name} — {selectedJob.invoice_number}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Exec (Wajib)</label>
                <select value={assignData.assigned_exec} onChange={e => setAssignData({...assignData, assigned_exec: e.target.value})}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                  <option value="">-- Pilih Exec --</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Reviewer (kosong = sama dengan Exec)</label>
                <select value={assignData.assigned_reviewer} onChange={e => setAssignData({...assignData, assigned_reviewer: e.target.value})}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                  <option value="">-- Sama dengan Exec --</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="hasDE" checked={assignData.has_de} onChange={e => setAssignData({...assignData, has_de: e.target.checked})} style={{ width: 16, height: 16 }} />
                <label htmlFor="hasDE" style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Ada Data Entry?</label>
              </div>
              {assignData.has_de && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Data Entry</label>
                  <select value={assignData.assigned_de} onChange={e => setAssignData({...assignData, assigned_de: e.target.value})}
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                    <option value="">-- Pilih Data Entry --</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Budgeted Hours</label>
                <input type="number" value={assignData.budgeted_hours} onChange={e => setAssignData({...assignData, budgeted_hours: Number(e.target.value)})}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={saveAssignment} style={{ flex: 1, background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>✅ Simpan</button>
              <button onClick={() => { setAssigning(false); setSelectedJob(null) }} style={{ flex: 1, background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}