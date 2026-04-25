 import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Load semua staff
    const { data: allStaff } = await supabase
      .from('profiles')
      .select('id, full_name, email, division, role')
      .eq('role', 'staff')

    // Load timesheet logs semalam
    const { data: logs } = await supabase
      .from('timesheets')
      .select('staff_id')
      .eq('log_date', yesterday)

    const loggedIds = new Set(logs?.map(l => l.staff_id) || [])

    // Staff yang belum log
    const notLogged = allStaff?.filter(s => !loggedIds.has(s.id)) || []

    if (notLogged.length === 0) {
      return Response.json({ message: 'Semua staff dah log!', count: 0 })
    }

    // Group by division
    const byDivision = {}
    notLogged.forEach(s => {
      const div = s.division || 'unknown'
      if (!byDivision[div]) byDivision[div] = []
      byDivision[div].push(s.full_name)
    })

    // Load HOO emails
    const { data: hooList } = await supabase
      .from('profiles')
      .select('email, full_name, division')
      .eq('role', 'hoo')

    // Auto block staff yang belum log (lepas 10am)
    const hour = new Date().getHours()
    if (hour >= 10) {
      for (const staff of notLogged) {
        await supabase.from('profiles').update({
          is_blocked: true,
          blocked_since: new Date().toISOString()
        }).eq('id', staff.id).eq('is_blocked', false)
      }
    }

    // Hantar email ke setiap HOO
    const emailPromises = hooList?.map(async (hoo) => {
      const divStaff = byDivision[hoo.division] || []
      const allStaffList = notLogged.map(s => `• ${s.full_name} (${s.division})`).join('\n')

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f97316; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">⏰ AMACC PMS — Timesheet Alert</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Laporan Harian: ${yesterday}</p>
          </div>
          
          <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
            <p>Assalamualaikum <strong>${hoo.full_name}</strong>,</p>
            
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 15px 0;">
              <h3 style="color: #dc2626; margin: 0 0 10px 0;">🔴 ${notLogged.length} Staff Belum Log Timesheet</h3>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Tarikh: ${yesterday}</p>
            </div>

            <h4 style="color: #374151;">Senarai Staff Belum Log:</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f9fafb;">
                  <th style="text-align: left; padding: 8px 12px; border: 1px solid #e5e7eb;">Nama</th>
                  <th style="text-align: left; padding: 8px 12px; border: 1px solid #e5e7eb;">Division</th>
                </tr>
              </thead>
              <tbody>
                ${notLogged.map(s => `
                  <tr>
                    <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${s.full_name}</td>
                    <td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-transform: capitalize;">${s.division || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin: 15px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                ⚠️ Staff yang belum log akan di-block automatik dari sistem. Sila address semasa standup session hari ini.
              </p>
            </div>

            <p style="margin: 20px 0 0 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/hoo/timesheet-alert" 
                style="background: #f97316; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                🔓 Buka Timesheet Alert Dashboard
              </a>
            </p>

            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Email ini dihantar automatik oleh AMACC PMS pada ${new Date().toLocaleString('ms-MY')}
            </p>
          </div>
        </div>
      `

      return resend.emails.send({
        from: 'AMACC PMS <noreply@zynovalab.com>',
        to: hoo.email,
        subject: `⏰ [AMACC PMS] ${notLogged.length} Staff Belum Log Timesheet — ${yesterday}`,
        html: htmlContent
      })
    })

    await Promise.all(emailPromises || [])

    return Response.json({
      success: true,
      message: `Email dah dihantar ke ${hooList?.length} HOO`,
      notLoggedCount: notLogged.length,
      notLogged: notLogged.map(s => s.full_name)
    })

  } catch (error) {
    console.error('Timesheet alert error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
