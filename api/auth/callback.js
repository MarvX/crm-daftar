export default async function handler(req, res) {
  const code = req.query.code;
  if (!code) {
    res.status(400).send('کد ورود از گوگل دریافت نشد.');
    return;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      res.status(400).json({ error: 'اتصال ناموفق بود', details: tokenData });
      return;
    }

    const expiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // ذخیره توکن در Supabase
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/google_tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: 1,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expiry
      })
    });

    res.redirect('/?calendar=connected');
  } catch (err) {
    res.status(500).json({ error: 'خطای داخلی', details: err.message });
  }
}
