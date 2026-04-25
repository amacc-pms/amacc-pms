'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function StaffOSM() {
  const [profile, setProfile] = useState(null)
  const [osmList, setOsmList] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOsm, setSelectedOsm] = useState(null)
  const [notes, setNotes] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof) { router.push('/'); return }
    setProfile(prof)
    await loadOSM(prof.id)
  }

  async function loadOSM(staffId) {
    const { data } = await supabase
      .from('osm_tasks')
      .select(`*, jobs(invoice_number, service_type, clients(company_name))`)
      .eq('assigned_to', staffId)
      .order('created_at', { ascending: false })
    setOsmList(data || [])
    setLoading(false)
  }

  async function updateStatus() {
    if (!newStatus) { alert('Pilih status baru!'); return }
    setSaving(true)

    const updates = {
      status: newStatus,
      staff_notes: notes,
      updated_at: new Date().toISOString()
    }
    if (newStatus === 'resolved') {
      updates.resolved_at = new Date().toISOString()
      updates.resolved_by = profile.id
    }

    await supabase.from('osm_tasks').update(updates).eq('id', selectedOsm.id)

    setMessage('✅ Status berjaya dikemaskini!')
    setTimeout(() => setMessage(''), 3000)
    setSelectedOsm(null)
    setNotes('')
    setNewStatus('')
    setSaving(false)
    await loadOSM(profile.id)
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

  function isOverdue(osm) {
    if (!osm.due_date || osm.status === 'resolved') return false
    return new Date(osm.due_date) < new Date()
  }

  function isPending24h(osm) {
    if (osm.status !== 'open') return false
    const created = new Date(osm.created_at)
    const now = new Date()
    const diffHours = (now - created) / (1000 * 60 * 60)
    return diffHours > 24
  }

  const filteredOsm = filterStatus === 'all' ? osmList : osmList.filter(o => o.status === filterStatus)
  const pendingCount = osmList.filter(o => o.status !== 'resolved').length

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-500">Loading...</div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-purple-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <div className="font-bold text-lg">AMACC PMS</div>
          <div className="text-sm opacity-80">OSM — Outstanding Matters Saya</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm">{profile?.full_name}</span>
          <button onClick={() => router.push('/dashboard/staff')} className="bg-white text-purple-600 px-3 py-1 rounded text-sm font-medium">← Dashboard</button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">📋 OSM Saya</h1>
        <p className="text-sm text-gray-500 mb-6">Outstanding matters yang perlu diselesaikan</p>

        {message && <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-green-700">{message}</div>}

        {/* Alert kalau ada pending */}
        {pendingCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 font-medium">⚠️ Awak ada {pendingCount} OSM yang belum selesai!</p>
            <p className="text-red-600 text-sm">Sila kemaskini status secepat mungkin.</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: osmList.length, color: 'text-gray-800' },
            { label: 'Open', value: osmList.filter(o => o.status === 'open').length, color: 'text-red-500' },
            { label: 'In Progress', value: osmList.filter(o => o.status === 'in_progress').length, color: 'text-blue-500' },
            { label: 'Resolved', value: osmList.filter(o => o.status === 'resolved').length, color: 'text-green-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg border p-3 text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
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
            <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
              {filterStatus === 'all' ? '✅ Tiada OSM assigned kepada awak' : `Tiada OSM dengan status ${filterStatus}`}
            </div>
          ) : filteredOsm.map(osm => (
            <div key={osm.id} className={`bg-white rounded-lg border p-5 ${isOverdue(osm) ? 'border-red-300' : isPending24h(osm) ? 'border-orange-300' : 'border-gray-200'}`}>
              
              {/* Overdue / 24h warning */}
              {isOverdue(osm) && (
                <div className="bg-red-50 rounded p-2 mb-3 text-xs text-red-600 font-medium">🚨 OVERDUE — Sila selesaikan segera!</div>
              )}
              {!isOverdue(osm) && isPending24h(osm) && (
                <div className="bg-orange-50 rounded p-2 mb-3 text-xs text-orange-600 font-medium">⏰ Lebih 24 jam belum ada tindakan!</div>
              )}

              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-purple-700">{osm.reference_number}</span>
                    {getStatusBadge(osm.status)}
                    {osm.is_competency_issue && <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">⚠️ Competency</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-800">{osm.jobs?.clients?.company_name}</p>
                  <p className="text-xs text-gray-500">{osm.jobs?.invoice_number} • {osm.jobs?.service_type}</p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  {osm.due_date && (
                    <div className={isOverdue(osm) ? 'text-red-500 font-medium' : ''}>
                      Due: {new Date(osm.due_date).toLocaleDateString('ms-MY')}
                    </div>
                  )}
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
                  <span className="font-medium">💡 Guide HOO:</span> {osm.hoo_guide}
                </div>
              )}

              {osm.staff_notes && (
                <div className="bg-green-50 rounded p-2 mb-2 text-xs text-green-700">
                  <span className="font-medium">📝 Notes saya:</span> {osm.staff_notes}
                </div>
              )}

              {osm.status !== 'resolved' && (
                <button
                  onClick={() => { setSelectedOsm(osm); setNewStatus(osm.status); setNotes(osm.staff_notes || '') }}
                  className="mt-2 w-full bg-purple-100 text-purple-700 py-2 rounded-lg text-sm font-medium hover:bg-purple-200"
                >
                  ✏️ Kemaskini Status & Notes
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Update Modal */}
      {selectedOsm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-1">Kemaskini OSM</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedOsm.reference_number}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status Baru</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="open">🔴 Open</option>
                  <option value="in_progress">🔵 In Progress</option>
                  <option value="replied">🟡 Replied to Auditor</option>
                  <option value="resolved">🟢 Resolved</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Apa Yang Dah Dibuat</label>
                <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Terangkan tindakan yang dah diambil..." />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={updateStatus} disabled={saving}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">
                {saving ? 'Menyimpan...' : '💾 Simpan'}
              </button>
              <button onClick={() => { setSelectedOsm(null); setNotes(''); setNewStatus('') }}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}