'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const STAGES = [
  { key: 'new_lead', label: '📥 New Lead', color: '#6366f1' },
  { key: 'contacted', label: '📞 Contacted', color: '#3b82f6' },
  { key: 'docs_collected', label: '📄 Docs Collected', color: '#06b6d4' },
  { key: 'quotation_sent', label: '💰 Quotation Sent', color: '#f59e0b' },
  { key: 'agreed', label: '✅ Agreed', color: '#10b981' },
  { key: 'rejected', label: '❌ Rejected', color: '#ef4444' },
  { key: 'kiv', label: '⏸️ KIV', color: '#8b5cf6' },
  { key: 'deposit_received', label: '💵 Deposit Received', color: '#059669' },
  { key: 'converted', label: '🧾 Converted', color: '#374151' },
]

const SERVICE_TYPES = [
  'Form C','Form B','Form E','Form TF','Form N','Form Q','Form BE',
  'Tax Audit','Tax MA','CP204','Tax Estimation',
  'Account Yearly (Current)','Account Yearly (Backlog)','Account Monthly',
  'Account In Advance','Account Dormant','Accounts Review',
  'SPC','SST Registration','Coaching & Training','Advisory services'
]

const LEAD_SOURCES = [
  { key: 'walk_in', label: '🚶 Walk In' },
  { key: 'call', label: '📞 Call' },
  { key: 'website', label: '🌐 Website' },
  { key: 'fb_ads', label: '📱 FB Ads' },
  { key: 'training', label: '🎓 Training' },
  { key: 'staff', label: '👤 Staff Referral' },
  { key: 'client', label: '🤝 Client Referral' },
]

