export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('روش غیرمجاز');
    return;
  }

  const { title, date } = req.body;
  if (!title || !date) {
    res.status(400).json({ error: 'عنوان و تاریخ لازم است' });
    return;
  }

  try {
    // خواندن توکن ذخیره‌شده از Supabase
    const tokenRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/google_tokens?id=eq.1&select=*`, {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
      }
    });
    const tokens = await tokenRes.json();
    if (!tokens || !tokens[0] || !tokens[0].refresh_token) {
      res.status(400).json({ error: 'ابتدا باید به گوگل کلندر متصل شوید' });
      return;
    }

    // گرفتن access token جدید با استفاده از refresh token
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: tokens[0].refresh_token,
        grant_type: 'refresh_token'
      })
    });
    const refreshData = await refreshRes.json();
    if (!refreshData.access_token) {
      res.status(400).json({ error: 'تمدید دسترسی ناموفق بود', details: refreshData });
      return;
    }

    // ساخت رویداد در گوگل کلندر
    const eventRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshData.access_token}`
      },
      body: JSON.stringify({
        summary: title,
        start: { date: date },
        end: { date: date }
      })
    });
    const eventData = await eventRes.json();

    res.status(200).json({ success: true, event: eventData });
  } catch (err) {
    res.status(500).json({ error: 'خطای داخلی', details: err.message });
  }
}
