import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const resend = new Resend(process.env.RESEND_API_KEY)

// Email templates
function getEmailTemplate({ type, staffName, jobDescription, clientName, serviceType, dueDate, daysLeft, daysOverdue, hooName }) {
  const dueDateFormatted = dueDate ? new Date(dueDate).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'

  const templates = {
    '7_days': {
      subject: `⏰ 7 Hari Lagi | ${clientName} — ${serviceType}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1E3A5F; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">AMACC Practice Management System</h2>
            <p style="color: #BFDBFE; margin: 5px 0 0 0;">Due Date Reminder</p>
          </div>
          <div style="background: #EFF6FF; padding: 25px; border-radius: 0 0 8px 8px; border: 1px solid #BFDBFE;">
            <p style="font-size: 16px;">Salam <strong>${staffName}</strong>,</p>
            <p style="font-size: 15px;">Eh, due date dah nampak kat horizon! 🌅 Masih ada <strong>7 hari</strong> — cukup masa kalau start sekarang. Jangan tunggu last minute tau, nanti kita sama-sama gigit jari.</p>
            
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #2563EB; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Klien:</strong> ${clientName}</p>
              <p style="margin: 5px 0;"><strong>Servis:</strong> ${serviceType}</p>
              <p style="margin: 5px 0;"><strong>Skop Kerja:</strong> ${jobDescription}</p>
              <p style="margin: 5px 0;"><strong>Due Date:</strong> ${dueDateFormatted}</p>
              <p style="margin: 5px 0; color: #2563EB;"><strong>Baki Masa:</strong> 7 hari lagi</p>
            </div>

            <p style="font-size: 15px;">You got this! 💪</p>
            
            <div style="background: #F0FDF4; padding: 15px; border-radius: 8px; border-left: 4px solid #16A34A; margin-top: 20px;">
              <p style="margin: 0; font-style: italic; color: #15803D;"><em>"How can you do better today to finish this on time?"</em></p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #6B7280; font-size: 12px;">Email ini dijana automatik oleh AMACC PMS. Log masuk di <a href="https://pms.zynovalab.com">pms.zynovalab.com</a></p>
          </div>
        </div>
      `
    },
    '3_days': {
      subject: `⚠️ 3 Hari Lagi! | ${clientName} — ${serviceType}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #D97706; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">AMACC Practice Management System</h2>
            <p style="color: #FEF3C7; margin: 5px 0 0 0;">Urgent: Due Date Reminder</p>
          </div>
          <div style="background: #FFFBEB; padding: 25px; border-radius: 0 0 8px 8px; border: 1px solid #FDE68A;">
            <p style="font-size: 16px;">Salam <strong>${staffName}</strong>,</p>
            <p style="font-size: 15px;">Allahuakbar, 3 hari je lagi! ⏰ Dah macam countdown raya dah ni tapi ni bukan raya — ini <strong>deadline</strong>. Kalau ada halangan, bagitahu HOO sekarang. Jangan simpan dalam hati sorang-sorang.</p>
            
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #D97706; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Klien:</strong> ${clientName}</p>
              <p style="margin: 5px 0;"><strong>Servis:</strong> ${serviceType}</p>
              <p style="margin: 5px 0;"><strong>Skop Kerja:</strong> ${jobDescription}</p>
              <p style="margin: 5px 0;"><strong>Due Date:</strong> ${dueDateFormatted}</p>
              <p style="margin: 5px 0; color: #D97706;"><strong>Baki Masa:</strong> 3 hari lagi ⏰</p>
            </div>

            <p style="font-size: 15px;">Reviewer: <strong>${hooName || 'HOO berkenaan'}</strong> — sila maklumkan jika ada isu.</p>
            
            <div style="background: #FEF3C7; padding: 15px; border-radius: 8px; border-left: 4px solid #D97706; margin-top: 20px;">
              <p style="margin: 0; font-style: italic; color: #92400E;"><em>"How can you do better in the next 3 days?"</em></p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #6B7280; font-size: 12px;">Email ini dijana automatik oleh AMACC PMS. Log masuk di <a href="https://pms.zynovalab.com">pms.zynovalab.com</a></p>
          </div>
        </div>
      `
    },
    '1_day': {
      subject: `🚨 ESOK Due Date! | ${clientName} — ${serviceType}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #DC2626; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">AMACC Practice Management System</h2>
            <p style="color: #FEE2E2; margin: 5px 0 0 0;">KRITIKAL: Due Date Esok!</p>
          </div>
          <div style="background: #FEF2F2; padding: 25px; border-radius: 0 0 8px 8px; border: 1px solid #FECACA;">
            <p style="font-size: 16px;">Salam <strong>${staffName}</strong>,</p>
            <p style="font-size: 15px;">Esok due date! 😬 Kalau belum siap lagi, malam ni kena sprint. Kalau ada issue, HOO perlu tahu <strong>SEKARANG</strong> bukan esok pagi. Semangat!</p>
            
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #DC2626; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Klien:</strong> ${clientName}</p>
              <p style="margin: 5px 0;"><strong>Servis:</strong> ${serviceType}</p>
              <p style="margin: 5px 0;"><strong>Skop Kerja:</strong> ${jobDescription}</p>
              <p style="margin: 5px 0;"><strong>Due Date:</strong> ${dueDateFormatted}</p>
              <p style="margin: 5px 0; color: #DC2626;"><strong>Baki Masa:</strong> 1 hari sahaja! 🚨</p>
            </div>
            
            <div style="background: #FEE2E2; padding: 15px; border-radius: 8px; border-left: 4px solid #DC2626; margin-top: 20px;">
              <p style="margin: 0; font-style: italic; color: #991B1B;"><em>"How can you make it happen by tomorrow?"</em></p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #6B7280; font-size: 12px;">Email ini dijana automatik oleh AMACC PMS. Log masuk di <a href="https://pms.zynovalab.com">pms.zynovalab.com</a></p>
          </div>
        </div>
      `
    },
    'overdue_staff': {
      subject: `❌ OVERDUE ${daysOverdue} Hari | ${clientName} — ${serviceType}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #7C3AED; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">AMACC Practice Management System</h2>
            <p style="color: #EDE9FE; margin: 5px 0 0 0;">Job Overdue — Tindakan Diperlukan</p>
          </div>
          <div style="background: #F5F3FF; padding: 25px; border-radius: 0 0 8px 8px; border: 1px solid #DDD6FE;">
            <p style="font-size: 16px;">Salam <strong>${staffName}</strong>,</p>
            <p style="font-size: 15px;">Job ini dah overdue <strong>${daysOverdue} hari</strong>. ❌ Kami faham kadang ada benda tak terduga — tapi client tunggu dan nama AMACC dipertaruhkan. Update status sekarang dan beritahu HOO plan awak.</p>
            
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #7C3AED; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Klien:</strong> ${clientName}</p>
              <p style="margin: 5px 0;"><strong>Servis:</strong> ${serviceType}</p>
              <p style="margin: 5px 0;"><strong>Skop Kerja:</strong> ${jobDescription}</p>
              <p style="margin: 5px 0;"><strong>Due Date Asal:</strong> ${dueDateFormatted}</p>
              <p style="margin: 5px 0; color: #7C3AED;"><strong>Overdue:</strong> ${daysOverdue} hari ❌</p>
            </div>
            
            <div style="background: #EDE9FE; padding: 15px; border-radius: 8px; border-left: 4px solid #7C3AED; margin-top: 20px;">
              <p style="margin: 0; font-style: italic; color: #5B21B6;"><em>"How can you do better next time?"</em></p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #6B7280; font-size: 12px;">Email ini dijana automatik oleh AMACC PMS. Log masuk di <a href="https://pms.zynovalab.com">pms.zynovalab.com</a></p>
          </div>
        </div>
      `
    },
    'overdue_hoo': {
      subject: `⚠️ HOO Alert: Job Overdue ${daysOverdue} Hari | ${clientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1E3A5F; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">AMACC Practice Management System</h2>
            <p style="color: #BFDBFE; margin: 5px 0 0 0;">HOO Alert — Job Overdue</p>
          </div>
          <div style="background: #FEF2F2; padding: 25px; border-radius: 0 0 8px 8px; border: 1px solid #FECACA;">
            <p style="font-size: 16px;">Attention <strong>${hooName}</strong>,</p>
            <p style="font-size: 15px;">Job <strong>${clientName} — ${serviceType}</strong> telah overdue <strong>${daysOverdue} hari</strong>. Ini memerlukan tindakan segera dari pihak awak. Sila ambil tindakan dan update sistem hari ini.</p>
            
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #DC2626; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Klien:</strong> ${clientName}</p>
              <p style="margin: 5px 0;"><strong>Servis:</strong> ${serviceType}</p>
              <p style="margin: 5px 0;"><strong>Exec:</strong> ${staffName}</p>
              <p style="margin: 5px 0;"><strong>Due Date Asal:</strong> ${dueDateFormatted}</p>
              <p style="margin: 5px 0; color: #DC2626;"><strong>Overdue:</strong> ${daysOverdue} hari</p>
            </div>
            
            <div style="background: #FEE2E2; padding: 15px; border-radius: 8px; border-left: 4px solid #DC2626; margin-top: 20px;">
              <p style="margin: 0; font-style: italic; color: #991B1B;"><em>"How can we do better as a team next time?"</em></p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #6B7280; font-size: 12px;">Email ini dijana automatik oleh AMACC PMS. Log masuk di <a href="https://pms.zynovalab.com">pms.zynovalab.com</a></p>
          </div>
        </div>
      `
    },
    'overdue_ceo': {
      subject: `🚨 ESCALATION: Job Overdue ${daysOverdue} Hari | ${clientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #991B1B; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">AMACC Practice Management System</h2>
            <p style="color: #FEE2E2; margin: 5px 0 0 0;">⚠️ ESCALATION ALERT — CEO/Director</p>
          </div>
          <div style="background: #FEF2F2; padding: 25px; border-radius: 0 0 8px 8px; border: 1px solid #FECACA;">
            <p style="font-size: 16px;">⚠️ <strong>ESCALATION ALERT</strong></p>
            <p style="font-size: 15px;">Job <strong>${clientName} — ${serviceType}</strong> telah overdue selama <strong>${daysOverdue} hari</strong>. Ini memerlukan perhatian segera CEO/Director. HOO berkenaan telah dimaklumkan.</p>
            
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #991B1B; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Klien:</strong> ${clientName}</p>
              <p style="margin: 5px 0;"><strong>Servis:</strong> ${serviceType}</p>
              <p style="margin: 5px 0;"><strong>Exec:</strong> ${staffName}</p>
              <p style="margin: 5px 0;"><strong>HOO:</strong> ${hooName}</p>
              <p style="margin: 5px 0;"><strong>Due Date Asal:</strong> ${dueDateFormatted}</p>
              <p style="margin: 5px 0; color: #991B1B;"><strong>Overdue:</strong> ${daysOverdue} hari 🚨</p>
            </div>
            
            <div style="background: #FEE2E2; padding: 15px; border-radius: 8px; border-left: 4px solid #991B1B; margin-top: 20px;">
              <p style="margin: 0; font-style: italic; color: #7F1D1D;"><em>"This requires immediate action and a post-mortem review."</em></p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #6B7280; font-size: 12px;">Email ini dijana automatik oleh AMACC PMS. Log masuk di <a href="https://pms.zynovalab.com">pms.zynovalab.com</a></p>
          </div>
        </div>
      `
    }
  }

  return templates[type] || templates['7_days']
}