export default function AssignerDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeStage, setActiveStage] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editLead, setEditLead] = useState(null)
  const [hooList, setHooList] = useState([])
  const [staffList, setStaffList] = useState([])
  const [clientList, setClientList] = useState([])
  const [saving, setSaving] = useState(false)
  const [clientType, setClientType] = useState('new')
  const [form, setForm] = useState({
    client_name: '', client_email: '', client_phone: '',
    service_type: '', stage: 'new_lead', quotation_amount: '',
    deposit_amount: '', deposit_date: '', rejection_reason: '',
    notes: '', assigned_to: '', lead_source: '', referral_name: '',
    existing_client_id: ''
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !['assigner', 'ceo', 'hoo_mp'].includes(prof.role)) {
      router.push('/'); return
    }
    setProfile(prof)

    // Load HOOs
    const { data: hoos } = await supabase
      .from('profiles')
      .select('id, name, role, division')
      .in('role', ['hoo', 'hoo_mp'])
      .eq('status', 'active')
      .order('name')
    setHooList(hoos || [])

    // Load all staff
    const { data: staffs } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
    setStaffList(staffs || [])

    // Load existing clients
    const { data: cls } = await supabase
      .from('clients')
      .select('id, company_name')
      .order('company_name')
    setClientList(cls || [])

    await fetchLeads()
    setLoading(false)
  }

  async function fetchLeads() {
    const { data, error } = await supabase
      .from('leads')
      .select('*, assigned_profile:assigned_to(name), creator:created_by(name)')
      .order('created_at', { ascending: false })
    console.log('leads:', data, 'error:', error)
    if (!error) setLeads(data || [])
  }

  function openNew() {
    setEditLead(null)
    setClientType('new')
    setForm({
      client_name: '', client_email: '', client_phone: '',
      service_type: '', stage: 'new_lead', quotation_amount: '',
      deposit_amount: '', deposit_date: '', rejection_reason: '',
      notes: '', assigned_to: '', lead_source: '', referral_name: '',
      existing_client_id: ''
    })
    setShowModal(true)
  }

  function openEdit(lead) {
    setEditLead(lead)
    setClientType(lead.existing_client_id ? 'existing' : 'new')
    setForm({
      client_name: lead.client_name || '',
      client_email: lead.client_email || '',
      client_phone: lead.client_phone || '',
      service_type: lead.service_type || '',
      stage: lead.stage || 'new_lead',
      quotation_amount: lead.quotation_amount || '',
      deposit_amount: lead.deposit_amount || '',
      deposit_date: lead.deposit_date || '',
      rejection_reason: lead.rejection_reason || '',
      notes: lead.notes || '',
      assigned_to: lead.assigned_to || '',
      lead_source: lead.lead_source || '',
      referral_name: lead.referral_name || '',
      existing_client_id: lead.existing_client_id || ''
    })
    setShowModal(true)
  }

  async function saveLead() {
    if (!form.client_name.trim() && clientType === 'new') {
      alert('Masukkan nama client!'); return
    }
    if (clientType === 'existing' && !form.existing_client_id) {
      alert('Pilih client!'); return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    let clientName = form.client_name
    if (clientType === 'existing' && form.existing_client_id) {
      const found = clientList.find(c => c.id === form.existing_client_id)
      if (found) clientName = found.company_name
    }

    const payload = {
      client_name: clientName,
      client_email: form.client_email || null,
      client_phone: form.client_phone || null,
      service_type: form.service_type || null,
      stage: form.stage,
      quotation_amount: form.quotation_amount ? parseFloat(form.quotation_amount) : null,
      deposit_amount: form.deposit_amount ? parseFloat(form.deposit_amount) : null,
      deposit_date: form.deposit_date || null,
      rejection_reason: form.rejection_reason || null,
      notes: form.notes || null,
      assigned_to: form.assigned_to || null,
      lead_source: form.lead_source || null,
      referral_name: form.referral_name || null,
      existing_client_id: form.existing_client_id || null,
      updated_at: new Date().toISOString()
    }

    let error
    if (editLead) {
      const { error: e } = await supabase.from('leads').update(payload).eq('id', editLead.id)
      error = e
    } else {
      const { error: e } = await supabase.from('leads').insert({ ...payload, created_by: user.id })
      error = e
    }

    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setShowModal(false)
    await fetchLeads()
  }

  // Metrics
  const totalLeads = leads.length
  const totalQuotation = leads.reduce((s, l) => s + (parseFloat(l.quotation_amount) || 0), 0)
  const totalDeposit = leads.reduce((s, l) => s + (parseFloat(l.deposit_amount) || 0), 0)
  const convertedCount = leads.filter(l => l.stage === 'converted').length
  const agreedCount = leads.filter(l => l.stage === 'agreed').length

  const filtered = activeStage === 'all' ? leads : leads.filter(l => l.stage === activeStage)
  const stageCounts = {}
  STAGES.forEach(s => { stageCounts[s.key] = leads.filter(l => l.stage === s.key).length })

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'white', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>AMACC PMS</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>{profile?.name} • CRM Pipeline</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={openNew}
            style={{ padding: '8px 16px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            + New Lead
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
            style={{ padding: '8px 16px', background: '#fee2e2', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
            Keluar
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ padding: '20px 24px 0', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Leads', value: totalLeads, color: '#6366f1', bg: '#eef2ff' },
          { label: 'Agreed', value: agreedCount, color: '#10b981', bg: '#ecfdf5' },
          { label: 'Converted', value: convertedCount, color: '#374151', bg: '#f1f5f9' },
          { label: 'Total Quotation', value: `RM ${totalQuotation.toLocaleString()}`, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Deposit Received', value: `RM ${totalDeposit.toLocaleString()}`, color: '#059669', bg: '#ecfdf5' },
        ].map((m, i) => (
          <div key={i} style={{ background: m.bg, borderRadius: 12, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Stage Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', gap: 4, overflowX: 'auto', marginTop: 20 }}>
        <button onClick={() => setActiveStage('all')}
          style={{ padding: '12px 16px', border: 'none', borderBottom: activeStage === 'all' ? '3px solid #6366f1' : '3px solid transparent', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeStage === 'all' ? 700 : 400, whiteSpace: 'nowrap' }}>
          Semua ({leads.length})
        </button>
        {STAGES.map(s => (
          <button key={s.key} onClick={() => setActiveStage(s.key)}
            style={{ padding: '12px 16px', border: 'none', borderBottom: activeStage === s.key ? `3px solid ${s.color}` : '3px solid transparent', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeStage === s.key ? 700 : 400, whiteSpace: 'nowrap', color: activeStage === s.key ? s.color : '#374151' }}>
            {s.label} ({stageCounts[s.key] || 0})
          </button>
        ))}
      </div>

      {/* Leads List */}
      <div style={{ padding: 24 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div>Tiada leads dalam stage ini</div>
            <button onClick={openNew} style={{ marginTop: 16, padding: '10px 20px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              + Tambah Lead Baru
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.map(lead => {
              const stage = STAGES.find(s => s.key === lead.stage)
              const source = LEAD_SOURCES.find(s => s.key === lead.lead_source)
              return (
                <div key={lead.id} onClick={() => openEdit(lead)}
                  style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 16 }}>{lead.client_name}</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: lead.existing_client_id ? '#dbeafe' : '#dcfce7', color: lead.existing_client_id ? '#1d4ed8' : '#16a34a' }}>
                          {lead.existing_client_id ? 'Existing' : 'New'}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {lead.service_type && <span>🔧 {lead.service_type}</span>}
                        {lead.client_phone && <span>📞 {lead.client_phone}</span>}
                        {source && <span style={{ color: '#6366f1' }}>{source.label}{lead.referral_name ? ` — ${lead.referral_name}` : ''}</span>}
                      </div>
                      {lead.notes && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>📝 {lead.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{ padding: '4px 12px', borderRadius: 20, background: stage?.color + '20', color: stage?.color, fontSize: 12, fontWeight: 600 }}>
                        {stage?.label}
                      </span>
                      {lead.quotation_amount && <span style={{ fontSize: 13, fontWeight: 600 }}>RM {parseFloat(lead.quotation_amount).toLocaleString()}</span>}
                      {lead.assigned_profile?.name && <span style={{ fontSize: 11, color: '#94a3b8' }}>→ {lead.assigned_profile.name}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 8 }}>
                    {new Date(lead.created_at).toLocaleDateString('ms-MY')} • {lead.creator?.name || 'Unknown'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* FULLSCREEN Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'white', zIndex: 1000, overflowY: 'auto' }}>
          <div style={{ position: 'sticky', top: 0, background: 'white', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{editLead ? '✏️ Edit Lead' : '📥 New Lead'}</h2>
            <button onClick={() => setShowModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14 }}>✕ Tutup</button>
          </div>

          <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px' }}>
            <div style={{ display: 'grid', gap: 20 }}>

              {/* New / Existing Toggle */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Jenis Client</label>
                <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', width: 'fit-content' }}>
                  <button onClick={() => setClientType('new')}
                    style={{ padding: '10px 24px', border: 'none', background: clientType === 'new' ? '#6366f1' : 'white', color: clientType === 'new' ? 'white' : '#374151', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                    🆕 New Client
                  </button>
                  <button onClick={() => setClientType('existing')}
                    style={{ padding: '10px 24px', border: 'none', background: clientType === 'existing' ? '#6366f1' : 'white', color: clientType === 'existing' ? 'white' : '#374151', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                    🏢 Existing Client
                  </button>
                </div>
              </div>

              {/* Client Name / Existing Dropdown */}
              {clientType === 'new' ? (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nama Client *</label>
                  <input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 15, boxSizing: 'border-box' }}
                    placeholder="Nama syarikat atau individu" />
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Pilih Client *</label>
                  <select value={form.existing_client_id} onChange={e => setForm({ ...form, existing_client_id: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}>
                    <option value="">-- Pilih Client --</option>
                    {clientList.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
              )}

              {/* Email & Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Email</label>
                  <input value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                    placeholder="email@client.com" />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Phone</label>
                  <input value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                    placeholder="01X-XXXXXXX" />
                </div>
              </div>

              {/* Source of Lead */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Source of Lead</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {LEAD_SOURCES.map(s => (
                    <button key={s.key} onClick={() => setForm({ ...form, lead_source: s.key, referral_name: '' })}
                      style={{ padding: '8px 16px', borderRadius: 20, border: '2px solid', borderColor: form.lead_source === s.key ? '#6366f1' : '#e2e8f0', background: form.lead_source === s.key ? '#eef2ff' : 'white', color: form.lead_source === s.key ? '#6366f1' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: form.lead_source === s.key ? 700 : 400 }}>
                      {s.label}
                    </button>
                  ))}
                </div>
                {(form.lead_source === 'staff' || form.lead_source === 'client') && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      {form.lead_source === 'staff' ? '👤 Nama Staff' : '🤝 Nama Client yang Refer'}
                    </label>
                    {form.lead_source === 'staff' ? (
                      <select value={form.referral_name} onChange={e => setForm({ ...form, referral_name: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}>
                        <option value="">-- Pilih Staff --</option>
                        {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    ) : (
                      <input value={form.referral_name} onChange={e => setForm({ ...form, referral_name: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                        placeholder="Nama client yang refer" />
                    )}
                  </div>
                )}
              </div>

              {/* Service Type & Stage */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Service Type</label>
                  <select value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}>
                    <option value="">-- Pilih --</option>
                    {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Stage</label>
                  <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}>
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Quotation & Deposit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Quotation Amount (RM)</label>
                  <input type="number" value={form.quotation_amount} onChange={e => setForm({ ...form, quotation_amount: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                    placeholder="0.00" />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Deposit Amount (RM)</label>
                  <input type="number" value={form.deposit_amount} onChange={e => setForm({ ...form, deposit_amount: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                    placeholder="0.00" />
                </div>
              </div>

              {(form.stage === 'deposit_received' || form.deposit_amount) && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Tarikh Deposit</label>
                  <input type="date" value={form.deposit_date} onChange={e => setForm({ ...form, deposit_date: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              )}

              {form.stage === 'rejected' && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Sebab Reject</label>
                  <input value={form.rejection_reason} onChange={e => setForm({ ...form, rejection_reason: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                    placeholder="Kenapa client reject?" />
                </div>
              )}

              {/* Assign ke HOO */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Assign ke HOO</label>
                <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}>
                  <option value="">-- Belum assign --</option>
                  {hooList.map(h => <option key={h.id} value={h.id}>{h.name} ({h.role === 'hoo_mp' ? 'HOO-MP' : 'HOO'} {h.division})</option>)}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', minHeight: 100, resize: 'vertical' }}
                  placeholder="Nota tambahan..." />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12, paddingTop: 8, paddingBottom: 40 }}>
                <button onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '12px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}>
                  Batal
                </button>
                <button onClick={saveLead} disabled={saving}
                  style={{ flex: 2, padding: '12px', background: saving ? '#a5b4fc' : '#6366f1', color: 'white', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 600 }}>
                  {saving ? 'Menyimpan...' : '💾 Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}