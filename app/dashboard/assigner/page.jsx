'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

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
  'Form C', 'Form B', 'Form E', 'Form TF', 'Form N', 'Form Q', 'Form BE',
  'Tax Audit', 'Tax MA', 'CP204', 'Tax Estimation',
  'Account Yearly (Current)', 'Account Yearly (Backlog)', 'Account Monthly',
  'Account In Advance', 'Account Dormant', 'Accounts Review',
  'SPC', 'SST Registration', 'Coaching & Training', 'Advisory services'
]

export default function AssignerDashboard() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [profile, setProfile] = useState(null)
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeStage, setActiveStage] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editLead, setEditLead] = useState(null)
  const [hooList, setHooList] = useState([])
  const [form, setForm] = useState({
    client_name: '', client_email: '', client_phone: '',
    service_type: '', stage: 'new_lead', quotation_amount: '',
    deposit_amount: '', deposit_date: '', rejection_reason: '',
    notes: '', assigned_to: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !['assigner', 'ceo', 'hoo_mp'].includes(prof.role)) {
      router.push('/'); return
    }
    setProfile(prof)

    // Load HOO list untuk assign
    const { data: hoos } = await supabase
      .from('profiles')
      .select('id, name, role, division')
      .in('role', ['hoo', 'hoo_mp'])
      .eq('status', 'active')
    setHooList(hoos || [])

    // Load leads
    const { data: leadsData } = await supabase
      .from('leads')
      .select('*, assigned_profile:assigned_to(name), creator:created_by(name)')
      .order('created_at', { ascending: false })
    setLeads(leadsData || [])
    setLoading(false)
  }

  function openNew() {
    setEditLead(null)
    setForm({
      client_name: '', client_email: '', client_phone: '',
      service_type: '', stage: 'new_lead', quotation_amount: '',
      deposit_amount: '', deposit_date: '', rejection_reason: '',
      notes: '', assigned_to: ''
    })
    setShowModal(true)
  }

  function openEdit(lead) {
    setEditLead(lead)
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
      assigned_to: lead.assigned_to || ''
    })
    setShowModal(true)
  }

  async function saveLead() {
    if (!form.client_name.trim()) { alert('Masukkan nama client!'); return }

    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      ...form,
      quotation_amount: form.quotation_amount ? parseFloat(form.quotation_amount) : null,
      deposit_amount: form.deposit_amount ? parseFloat(form.deposit_amount) : null,
      deposit_date: form.deposit_date || null,
      assigned_to: form.assigned_to || null,
      updated_at: new Date().toISOString()
    }

    if (editLead) {
      await supabase.from('leads').update(payload).eq('id', editLead.id)
    } else {
      await supabase.from('leads').insert({ ...payload, created_by: user.id })
    }

    setShowModal(false)
    loadData()
  }

  const filtered = activeStage === 'all' ? leads : leads.filter(l => l.stage === activeStage)
  const stageCounts = {}
  STAGES.forEach(s => { stageCounts[s.key] = leads.filter(l => l.stage === s.key).length })

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'white', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>AMACC PMS</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>{profile?.name} • CRM Pipeline</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => router.push('/dashboard/assigner/jobs')}
            style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
            📋 Active Jobs
          </button>
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

      {/* Stage Filter Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', gap: 4, overflowX: 'auto' }}>
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
              return (
                <div key={lead.id} onClick={() => openEdit(lead)}
                  style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{lead.client_name}</div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                        {lead.service_type && <span style={{ marginRight: 12 }}>🔧 {lead.service_type}</span>}
                        {lead.client_phone && <span style={{ marginRight: 12 }}>📞 {lead.client_phone}</span>}
                        {lead.client_email && <span>✉️ {lead.client_email}</span>}
                      </div>
                      {lead.notes && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>📝 {lead.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{ padding: '4px 12px', borderRadius: 20, background: stage?.color + '20', color: stage?.color, fontSize: 12, fontWeight: 600 }}>
                        {stage?.label}
                      </span>
                      {lead.quotation_amount && (
                        <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>
                          RM {parseFloat(lead.quotation_amount).toLocaleString()}
                        </span>
                      )}
                      {lead.assigned_profile?.name && (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>→ {lead.assigned_profile.name}</span>
                      )}
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

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{editLead ? '✏️ Edit Lead' : '+ New Lead'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nama Client *</label>
                <input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                  placeholder="Nama syarikat atau individu" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Email</label>
                  <input value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                    placeholder="email@client.com" />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Phone</label>
                  <input value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                    placeholder="01X-XXXXXXX" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Service Type</label>
                  <select value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}>
                    <option value="">-- Pilih --</option>
                    {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Stage</label>
                  <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}>
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Quotation Amount (RM)</label>
                  <input type="number" value={form.quotation_amount} onChange={e => setForm({ ...form, quotation_amount: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                    placeholder="0.00" />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Deposit Amount (RM)</label>
                  <input type="number" value={form.deposit_amount} onChange={e => setForm({ ...form, deposit_amount: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                    placeholder="0.00" />
                </div>
              </div>

              {(form.stage === 'deposit_received' || form.deposit_amount) && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Tarikh Deposit</label>
                  <input type="date" value={form.deposit_date} onChange={e => setForm({ ...form, deposit_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              )}

              {form.stage === 'rejected' && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Sebab Reject</label>
                  <input value={form.rejection_reason} onChange={e => setForm({ ...form, rejection_reason: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                    placeholder="Kenapa client reject?" />
                </div>
              )}

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Assign ke HOO</label>
                <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}>
                  <option value="">-- Belum assign --</option>
                  {hooList.map(h => <option key={h.id} value={h.id}>{h.name} ({h.role === 'hoo_mp' ? 'HOO-MP' : 'HOO'} {h.division})</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', minHeight: 80, resize: 'vertical' }}
                  placeholder="Nota tambahan..." />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)}
                style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
                Batal
              </button>
              <button onClick={saveLead}
                style={{ flex: 2, padding: '10px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                💾 Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}