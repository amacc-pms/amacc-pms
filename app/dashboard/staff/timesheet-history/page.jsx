'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function TimesheetHistoryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const jobId = searchParams.get('job')
  const [logs, setLogs] = useState([])
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterName, setFilterName] = useState('')
  const [filterMonth, setFilterMonth] = useState('')

  useEffect(() => {
    if (jobId) loadHistory()
  }, [jobId])

  async function loadHistory() {
    setLoading(true)
    const { data: jobData } = await supabase
      .from('jobs')
      .select('*, clients(company_name)')
      .eq('id', jobId)
      .single()
    setJob(jobData)
    const { data: logData } = await supabase
      .from('timesheets')
      .select('*, profiles(full_name, position)')
      .eq('job_id', jobId)
      .order('log_date', { ascending: false })
    setLogs(logData || [])
    setLoading(false)
  }

  const staffNames = [...new Set((logs || []).map(l => l.profiles?.full_name).filter(Boolean))]
  const filteredLogs = logs.filter(log => {
    const matchName = filterName === '' || log.profiles?.full_name === filterName
    const matchMonth = filterMonth === '' || log.log_date?.startsWith(filterMonth)
    return matchName && matchMonth
  })
  const staffSummary = {}
  filteredLogs.forEach(log => {
    const name = log.profiles?.full_name || 'Unknown'
    if (!staffSummary[name]) staffSummary[name] = { hours: 0, days: new Set() }
    staffSummary[name].hours += log.hours_logged || 0
    staffSummary[name].days.add(log.log_date)
  })
  const totalHours = filteredLogs.reduce((s, l) => s + (l.hours_logged || 0), 0)

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>⏳</div>
        <p style={{ color: '#64748b', marginTop: 8 }}>Memuatkan history...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '20px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <button onClick={() => router.back()}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8, display: 'block' }}>
              ← Balik
            </button>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>📊 History Timesheet</h1>
            {job && <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>{job.clients?.company_name} — {job.invoice_number} • {job.service_type}</p>}
          </div>
        </div>

        {/* Staff Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {Object.entries(staffSummary).map(([name, data], i) => (
            <div key={i} style={{ background: 'white', borderRadius: 12, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>{name}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6' }}>{data.hours.toFixed(1)}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>jam • {data.days.size} hari</div>
            </div>
          ))}
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>JUMLAH</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{totalHours.toFixed(1)}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>jam</div>
          </div>
        </div>

        {/* Filter */}
        <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Filter Staff</label>
              <select value={filterName} onChange={e => setFilterName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                <option value="">Semua Staff</option>
                {staffNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Filter Bulan</label>
              <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          {(filterName || filterMonth) && (
            <button onClick={() => { setFilterName(''); setFilterMonth('') }}
              style={{ marginTop: 10, background: '#fee2e2', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>
              ✕ Clear Filter
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>📋 Log Entries ({filteredLogs.length})</h2>
          {filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: 40 }}>📭</div>
              <p>Tiada log untuk filter ini</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Tarikh', 'Staff', 'Jawatan', 'Jam', 'Nota'].map((h, i) => (
                      <th key={i} style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontWeight: 700, borderBottom: '2px solid #e2e8f0', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, i) => (
                    <tr key={log.id} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#374151', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {new Date(log.log_date).toLocaleDateString('ms-MY', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#1e293b', fontWeight: 600 }}>{log.profiles?.full_name || '-'}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>{log.profiles?.position || '-'}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ background: log.hours_logged === 0 ? '#f1f5f9' : '#dbeafe', color: log.hours_logged === 0 ? '#94a3b8' : '#1d4ed8', fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                          {log.hours_logged} jam
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>{log.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f0f9ff' }}>
                    <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 700, color: '#1e293b' }}>JUMLAH</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: '#dbeafe', color: '#1d4ed8', fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{totalHours.toFixed(1)} jam</span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TimesheetHistoryPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><p>Loading...</p></div>}>
      <TimesheetHistoryContent />
    </Suspense>
  )
}