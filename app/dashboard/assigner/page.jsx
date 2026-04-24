'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AssignerDashboard() {
  const [profile, setProfile] = useState(null)
  const [jobs, setJobs] = useState([])
  const [clients, setClients] = useState([])
  const [hooList, setHooList] = useState([])
  const [serviceTypes, setServiceTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const router = useRouter()

  const [invoiceData, setInvoiceData] = useState({
    client_id: '',
    invoice_number: '',
    is_recurring: false,
    duration_months: 3,
    start_month: ''
  })

  const [jobItems, setJobItems] = useState([
    { service_type: '', invoice_value: '', job_description: '', due_date: '', assigned_hoo: '' }
  ])

  const getDivision = (serviceTypeName) => {
    const st = serviceTypes.find(s => s.name === serviceTypeName)
    return st?.division || 'advisory'
  }

  const getMonthName = (monthStr) => {
    const months = ['JAN','FEB','MAC','APR','MEI','JUN','JUL','OGO','SEP','OKT','NOV','DIS']
    const date = new Date(monthStr + '-01')
    return months[date.getMonth()]
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!p || (p.role !== 'assigner' && p.role !== 'ceo')) { router.push('/'); return }
    setProfile(p)
    fetchClients()
    fetchJobs()
    fetchHOO()
    fetchServiceTypes()
  }

  const fetchServiceTypes = async () => {
    const { data } = await supabase
      .from('service_types')
      .select('*')
      .eq('is_active', true)
      .order('division')
      .order('name')
    if (data) setServiceTypes(data)
  }

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('company_name')
    if (data) setClients(data)
  }

  const fetchJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*, clients(company_name)')
      .eq('is_osm', false)
      .order('created_at', { ascending: false })
    if (data) setJobs(data)
    setLoading(false)
  }

  const fetchHOO = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, division')
      .in('role', ['hoo', 'hoo_mp'])
      .eq('is_active', true)
    if (data) setHooList(data)
  }

  const addJobItem = () => {
    setJobItems(prev => [...prev, { service_type: '', invoice_value: '', job_description: '', due_date: '', assigned_hoo: '' }])
  }

  const removeJobItem = (index) => {
    if (jobItems.length === 1) return
    setJobItems(prev => prev.filter((_, i) => i !== index))
  }

  const updateJobItem = (index, field, value) => {
    setJobItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const generateMonthlyInvoiceNumber = (baseNumber, monthStr) => {
    return `${baseNumber}-${getMonthName(monthStr)}`
  }

  const handleCreateJobs = async (e) => {
    e.preventDefault()
    if (!invoiceData.client_id || !invoiceData.invoice_number) {
      setMessage('❌ Sila isi semua maklumat invoice!')
      return
    }
    for (const job of jobItems) {
      if (!job.service_type || !job.invoice_value || !job.due_date || !job.assigned_hoo) {
        setMessage('❌ Sila lengkapkan semua maklumat job termasuk HOO!')
        return
      }
    }
    if (invoiceData.is_recurring && !invoiceData.start_month) {
      setMessage('❌ Sila pilih bulan mula untuk recurring job!')
      return
    }

    setSaving(true)
    setMessage('')

    const jobSummaries = jobItems.map((j, i) => `Job ${i + 1}: ${j.service_type} (RM ${Number(j.invoice_value).toLocaleString()})`)

    let successCount = 0

    for (let i = 0; i < jobItems.length; i++) {
      const job = jobItems[i]
      const division = getDivision(job.service_type)
      const otherJobs = jobSummaries.filter((_, idx) => idx !== i)
      const footnote = otherJobs.length > 0 ? `\n\n📎 Job lain dalam invoice ini:\n${otherJobs.join('\n')}` : ''

      if (invoiceData.is_recurring) {
        // Create recurring job record
        const { data: recurringData, error: recurringError } = await supabase
          .from('recurring_jobs')
          .insert({
            client_id: invoiceData.client_id,
            invoice_base_number: invoiceData.invoice_number,
            service_type: job.service_type,
            division: division,
            invoice_value: parseFloat(job.invoice_value),
            job_description: (job.job_description || '') + footnote,
            assigned_hoo: job.assigned_hoo,
            duration_months: invoiceData.duration_months,
            start_month: invoiceData.start_month,
            end_month: (() => {
              const d = new Date(invoiceData.start_month + '-01')
              d.setMonth(d.getMonth() + invoiceData.duration_months - 1)
              return d.toISOString().slice(0, 7)
            })(),
            created_by: profile?.id
          })
          .select()
          .single()

        if (!recurringError && recurringData) {
          // Create first month job
          const firstMonthInvoice = generateMonthlyInvoiceNumber(invoiceData.invoice_number, invoiceData.start_month)
          const { error } = await supabase.from('jobs').insert({
            client_id: invoiceData.client_id,
            invoice_number: firstMonthInvoice,
            invoice_value: parseFloat(job.invoice_value),
            service_type: job.service_type,
            job_description: (job.job_description || '') + footnote,
            due_date: job.due_date,
            division: division,
            status: 'pending',
            completion_percentage: 0,
            is_locked: true,
            locked_at: new Date().toISOString(),
            assigned_hoo_id: job.assigned_hoo,
            recurring_job_id: recurringData.id
          })
          if (!error) successCount++
        }
      } else {
        // Normal job
        const { error } = await supabase.from('jobs').insert({
          client_id: invoiceData.client_id,
          invoice_number: invoiceData.invoice_number,
          invoice_value: parseFloat(job.invoice_value),
          service_type: job.service_type,
          job_description: (job.job_description || '') + footnote,
          due_date: job.due_date,
          division: division,
          status: 'pending',
          completion_percentage: 0,
          is_locked: true,
          locked_at: new Date().toISOString(),
          assigned_hoo_id: job.assigned_hoo
        })
        if (!error) successCount++
      }
    }

    if (successCount === jobItems.length) {
      setMessage(`✅ ${successCount} job berjaya ditambah dan dikunci!`)
      setShowForm(false)
      setInvoiceData({ client_id: '', invoice_number: '', is_recurring: false, duration_months: 3, start_month: '' })
      setJobItems([{ service_type: '', invoice_value: '', job_description: '', due_date: '', assigned_hoo: '' }])
      fetchJobs()
    } else {
      setMessage(`⚠️ ${successCount} dari ${jobItems.length} job berjaya ditambah`)
    }
    setSaving(false)
  }

  const getStatusBadge = (status) => {
    const styles = { 'pending': 'bg-yellow-100 text-yellow-700', 'in_progress': 'bg-blue-100 text-blue-700', 'review': 'bg-purple-100 text-purple-700', 'completed': 'bg-green-100 text-green-700' }
    return styles[status] || 'bg-gray-100 text-gray-700'
  }

  const getStatusLabel = (status) => {
    const labels = { 'pending': 'Belum Mula', 'in_progress': 'Sedang Berjalan', 'review': 'Review', 'completed': 'Selesai' }
    return labels[status] || status
  }

  const groupedJobs = jobs.reduce((acc, job) => {
    const key = `${job.client_id}-${job.invoice_number}`
    if (!acc[key]) acc[key] = []
    acc[key].push(job)
    return acc
  }, {})

  const taxTypes = serviceTypes.filter(s => s.division === 'tax')
  const accountTypes = serviceTypes.filter(s => s.division === 'account')
  const advisoryTypes = serviceTypes.filter(s => s.division === 'advisory')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-purple-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">AMACC PMS</h1>
          <p className="text-purple-200 text-sm">Assigner Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">{profile?.full_name}</span>
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }}
            className="bg-purple-700 hover:bg-purple-800 px-4 py-2 rounded-lg text-sm">Log Keluar</button>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Senarai Job ({jobs.length})</h2>
          <button onClick={() => setShowForm(!showForm)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {showForm ? '✕ Tutup' : '+ Tambah Job Baru'}
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg text-sm ${message.includes('❌') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="font-bold text-gray-800 text-lg mb-4">📋 Tambah Job Baru</h3>
            <form onSubmit={handleCreateJobs}>

              {/* Invoice Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">📄 Maklumat Invoice</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Klien *</label>
                    <select value={invoiceData.client_id} onChange={e => setInvoiceData({...invoiceData, client_id: e.target.value})}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" required>
                      <option value="">— Pilih Klien —</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">No. Invoice *</label>
                    <input type="text" value={invoiceData.invoice_number}
                      onChange={e => setInvoiceData({...invoiceData, invoice_number: e.target.value})}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="contoh: INV-2024-001" required />
                  </div>

                  {/* Recurring toggle */}
                  <div className="md:col-span-2">
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      <input type="checkbox" id="isRecurring" checked={invoiceData.is_recurring}
                        onChange={e => setInvoiceData({...invoiceData, is_recurring: e.target.checked})}
                        className="w-4 h-4 rounded" />
                      <label htmlFor="isRecurring" className="text-sm font-medium text-blue-700">
                        🔄 Recurring Job (Monthly)
                      </label>
                    </div>
                  </div>

                  {invoiceData.is_recurring && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Tempoh *</label>
                        <select value={invoiceData.duration_months}
                          onChange={e => setInvoiceData({...invoiceData, duration_months: parseInt(e.target.value)})}
                          className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                          <option value={3}>3 Bulan</option>
                          <option value={6}>6 Bulan</option>
                          <option value={9}>9 Bulan</option>
                          <option value={12}>12 Bulan</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Bulan Mula *</label>
                        <input type="month" value={invoiceData.start_month}
                          onChange={e => setInvoiceData({...invoiceData, start_month: e.target.value})}
                          className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                      </div>
                      <div className="md:col-span-2 bg-blue-50 p-3 rounded-lg">
                        <p className="text-xs text-blue-700">
                          📅 Invoice akan dijana: <strong>{invoiceData.invoice_number || 'INV-XXXX'}-JAN</strong>, <strong>-FEB</strong>, <strong>-MAC</strong>...
                          sampai {invoiceData.duration_months} bulan
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Job Items */}
              <div className="space-y-4">
                {jobItems.map((job, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-sm font-semibold text-gray-700">Job {index + 1}</h4>
                      {jobItems.length > 1 && (
                        <button type="button" onClick={() => removeJobItem(index)}
                          className="text-red-500 hover:text-red-700 text-xs">✕ Buang</button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Jenis Servis *</label>
                        <select value={job.service_type}
                          onChange={e => updateJobItem(index, 'service_type', e.target.value)}
                          className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" required>
                          <option value="">— Pilih Servis —</option>
                          {taxTypes.length > 0 && (
                            <optgroup label="TAX">
                              {taxTypes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </optgroup>
                          )}
                          {accountTypes.length > 0 && (
                            <optgroup label="ACCOUNT">
                              {accountTypes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </optgroup>
                          )}
                          {advisoryTypes.length > 0 && (
                            <optgroup label="ADVISORY">
                              {advisoryTypes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </optgroup>
                          )}
                        </select>
                        {job.service_type && (
                          <p className="text-xs text-gray-400 mt-1">
                            Division: {getDivision(job.service_type).toUpperCase()}
                            {serviceTypes.find(s => s.name === job.service_type)?.is_recurring && ' • 🔄 Recurring eligible'}
                            {serviceTypes.find(s => s.name === job.service_type)?.is_exempt_kiv && ' • ⏱️ KIV exempt'}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Nilai Invoice (RM) *</label>
                        <input type="number" value={job.invoice_value}
                          onChange={e => updateJobItem(index, 'invoice_value', e.target.value)}
                          className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="contoh: 9000" required />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Due Date *</label>
                        <input type="date" value={job.due_date}
                          onChange={e => updateJobItem(index, 'due_date', e.target.value)}
                          className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" required />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Assign ke HOO *</label>
                        <select value={job.assigned_hoo}
                          onChange={e => updateJobItem(index, 'assigned_hoo', e.target.value)}
                          className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" required>
                          <option value="">— Pilih HOO —</option>
                          {hooList.map(h => (
                            <option key={h.id} value={h.id}>
                              {h.full_name} ({h.role === 'hoo_mp' ? 'Master Planner' : `HOO ${h.division?.toUpperCase()}`})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700">Deskripsi / Nota</label>
                        <textarea value={job.job_description}
                          onChange={e => updateJobItem(index, 'job_description', e.target.value)}
                          className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                          placeholder="Nota penting untuk team..." rows={2} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" onClick={addJobItem}
                className="mt-3 w-full border-2 border-dashed border-gray-300 hover:border-purple-400 text-gray-500 hover:text-purple-600 py-2 rounded-lg text-sm font-medium transition">
                + Tambah Job Lagi Dalam Invoice Ini
              </button>

              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-700">⚠️ <strong>Perhatian:</strong> Job akan <strong>dikunci</strong> selepas disimpan. Hubungi CEO atau Master Planner untuk sebarang perubahan.</p>
              </div>

              <div className="flex gap-3 mt-4">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? 'Menyimpan...' : `🔒 Simpan & Kunci ${jobItems.length} Job`}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium">
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : Object.keys(groupedJobs).length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500">Tiada job lagi</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedJobs).map(([key, invoiceJobs]) => (
              <div key={key} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b flex justify-between items-center">
                  <div>
                    <span className="font-bold text-gray-800">{invoiceJobs[0].clients?.company_name}</span>
                    <span className="text-gray-500 text-sm ml-2">• {invoiceJobs[0].invoice_number}</span>
                    {invoiceJobs[0].recurring_job_id && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">🔄 Recurring</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">🔒 Dikunci</span>
                    <span className="text-xs text-gray-500">{invoiceJobs.length} job</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {invoiceJobs.map(job => (
                    <div key={job.id} className="px-5 py-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-gray-800 text-sm">{job.service_type}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(job.status)}`}>
                              {getStatusLabel(job.status)}
                            </span>
                            {job.is_kiv && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">⚠️ KIV</span>}
                          </div>
                          <p className="text-green-600 text-sm font-semibold">RM {Number(job.invoice_value).toLocaleString()}</p>
                          {job.job_description && (
                            <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{job.job_description}</p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-xs text-gray-500">Due: {job.due_date ? new Date(job.due_date).toLocaleDateString('ms-MY') : '-'}</p>
                          <p className="text-xs text-gray-400 mt-1">{job.completion_percentage || 0}% siap</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}