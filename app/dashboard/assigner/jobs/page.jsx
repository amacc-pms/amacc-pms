'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

const SERVICE_TYPES = {
  tax: [
    'Form C', 'Form B', 'Form E', 'Form TF', 'Form N', 'Form Q', 'Form BE',
    'Tax Audit', 'Tax MA', 'CP204', 'Tax Estimation'
  ],
  accounting: [
    'Account Yearly (Current)', 'Account Yearly (Backlog)', 'Account Monthly',
    'Account In Advance', 'Account Dormant', 'Accounts Review'
  ],
  advisory: [
    'SPC', 'SST Registration', 'Coaching & Training', 'Advisory services'
  ]
}

const getDivision = (serviceType) => {
  for (const [division, services] of Object.entries(SERVICE_TYPES)) {
    if (services.includes(serviceType)) return division
  }
  return null
}

export default function AssignerJobs() {
  const [jobs, setJobs] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    client_id: '',
    invoice_number: '',
    invoice_value: '',
    job_description: '',
    service_type: '',
    due_date: '',
    budgeted_hours: ''
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchJobs()
    fetchClients()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || !['ceo', 'assigner'].includes(profile.role)) router.push('/')
  }

  const fetchJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select(`
        *,
        clients (company_name)
      `)
      .order('created_at', { ascending: false })
    if (data) setJobs(data)
    setLoading(false)
  }

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, company_name')
      .eq('is_active', true)
      .order('company_name')
    if (data) setClients(data)
  }

  const handleCreateJob = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    const division = getDivision(formData.service_type)

    const { error } = await supabase
      .from('jobs')
      .insert({
        client_id: formData.client_id,
        invoice_number: formData.invoice_number,
        invoice_value: parseFloat(formData.invoice_value),
        job_description: formData.job_description,
        service_type: formData.service_type,
        division: division,
        due_date: formData.due_date || null,
        budgeted_hours: formData.budgeted_hours ? parseFloat(formData.budgeted_hours) : null,
        status: 'pending',
        created_by: user.id
      })

    if (error) {
      setMessage('❌ Error: ' + error.message)
      setSaving(false)
      return
    }

    setMessage('✅ Job berjaya dicipta! HOO akan assign staff.')
    setFormData({
      client_id: '', invoice_number: '', invoice_value: '',
      job_description: '', service_type: '', due_date: '', budgeted_hours: ''
    })
    setShowForm(false)
    fetchJobs()
    setSaving(false)
  }

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-700',
      in_progress: 'bg-blue-100 text-blue-700',
      review: 'bg-purple-100 text-purple-700',
      completed: 'bg-green-100 text-green-700',
      on_hold: 'bg-gray-100 text-gray-700'
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  const getDivisionBadge = (division) => {
    const colors = {
      tax: 'bg-orange-100 text-orange-700',
      accounting: 'bg-blue-100 text-blue-700',
      advisory: 'bg-purple-100 text-purple-700'
    }
    return colors[division] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">AMACC PMS</h1>
          <p className="text-blue-200 text-sm">Job Management</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/ceo')}
          className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg text-sm"
        >
          ← Balik Dashboard
        </button>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            Senarai Jobs ({jobs.length})
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            + Cipta Job Baru
          </button>
        </div>

        {message && (
          <div className={`p-3 rounded-lg mb-4 ${message.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}

        {/* Create Job Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-xl shadow-sm border mb-6">
            <h3 className="font-bold text-gray-800 mb-4">Cipta Job Baru</h3>
            <form onSubmit={handleCreateJob} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Klien *</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Pilih Klien --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Invoice *</label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="contoh: INV-2024-001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nilai Invoice (RM) *</label>
                <input
                  type="number"
                  value={formData.invoice_value}
                  onChange={(e) => setFormData({...formData, invoice_value: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="contoh: 9000"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Perkhidmatan *</label>
                <select
                  value={formData.service_type}
                  onChange={(e) => setFormData({...formData, service_type: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Pilih Jenis Perkhidmatan --</option>
                  <optgroup label="🧾 TAX">
                    {SERVICE_TYPES.tax.map(s => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                  <optgroup label="📊 ACCOUNTING">
                    {SERVICE_TYPES.accounting.map(s => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                  <optgroup label="💼 ADVISORY">
                    {SERVICE_TYPES.advisory.map(s => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                </select>
                {formData.service_type && (
                  <p className="text-xs text-blue-600 mt-1">
                    ✓ Auto-route ke: <strong>{getDivision(formData.service_type)?.toUpperCase()}</strong> HOO
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Job *</label>
                <textarea
                  value={formData.job_description}
                  onChange={(e) => setFormData({...formData, job_description: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Huraikan skop kerja dengan detail — staff WAJIB baca ini sebelum mula kerja"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budgeted Hours</label>
                <input
                  type="number"
                  value={formData.budgeted_hours}
                  onChange={(e) => setFormData({...formData, budgeted_hours: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="contoh: 20"
                />
              </div>

              <div className="md:col-span-2 flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Cipta Job'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Jobs List */}
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-500">Belum ada job. Klik "+ Cipta Job Baru" untuk mula.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Klien</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Invoice</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nilai (RM)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Servis</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Division</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Due Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {job.clients?.company_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{job.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-600">
                      RM {parseFloat(job.invoice_value).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{job.service_type}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDivisionBadge(job.division)}`}>
                        {job.division?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {job.due_date ? new Date(job.due_date).toLocaleDateString('ms-MY') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(job.status)}`}>
                        {job.status?.toUpperCase()}
                      </span>
                    </td>
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