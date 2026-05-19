import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://survey.thecyc.org';

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
  }

  try {
    // 1. Find incomplete sessions older than 48 hours that haven't been reminded
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const sessionsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/response_sessions?is_completed=eq.false&reminder_sent=eq.false&started_at=lt.${cutoff}&select=id,email,survey_id,current_step`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const incompleteSessions = await sessionsRes.json();

    if (!incompleteSessions?.length) {
      return NextResponse.json({ message: 'No reminders needed', sent: 0 });
    }

    // 2. Get all active surveys for the "remaining surveys" count
    const surveysRes = await fetch(
      `${SUPABASE_URL}/rest/v1/surveys?is_active=eq.true&select=id,title`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const activeSurveys = await surveysRes.json();

    // 3. Get all completed sessions to know what each email has finished
    const completedRes = await fetch(
      `${SUPABASE_URL}/rest/v1/response_sessions?is_completed=eq.true&select=email,survey_id`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const completedSessions = await completedRes.json();

    // Build a map: email -> set of completed survey IDs
    const completedMap: Record<string, Set<string>> = {};
    for (const s of completedSessions || []) {
      if (!completedMap[s.email]) completedMap[s.email] = new Set();
      completedMap[s.email].add(s.survey_id);
    }

    // 4. Group incomplete sessions by email
    const byEmail: Record<string, typeof incompleteSessions> = {};
    for (const s of incompleteSessions) {
      if (!byEmail[s.email]) byEmail[s.email] = [];
      byEmail[s.email].push(s);
    }

    let sentCount = 0;

    for (const [email, sessions] of Object.entries(byEmail)) {
      const completed = completedMap[email] || new Set();
      const remainingSurveys = activeSurveys.filter((s: any) => !completed.has(s.id));
      const incompleteTitles = sessions
        .map((s: any) => activeSurveys.find((sv: any) => sv.id === s.survey_id)?.title)
        .filter(Boolean);

      const remainingCount = remainingSurveys.length;

      // Build email HTML
      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#04377E,#0CB7C4);padding:32px 40px;">
      <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">CYC Survey Platform</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="color:#04377E;font-size:20px;margin:0 0 16px;">You're almost there! 🎯</h2>
      <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 20px;">
        We noticed you started ${incompleteTitles.length > 0 ? `<strong>${incompleteTitles[0]}</strong>` : 'a survey'} but didn't get a chance to finish. Your responses have been saved — pick up right where you left off!
      </p>
      ${remainingCount > 0 ? `
      <div style="background:#f0fdf4;border-left:4px solid #0CB7C4;padding:14px 18px;border-radius:8px;margin:0 0 24px;">
        <p style="color:#04377E;font-size:14px;margin:0;font-weight:600;">
          📋 You have ${remainingCount} active survey${remainingCount > 1 ? 's' : ''} remaining to complete.
        </p>
      </div>
      ` : ''}
      <div style="text-align:center;margin:28px 0;">
        <a href="${SITE_URL}" style="display:inline-block;background:linear-gradient(135deg,#F5C518,#f0b400);color:#04377E;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 12px rgba(245,197,24,0.4);">
          Continue Your Surveys →
        </a>
      </div>
      <p style="color:#999;font-size:12px;text-align:center;margin:24px 0 0;">
        Your voice matters. Thank you for helping empower Canadian youth.
      </p>
    </div>
    <div style="background:#f9fafb;padding:16px 40px;text-align:center;">
      <p style="color:#bbb;font-size:11px;margin:0;">Canadian Youth Cabinet &bull; <a href="${SITE_URL}" style="color:#0CB7C4;">thecyc.org</a></p>
    </div>
  </div>
</body>
</html>`;

      // Send via Resend
      const sendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'CYC Surveys <no-reply@thecyc.org>',
          to: [email],
          subject: `You're almost done! ${remainingCount > 0 ? `${remainingCount} survey${remainingCount > 1 ? 's' : ''} still waiting` : 'Finish your survey'}`,
          html
        })
      });

      if (sendRes.ok) {
        sentCount++;
        // Mark all sessions for this email as reminded
        for (const s of sessions) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/response_sessions?id=eq.${s.id}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({ reminder_sent: true })
            }
          );
        }
      }
    }

    return NextResponse.json({ message: `Sent ${sentCount} reminder emails`, sent: sentCount });
  } catch (error: any) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
