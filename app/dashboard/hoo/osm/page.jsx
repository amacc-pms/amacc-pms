'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function OSMDashboard() {
  const [profile, setProfile] = useState(null)
  const [osmList, setOsmList] = useState([])
  const [jobs, setJobs] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedOsm, setSelectedOsm] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const [formData, setFormData] = useState({
    job_id: '',
    auditor_email_date: '',
    auditor_email_summary: '',
    issue_description: '',
    hoo_guide: '',
    assigned_to: '',
    due_date: '',
    issue_category: 'technical',
    is_competency_issue: false
  })

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
    // Load OSM tasks
    const { data: osm } = await supabase
      .from('osm_tasks')
      .select(`*, jobs(invoice_number, service_type, clients(company_name)), assigned_to_profile:profiles!osm_tasks_assigned_to_fkey(full_name), created_by_profile:profiles!osm_tasks_created_by_fkey(full_name)`)
      .order('created_at', { ascending: false })
    setOsmList(osm || [])

    // Load jobs
    const { data: jobsData } = await supabase
      .from('jobs')
      .select('id, invoice_number, service_type, clients(company_name)')
      .order('created_at', { ascending: false })
    setJobs(jobsData || [])

    // Load profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name')
    setProfiles(profilesData || [])

    setLoading(false)
  }

  async function createOSM() {
    if (!formData.job_id || !formData.issue_description) {
      alert('Job dan Issue Description wajib diisi!')
      return
    }
    setSaving(true)

    // Get round number
    const { data: existing } = await supabase
      .from('osm_tasks')
      .select('round_number')
      .eq('job_id', formData.job_id)
      .order('round_number', { ascending: false })
      .limit(1)

    const roundNumber = existing && existing.length > 0 ? existing[0].round_number + 1 : 1

    // Get job invoice number
    const job = jobs.find(j => j.id === formData.job_id)
    const refNumber = `${job?.invoice_number}-OSM-R${roundNumber}`

    const { error } = await supabase.from('osm_tasks').insert({
      ...formData,
      round_number: roundNumber,
      reference_number: refNumber,
      created_by: profile.id,
      assigned_by: profile.id,
      status: 'open'
    })

    if (error) { alert('Error: ' + error.message); setSaving(false); return }

    // Create notification for assigned staff
    if (formData.assigned_to) {
      await supabase.from('osm_notifications').insert({
        osm_id: null,
        recipient_id: formData.assigned_to,
        message: `OSM baru assigned kepada anda: ${refNumber} — ${formData.issue_description.substring(0, 50)}...`
      })
    }

    setMessage('✅ OSM berjaya dicipta!')
    setTimeout(() => setMessage(''), 3000)
    setShowCreate(false)
    setFormData({ job_id: '', auditor_email_date: '', auditor_email_summary: '', issue_description: '', hoo_guide: '', assigned_to: '', due_date: '', issue_category: 'technical', is_competency_issue: false })
    setSaving(false)
    await loadData()
  }

  async function updateOsmStatus(osmId, newStatus, notes) {
    const updates = { status: newStatus, updated_at: new Date().toISOString() }
    if (newStatus === 'resolved') {
      updates.resolved_at = new Date().toISOString()
      updates.resolved_by = profile.id
    }
    if (notes) updates.staff_notes = notes

    await supabase.from('osm_tasks').update(updates).eq('id', osmId)
    setMessage('✅ Status dikemaskini!')
    setTimeout(() => setMessage(''), 3000)
    setSelectedOsm(null)
    await loadData()
  }

  function getStatusBadge(status) {
    const config = {
      open: { color: 'bg-red-100 text-red-700', label: '🔴 Open' },
      in_progress: { color: 'bg-blue-100 text-blue-700', label: '🔵 In Progress' },
      replied: { color: 'bg-yellow-100 text-yellow-700', label: '🟡 Replied' },
      resolved: { color: 'bg-green-100 text-green-700', label: '🟢 Resolved' },
    }
    const c = config[status] || config.open
    return <span className={`px-2 py-1 rounded text-xs font-medium ${c.color}`}>{c.label}</span>
  }

  function getCategoryBadge(category) {
    const config = {
      technical: 'bg-purple-100 text-purple-700',
      documentation: 'bg-blue-100 text-blue-700',
      communication: 'bg-orange-100 text-orange-700',
      compliance: 'bg-red-100 text-red-700',
      other: 'bg-gray-100 text-gray-700',
    }
    return <span className={`px-2 py-1 rounded text-xs ${config[category] || config.other}`}>{category}</span>
  }

  const filteredOsm = filterStatus === 'all' ? osmList : osmList.filter(o => o.status === filterStatus)

  const stats = {
    total: osmList.length,
    open: osmList.filter(o => o.status === 'open').length,
    in_progress: osmList.filter(o => o.status === 'in_progress').length,
    resolved: osmList.filter(o => o.status === 'resolved').length,
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-500">Loading...</div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-purple-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <div className="font-bold text-lg">AMACC PMS</div>
          <div className="text-sm opacity-80">OSM — Outstanding Matters</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/hoo')} className="bg-white text-purple-600 px-3 py-1 rounded text-sm font-medium">← Balik</button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">📋 Outstanding Matters (OSM)</h1>
          <button onClick={() => setShowCreate(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700">
            + Cipta OSM Baru
          </button>
        </div>

        {message && <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-green-700">{message}</div>}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total OSM', value: stats.total, color: 'text-gray-800' },
            { label: 'Open', value: stats.open, color: 'text-red-500' },
            { label: 'In Progress', value: stats.in_progress, color: 'text-blue-500' },
            { label: 'Resolved', value: stats.resolved, color: 'text-green-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg border p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {['all', 'open', 'in_progress', 'replied', 'resolved'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-lg text-sm font-medium capitalize ${filterStatus === s ? 'bg-purple-600 text-white' : 'bg-white border text-gray-600'}`}>
              {s === 'all' ? 'Semua' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* OSM List */}
        <div className="space-y-4">
          {filteredOsm.length === 0 ? (
            <div className="bg-white rounded-lg border p-8 text-center text-gray-400">Tiada OSM {filterStatus !== 'all' ? `dengan status ${filterStatus}` : ''}</div>
          ) : filteredOsm.map(osm => (
            <div key={osm.id} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-purple-700">{osm.reference_number}</span>
                    {getStatusBadge(osm.status)}
                    {getCategoryBadge(osm.issue_category)}
                    {osm.is_competency_issue && <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">⚠️ Competency</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-800">{osm.jobs?.clients?.company_name}</p>
                  <p className="text-xs text-gray-500">{osm.jobs?.invoice_number} • {osm.jobs?.service_type}</p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  {osm.due_date && <div>Due: {new Date(osm.due_date).toLocaleDateString('ms-MY')}</div>}
                  <div>Round {osm.round_number}</div>
                </div>
              </div>

              {osm.auditor_email_date && (
                <div className="bg-yellow-50 rounded p-2 mb-2 text-xs">
                  <span className="font-medium text-yellow-700">📧 Email Auditor:</span>
                  <span className="text-gray-600 ml-1">{new Date(osm.auditor_email_date).toLocaleDateString('ms-MY')}</span>
                  {osm.auditor_email_summary && <p className="text-gray-600 mt-1">{osm.auditor_email_summary}</p>}
                </div>
              )}

              <div className="bg-gray-50 rounded p-2 mb-2 text-sm text-gray-700">
                <span className="font-medium">Issue:</span> {osm.issue_description}
              </div>

              {osm.hoo_guide && (
                <div className="bg-blue-50 rounded p-2 mb-2 text-sm text-blue-700">
                  <span className="font-medium">Guide HOO:</span> {osm.hoo_guide}
                </div>
              )}

              <div className="flex justify-between items-center mt-3">
                <div className="text-xs text-gray-500">
                  Assigned: <span className="font-medium text-gray-700">{osm.assigned_to_profile?.full_name || '-'}</span>
                </div>
                {osm.status !== 'resolved' && (
                  <button onClick={() => setSelectedOsm(osm)} className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium hover:bg-purple-200">
                    ✏️ Update Status
                  </button>
                )}
              </div>

              {osm.staff_notes && (
                <div className="mt-2 bg-green-50 rounded p-2 text-xs text-green-700">
                  <span className="font-medium">Notes Staff:</span> {osm.staff_notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create OSM Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg my-4">
            <h2 className="text-lg font-bold mb-4">📋 Cipta OSM Baru</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job (Wajib)</label>
                <select value={formData.job_id} onChange={e => setFormData({...formData, job_id: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">-- Pilih Job --</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.clients?.company_name} — {j.invoice_number} ({j.service_type})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tarikh Email Auditor</label>
                <input type="date" value={formData.auditor_email_date} onChange={e => setFormData({...formData, auditor_email_date: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Summary Email Auditor</label>
                <textarea rows={2} value={formData.auditor_email_summary} onChange={e => setFormData({...formData, auditor_email_summary: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ringkasan isi email auditor..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issue Description (Wajib)</label>
                <textarea rows={3} value={formData.issue_description} onChange={e => setFormData({...formData, issue_description: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Huraikan issue yang perlu diselesaikan..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Guide untuk Staff</label>
                <textarea rows={2} value={formData.hoo_guide} onChange={e => setFormData({...formData, hoo_guide: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Arahan/guide untuk staff..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Kepada</label>
                <select value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">-- Pilih Staff --</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori Issue</label>
                  <select value={formData.issue_category} onChange={e => setFormData({...formData, issue_category: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="technical">Technical</option>
                    <option value="documentation">Documentation</option>
                    <option value="communication">Communication</option>
                    <option value="compliance">Compliance</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="competency" checked={formData.is_competency_issue} onChange={e => setFormData({...formData, is_competency_issue: e.target.checked})} className="w-4 h-4" />
                <label htmlFor="competency" className="text-sm font-medium text-red-600">⚠️ Tag sebagai Competency Issue</label>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={createOSM} disabled={saving} className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">
                {saving ? 'Menyimpan...' : '✅ Cipta OSM'}
              </button>
              <button onClick={() => setShowCreate(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {selectedOsm && (
        <UpdateStatusModal osm={selectedOsm} onClose={() => setSelectedOsm(null)} onSave={updateOsmStatus} profile={profile} />
      )}
    </div>
  )
}

function UpdateStatusModal({ osm, onClose, onSave, profile }) {
  const [status, setStatus] = useState(osm.status)
  const [notes, setNotes] = useState(osm.staff_notes || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(osm.id, status, notes)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-1">Update Status OSM</h2>
        <p className="text-sm text-gray-500 mb-4">{osm.reference_number}</p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status Baru</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="open">🔴 Open</option>
              <option value="in_progress">🔵 In Progress</option>
              <option value="replied">🟡 Replied</option>
              <option value="resolved">🟢 Resolved</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Action Taken</label>
            <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Huraikan apa yang dah dibuat..." />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">
            {saving ? 'Menyimpan...' : '💾 Simpan'}
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium">Batal</button>
        </div>
      </div>
    </div>
  )
}