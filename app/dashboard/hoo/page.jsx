'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function HOODashboard() {
  const [jobs, setJobs] = useState([])
  const [myJobs, setMyJobs] = useState([])
  const [profile, setProfile] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState(null)
  const [modalTab, setModalTab] = useState('detail')
  const [jobDetail, setJobDetail] = useState(null)
  const [instructions, setInstructions] = useState([])
  const [assignHistory, setAssignHistory] = useState([])
  const [newInstruction, setNewInstruction] = useState('')
  const [newUrgency, setNewUrgency] = useState('normal')
  const [sendingInstr, setSendingInstr] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignData, setAssignData] = useState({ assigned_exec: '', assigned_reviewer: '', assigned_de: '', has_de: false, budgeted_hours: 80 })
  const [searchText, setSearchText] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDiv, setFilterDiv] = useState('')
  const [activeSection, setActiveSection] = useState('unassigned')
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
    if (prof?.role === 'hoo' && prof?.division) query = query.eq('division', prof.division)
    const { data: jobsData } = await query
    setJobs(jobsData || [])
    const { data: myJobsData } = await supabase.from('jobs').select('*, clients!jobs_client_id_fkey(company_name)')
      .or(`assigned_exec.eq.${prof.id},assigned_reviewer.eq.${prof.id}`)
      .not('status', 'eq', 'completed')
    setMyJobs(myJobsData || [])
    const { data: profilesData } = await supabase.from('profiles').select('id, full_name, role, is_active').eq('is_active', true).order('full_name')
    setProfiles(profilesData || [])
    setLoading(false)
  }

  async function openJobModal(job) {
    setSelectedJob(job)
    setModalTab('detail')
    const { data: execP } = job.assigned_exec ? await supabase.from('profiles').select('full_name').eq('id', job.assigned_exec).single() : { data: null }
    const { data: reviewerP } = job.assigned_reviewer ? await supabase.from('profiles').select('full_name').eq('id', job.assigned_reviewer).single() : { data: null }
    const { data: deP } = job.assigned_de ? await supabase.from('profiles').select('full_name').eq('id', job.assigned_de).single() : { data: null }
    const { data: timesheets } = await supabase.from('timesheets').select('*').eq('job_id', job.id)
    const totalHours = (timesheets || []).reduce((s, t) => s + (t.hours_logged || 0), 0)
    setJobDetail({ execName: execP?.full_name, reviewerName: reviewerP?.full_name, deName: deP?.full_name, totalHours })
    const { data: instrs } = await supabase.from('job_instructions').select('*, profiles(full_name), instruction_replies(*, profiles(full_name))').eq('job_id', job.id).order('created_at', { ascending: false })
    setInstructions(instrs || [])
    const { data: history } = await supabase.from('job_assignment_history').select('*').eq('job_id', job.id).order('assigned_at', { ascending: false })
    setAssignHistory(history || [])
  }

  function openAssign(job, e) {
    e.stopPropagation()
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
    alert('✅ Assignment berjaya!')
    setAssigning(false)
    setSelectedJob(null)
    await loadData(profile)
  }

  async function sendInstruction() {
    if (!newInstruction.trim()) return
    setSendingInstr(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('job_instructions').insert({ job_id: selectedJob.id, assigned_to: selectedJob.assigned_exec, message: newInstruction, urgency_level: newUrgency, status: 'open', created_by: user.id })
    setNewInstruction('')
    setNewUrgency('normal')
    const { data: instrs } = await supabase.from('job_instructions').select('*, profiles(full_name), instruction_replies(*, profiles(full_name))').eq('job_id', selectedJob.id).order('created_at', { ascending: false })
    setInstructions(instrs || [])
    setSendingInstr(false)
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

  const unassignedJobs = filteredJobs.filter(j => !j.assigned_exec)
  const assignedJobs = filteredJobs.filter(j => j.assigned_exec)

  const metrics = {
    total: jobs.length,
    unassigned: jobs.filter(j => !j.assigned_exec).length,
    inProgress: jobs.filter(j => j.status === 'in_progress').length,
    pending: jobs.filter(j => ['pending_client','pending_authority'].includes(j.status)).length,
    overdue: jobs.filter(j => j.due_date && j.due_date < today && j.status !== 'completed').length,
    completed: jobs.filter(j => j.status === 'completed').length,
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><p>Memuatkan...</p></div>

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* NAV */}
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

        {/* MY JOBS — untuk HOO yang juga Reviewer/Exec */}
        {myJobs.length > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#92400e', margin: '0 0 12px' }}>👤 My Jobs — Job Saya Sendiri ({myJobs.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myJobs.map(job => (
                <div key={job.id} onClick={() => openJobModal(job)} style={{ background: 'white', borderRadius: 8, padding: '10px 14px', border: '1px solid #fde68a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{job.clients?.company_name}</span>
                    <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{job.invoice_number} • {job.service_type}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: (STATUS_COLORS[job.status] || '#94a3b8') + '20', color: STATUS_COLORS[job.status] || '#94a3b8', fontWeight: 600 }}>{STATUS_LABELS[job.status] || '-'}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Due: {job.due_date ? new Date(job.due_date).toLocaleDateString('ms-MY') : '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION TABS */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {[
            { id: 'unassigned', label: `🔴 Belum Assign (${unassignedJobs.length})` },
            { id: 'all', label: `📋 Semua Job (${filteredJobs.length})` },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveSection(tab.id)}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: activeSection === tab.id ? '#1e293b' : '#e2e8f0', color: activeSection === tab.id ? 'white' : '#475569' }}>
              {tab.label}
            </button>
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
          {(activeSection === 'unassigned' ? unassignedJobs : filteredJobs).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', background: 'white', borderRadius: 12 }}>
              <div style={{ fontSize: 40 }}>{activeSection === 'unassigned' ? '🎉' : '📭'}</div>
              <p style={{ marginTop: 8 }}>{activeSection === 'unassigned' ? 'Semua job dah assign!' : 'Tiada job dijumpai'}</p>
            </div>
          ) : (activeSection === 'unassigned' ? unassignedJobs : filteredJobs).map(job => {
            const isOverdue = job.due_date && job.due_date < today && job.status !== 'completed'
            const divStyle = DIV_COLORS[job.division] || { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' }
            const daysSinceCreate = job.created_at ? Math.floor((new Date() - new Date(job.created_at)) / 86400000) : 0
            return (
              <div key={job.id} onClick={() => openJobModal(job)}
                style={{ background: isOverdue ? '#fff5f5' : 'white', borderRadius: 12, padding: 16, border: `1px solid ${isOverdue ? '#fecaca' : '#e2e8f0'}`, cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{job.clients?.company_name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: divStyle.bg, color: divStyle.color, border: `1px solid ${divStyle.border}` }}>{job.division}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: (STATUS_COLORS[job.status] || '#94a3b8') + '20', color: STATUS_COLORS[job.status] || '#94a3b8' }}>{STATUS_LABELS[job.status] || 'Belum Assign'}</span>
                      {isOverdue && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef2f2', color: '#dc2626' }}>⚠️ OVERDUE</span>}
                      {!job.assigned_exec && daysSinceCreate >= 3 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef2f2', color: '#dc2626' }}>🔴 {daysSinceCreate} hari belum assign!</span>}
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
                  <button onClick={e => openAssign(job, e)}
                    style={{ marginLeft: 12, padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: job.assigned_exec ? '#16a34a' : '#dc2626', color: 'white', whiteSpace: 'nowrap' }}>
                    {job.assigned_exec ? '✏️ Edit' : '👤 Assign'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* JOB DETAIL MODAL */}
      {selectedJob && !assigning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, overflow: 'auto' }} onClick={e => { if (e.target === e.currentTarget) setSelectedJob(null) }}>
          <div style={{ background: 'white', minHeight: '100vh', maxWidth: 800, margin: '0 auto' }}>
            <div style={{ background: '#1e293b', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{selectedJob.clients?.company_name}</h2>
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>{selectedJob.invoice_number} • {selectedJob.service_type}</p>
              </div>
              <button onClick={() => setSelectedJob(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>✕ Tutup</button>
            </div>

            <div style={{ borderBottom: '2px solid #f1f5f9', padding: '0 20px', background: 'white', display: 'flex', gap: 4 }}>
              {[{ id: 'detail', label: '📋 Detail' }, { id: 'instructions', label: `📢 Instructions (${instructions.length})` }, { id: 'history', label: '🕐 History' }].map(tab => (
                <button key={tab.id} onClick={() => setModalTab(tab.id)}
                  style={{ background: 'none', border: 'none', borderBottom: modalTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent', padding: '14px 16px', cursor: 'pointer', fontSize: 13, fontWeight: modalTab === tab.id ? 700 : 500, color: modalTab === tab.id ? '#3b82f6' : '#64748b', marginBottom: -2 }}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ padding: 20 }}>
              {modalTab === 'detail' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Invoice Value', value: `RM ${(selectedJob.invoice_value || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}`, color: '#16a34a' },
                      { label: 'Due Date', value: selectedJob.due_date ? new Date(selectedJob.due_date).toLocaleDateString('ms-MY') : '-', color: '#3b82f6' },
                      { label: 'Budget Hours', value: `${selectedJob.budgeted_hours || 0} jam`, color: '#f59e0b' },
                      { label: 'Jam Logged', value: `${jobDetail?.totalHours || 0} jam`, color: '#8b5cf6' },
                    ].map((c, i) => (
                      <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{c.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{c.value}</div>
                      </div>
                    ))}
                  </div>
                  {selectedJob.job_description && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#92400e', margin: '0 0 6px' }}>📌 SKOP KERJA</p>
                      <p style={{ fontSize: 14, color: '#1e293b', margin: 0, lineHeight: 1.6 }}>{selectedJob.job_description}</p>
                    </div>
                  )}
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', margin: '0 0 10px' }}>👥 TEAM</p>
                    {[
                      { role: 'EXEC', name: jobDetail?.execName, color: '#3b82f6' },
                      { role: 'REVIEWER', name: jobDetail?.reviewerName, color: '#10b981' },
                      jobDetail?.deName && { role: 'DATA ENTRY', name: jobDetail?.deName, color: '#8b5cf6' },
                    ].filter(Boolean).map((t, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: 12, color: t.color, fontWeight: 700 }}>{t.role}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.name || '—'}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={e => openAssign(selectedJob, e)} style={{ marginTop: 16, width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    ✏️ Edit Assignment
                  </button>
                </div>
              )}

              {modalTab === 'instructions' && (
                <div>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: '0 0 10px' }}>📤 Hantar Instruction Baru</p>
                    <textarea value={newInstruction} onChange={e => setNewInstruction(e.target.value)} placeholder="Tulis instruction untuk staff..."
                      rows={3} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', resize: 'vertical', marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <select value={newUrgency} onChange={e => setNewUrgency(e.target.value)}
                        style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}>
                        <option value="normal">Normal</option>
                        <option value="urgent">🟡 Urgent</option>
                        <option value="kritikal">🔴 Kritikal</option>
                      </select>
                      <button onClick={sendInstruction} disabled={sendingInstr}
                        style={{ flex: 1, background: sendingInstr ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: sendingInstr ? 'not-allowed' : 'pointer' }}>
                        {sendingInstr ? '⏳ Menghantar...' : '📤 Hantar'}
                      </button>
                    </div>
                  </div>
                  {instructions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                      <div style={{ fontSize: 32 }}>📭</div>
                      <p>Tiada instruction lagi</p>
                    </div>
                  ) : instructions.map(instr => (
                    <div key={instr.id} style={{ background: instr.urgency_level === 'kritikal' ? '#fef2f2' : instr.urgency_level === 'urgent' ? '#fffbeb' : '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 12, border: `1px solid ${instr.urgency_level === 'kritikal' ? '#fecaca' : instr.urgency_level === 'urgent' ? '#fde68a' : '#e2e8f0'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, background: instr.urgency_level === 'kritikal' ? '#dc2626' : instr.urgency_level === 'urgent' ? '#f59e0b' : '#64748b', color: 'white', padding: '2px 8px', borderRadius: 20 }}>{(instr.urgency_level || 'normal').toUpperCase()}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{instr.profiles?.full_name} • {new Date(instr.created_at).toLocaleDateString('ms-MY')}</span>
                      </div>
                      <p style={{ fontSize: 14, color: '#1e293b', margin: '0 0 10px', lineHeight: 1.6 }}>{instr.message}</p>
                      {(instr.instruction_replies || []).length > 0 && (
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', margin: '0 0 6px' }}>REPLIES:</p>
                          {instr.instruction_replies.map(r => (
                            <div key={r.id} style={{ background: 'white', borderRadius: 6, padding: '6px 10px', marginBottom: 4, fontSize: 12 }}>
                              <span style={{ fontWeight: 600, color: '#3b82f6' }}>{r.profiles?.full_name}: </span>
                              <span style={{ color: '#475569' }}>{r.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {modalTab === 'history' && (
                <div>
                  {assignHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                      <div style={{ fontSize: 32 }}>📭</div>
                      <p>Tiada history assignment</p>
                    </div>
                  ) : assignHistory.map((h, i) => (
                    <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{h.month_year}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(h.assigned_at).toLocaleDateString('ms-MY')}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#475569' }}>
                        <span>👤 Exec: <strong>{h.exec_name || '—'}</strong></span>
                        <span style={{ marginLeft: 16 }}>🔍 Reviewer: <strong>{h.reviewer_name || '—'}</strong></span>
                        {h.data_entry_name && <span style={{ marginLeft: 16 }}>📝 DE: <strong>{h.data_entry_name}</strong></span>}
                      </div>
                      {h.ended_at && <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>Tamat: {new Date(h.ended_at).toLocaleDateString('ms-MY')}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {assigning && selectedJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 16 }}>
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
              <button onClick={saveAssignment} style={{ flex: 1, background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>✅ Simpan</button>
              <button onClick={() => { setAssigning(false) }} style={{ flex: 1, background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}