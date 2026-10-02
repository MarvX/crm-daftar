import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon';
process.env.SUPABASE_SERVICE_KEY = 'service';

const { default: handler } = await import('../api/attendance-qr.js');
let calls;
let issuedHash;
let tokenConsumed;

function response() {
  return { statusCode: 200, headers: {}, body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; },
    end(body) { this.body = JSON.parse(body); } };
}
function request({ token, action, auth = 'Bearer user-token' } = {}) {
  return { method: 'POST', headers: auth ? { authorization: auth } : {}, body: { action, ...(token ? { token } : {}) } };
}
function sessionUser(auth) {
  if (auth === 'Bearer admin-token' || auth === 'Bearer user-token') return { id: auth.includes('admin') ? 'admin-id' : 'user-id' };
  return null;
}

beforeEach(() => {
  calls = []; issuedHash = null; tokenConsumed = false;
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) {
      const user = sessionUser(options.headers?.Authorization);
      return { ok: !!user, async json() { return user || { error: 'unauthorized' }; } };
    }
    if (String(url).includes('/rest/v1/profiles')) {
      const admin = calls.some(c => c.url.endsWith('/auth/v1/user') && c.options?.headers?.Authorization === 'Bearer admin-token');
      return { ok: true, async json() { return admin ? [{ is_admin: true }] : [{ is_admin: false }]; } };
    }
    if (String(url).includes('/rest/v1/attendance_qr_tokens') && options.method === 'POST') {
      issuedHash = JSON.parse(options.body).token;
      return { ok: true, async json() { return []; } };
    }
    if (String(url).includes('/rest/v1/attendance_qr_tokens') && options.method === 'DELETE') {
      const hash = new URL(url).searchParams.get('token')?.replace('eq.', '');
      const valid = issuedHash && hash === issuedHash && !tokenConsumed;
      tokenConsumed = !!valid;
      return { ok: true, async json() { return valid ? [{}] : []; } };
    }
    if (String(url).includes('/rest/v1/attendance?')) return { ok: true, async json() { return []; } };
    if (String(url).endsWith('/rest/v1/attendance')) return { ok: true, async json() { return []; } };
    throw new Error(`Unexpected fetch: ${url}`);
  };
});

test('rejects requests without a session', async () => {
  const res = response(); await handler(request({ action: 'issue', auth: null }), res);
  assert.equal(res.statusCode, 401);
});

test('allows issuance only for admins and stores only a hash', async () => {
  const denied = response(); await handler(request({ action: 'issue' }), denied);
  assert.equal(denied.statusCode, 403);
  const admin = response(); await handler(request({ action: 'issue', auth: 'Bearer admin-token' }), admin);
  assert.equal(admin.statusCode, 200);
  assert.match(admin.body.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(issuedHash, createHash('sha256').update(admin.body.token).digest('hex'));
  assert.notEqual(issuedHash, admin.body.token);
});

test('rejects malformed tokens before touching attendance', async () => {
  const res = response(); await handler(request({ action: 'consume', token: 'short' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(calls.some(c => c.url.includes('/rest/v1/attendance?')), false);
});

test('consumes a valid token once and rejects replay', async () => {
  const admin = response(); await handler(request({ action: 'issue', auth: 'Bearer admin-token' }), admin);
  const first = response(); await handler(request({ action: 'consume', token: admin.body.token }), first);
  assert.equal(first.statusCode, 200); assert.equal(first.body.status, 'ok');
  const replay = response(); await handler(request({ action: 'consume', token: admin.body.token }), replay);
  assert.equal(replay.statusCode, 401); assert.equal(replay.body.error, 'expired_or_used');
});
