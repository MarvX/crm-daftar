import { createHash, randomBytes } from 'node:crypto';
import { getCaller, restUrl, svcHeaders } from './_lib.js';

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const readBody = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  const caller = await getCaller(req);
  if (!caller) return json(res, 401, { error: 'unauthorized' });
  const body = await readBody(req);

  if (body.action === 'issue') {
    if (!caller.is_admin) return json(res, 403, { error: 'admin_only' });
    const token = randomBytes(32).toString('base64url');
    const expires_at = new Date(Date.now() + 90_000).toISOString();
    const r = await fetch(restUrl('attendance_qr_tokens'), {
      method: 'POST', headers: svcHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ token: hashToken(token), expires_at })
    });
    if (!r.ok) return json(res, 500, { error: 'token_create_failed' });
    return json(res, 200, { token, expires_at });
  }

  if (body.action === 'consume') {
    const token = typeof body.token === 'string' ? body.token : '';
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return json(res, 400, { error: 'invalid_token' });
    const r = await fetch(`${restUrl('attendance_qr_tokens')}?token=eq.${encodeURIComponent(hashToken(token))}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`, {
      method: 'DELETE', headers: svcHeaders({ Prefer: 'return=representation' })
    });
    if (!r.ok) return json(res, 500, { error: 'token_check_failed' });
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length !== 1) return json(res, 401, { error: 'expired_or_used' });

    const activeR = await fetch(`${restUrl('attendance')}?user_id=eq.${encodeURIComponent(caller.id)}&check_out=is.null&order=created_at.desc&limit=1`, { headers: svcHeaders() });
    const active = (await activeR.json())?.[0];
    const now = new Date().toISOString();
    if (active) {
      await fetch(`${restUrl('attendance')}?id=eq.${encodeURIComponent(active.id)}&user_id=eq.${encodeURIComponent(caller.id)}`, {
        method: 'PATCH', headers: svcHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify({ check_out: now })
      });
      return json(res, 200, { status: 'ok', action: 'خروج' });
    }
    const inserted = await fetch(restUrl('attendance'), {
      method: 'POST', headers: svcHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ user_id: caller.id, check_in: now })
    });
    if (!inserted.ok) return json(res, 500, { error: 'attendance_write_failed' });
    return json(res, 200, { status: 'ok', action: 'ورود' });
  }

  return json(res, 400, { error: 'unknown_action' });
}