export async function GET(request) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all active jobs with due dates (exclude completed and kiv)
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select(`
        id,
        job_description,
        service_type,
        due_date,
        status,
        created_at,
        assigned_exec,
        assigned_reviewer,
        clients (company_name),
        exec_profile:profiles!jobs_assigned_exec_fkey (full_name, email),
        reviewer_profile:profiles!jobs_assigned_reviewer_fkey (full_name, email, division)
      `)
      .not('status', 'in', '("completed","kiv")')
      .not('due_date', 'is', null)
      .not('assigned_exec', 'is', null)

    if (error) throw error

    // Get HOO emails for each division
    const { data: hooList } = await supabase
      .from('profiles')
      .select('full_name, email, division')
      .eq('role', 'hoo')
      .eq('is_active', true)

    const hooByDivision = {}
    hooList?.forEach(hoo => {
      hooByDivision[hoo.division] = hoo
    })

    // Get CEO emails for escalation
    const { data: ceoList } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('role', 'ceo')
      .eq('is_active', true)

    let emailsSent = 0
    const results = []

    for (const job of jobs || []) {
      const dueDate = new Date(job.due_date)
      dueDate.setHours(0, 0, 0, 0)
      
      const diffTime = dueDate - today
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      const daysOverdue = Math.abs(daysLeft)

      const execEmail = job.exec_profile?.email
      const execName = job.exec_profile?.full_name || 'Staff'
      const clientName = job.clients?.company_name || 'Klien'
      const serviceType = job.service_type || '-'
      const jobDesc = job.job_description || serviceType

      // Determine job division for HOO lookup
      let division = 'tax'
      const svcLower = serviceType.toLowerCase()
      if (svcLower.includes('account')) division = 'accounting'
      else if (svcLower.includes('advisory') || svcLower.includes('spc') || svcLower.includes('sst')) division = 'advisory'

      const hoo = hooByDivision[division]
      const hooName = hoo?.full_name || 'HOO'
      const hooEmail = hoo?.email

      const emailData = {
        staffName: execName,
        jobDescription: jobDesc,
        clientName,
        serviceType,
        dueDate: job.due_date,
        daysLeft,
        daysOverdue,
        hooName
      }

      // Check job assignment age (for 7-day rule)
      const assignedDate = new Date(job.created_at)
      const daysSinceAssigned = Math.ceil((today - assignedDate) / (1000 * 60 * 60 * 24))

      try {
        if (daysLeft === 7 && daysSinceAssigned >= 14) {
          // 7 days reminder — only if assigned more than 2 weeks ago
          if (execEmail) {
            const template = getEmailTemplate({ type: '7_days', ...emailData })
            await resend.emails.send({
              from: 'AMACC PMS <noreply@zynovalab.com>',
              to: [execEmail],
              cc: hooEmail ? [hooEmail] : [],
              subject: template.subject,
              html: template.html
            })
            emailsSent++
            results.push({ job: clientName, type: '7_days', sent_to: execEmail })
          }
        } else if (daysLeft === 3) {
          // 3 days reminder
          if (execEmail) {
            const template = getEmailTemplate({ type: '3_days', ...emailData })
            await resend.emails.send({
              from: 'AMACC PMS <noreply@zynovalab.com>',
              to: [execEmail],
              cc: hooEmail ? [hooEmail] : [],
              subject: template.subject,
              html: template.html
            })
            emailsSent++
            results.push({ job: clientName, type: '3_days', sent_to: execEmail })
          }
        } else if (daysLeft === 1) {
          // 1 day reminder
          if (execEmail) {
            const template = getEmailTemplate({ type: '1_day', ...emailData })
            await resend.emails.send({
              from: 'AMACC PMS <noreply@zynovalab.com>',
              to: [execEmail],
              cc: hooEmail ? [hooEmail] : [],
              subject: template.subject,
              html: template.html
            })
            emailsSent++
            results.push({ job: clientName, type: '1_day', sent_to: execEmail })
          }
        } else if (daysLeft < 0) {
          // Overdue
          if (daysOverdue <= 3) {
            // Day 1-3: Alert staff + HOO
            const staffTemplate = getEmailTemplate({ type: 'overdue_staff', ...emailData })
            const hooTemplate = getEmailTemplate({ type: 'overdue_hoo', ...emailData })
            
            if (execEmail) {
              await resend.emails.send({
                from: 'AMACC PMS <noreply@zynovalab.com>',
                to: [execEmail],
                subject: staffTemplate.subject,
                html: staffTemplate.html
              })
              emailsSent++
            }
            if (hooEmail) {
              await resend.emails.send({
                from: 'AMACC PMS <noreply@zynovalab.com>',
                to: [hooEmail],
                subject: hooTemplate.subject,
                html: hooTemplate.html
              })
              emailsSent++
            }
            results.push({ job: clientName, type: 'overdue_1_3', daysOverdue })

          } else if (daysOverdue <= 7) {
            // Day 4-7: Alert HOO only
            if (hooEmail) {
              const hooTemplate = getEmailTemplate({ type: 'overdue_hoo', ...emailData })
              await resend.emails.send({
                from: 'AMACC PMS <noreply@zynovalab.com>',
                to: [hooEmail],
                subject: hooTemplate.subject,
                html: hooTemplate.html
              })
              emailsSent++
              results.push({ job: clientName, type: 'overdue_4_7', daysOverdue })
            }
          } else {
            // Day 7+: Escalate to HOO + CEO
            if (hooEmail) {
              const hooTemplate = getEmailTemplate({ type: 'overdue_hoo', ...emailData })
              await resend.emails.send({
                from: 'AMACC PMS <noreply@zynovalab.com>',
                to: [hooEmail],
                subject: hooTemplate.subject,
                html: hooTemplate.html
              })
              emailsSent++
            }
            for (const ceo of ceoList || []) {
              const ceoTemplate = getEmailTemplate({ type: 'overdue_ceo', ...emailData })
              await resend.emails.send({
                from: 'AMACC PMS <noreply@zynovalab.com>',
                to: [ceo.email],
                subject: ceoTemplate.subject,
                html: ceoTemplate.html
              })
              emailsSent++
            }
            results.push({ job: clientName, type: 'overdue_escalate', daysOverdue })
          }
        }
      } catch (emailError) {
        console.error(`Email error for job ${job.id}:`, emailError)
        results.push({ job: clientName, error: emailError.message })
      }
    }

    return Response.json({
      success: true,
      message: `Due date reminder selesai. ${emailsSent} email dihantar.`,
      emailsSent,
      jobsChecked: jobs?.length || 0,
      results
    })

  } catch (error) {
    console.error('Due date reminder error:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
