/**
 * MedClock Caregiver Sync Relay — Cloudflare Worker (Free Tier)
 * Stores encrypted/PIN-protected CaregiverSnapshots in KV (`MEDCLOCK_SYNC`) with 30-day TTL.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-MedClock-Pin',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/sync\/([A-Z0-9]{6})$/);
    if (!match) {
      return json({ error: 'Not found' }, 404);
    }

    const code = match[1];
    const key = `caregiver:${code}`;
    const pinHeader = request.headers.get('X-MedClock-Pin') || '';

    if (request.method === 'PUT') {
      const rawText = await request.text();
      if (rawText.length > 131072) {
        return json({ error: 'Payload too large' }, 413);
      }
      let body = null;
      try {
        body = JSON.parse(rawText);
      } catch {
        body = null;
      }
      if (!body || typeof body !== 'object') {
        return json({ error: 'Invalid payload' }, 400);
      }

      const existingRaw = await env.MEDCLOCK_SYNC.get(key);
      if (existingRaw) {
        const existing = JSON.parse(existingRaw);
        if (existing.writeSecret && body.writeSecret !== existing.writeSecret) {
          return json({ error: 'Unauthorized writeSecret' }, 403);
        }
      }

      await env.MEDCLOCK_SYNC.put(key, JSON.stringify(body), {
        expirationTtl: 60 * 60 * 24 * 30, // 30 days
      });
      return json({ ok: true, updatedAt: body.updatedAt });
    }

    if (request.method === 'GET') {
      const raw = await env.MEDCLOCK_SYNC.get(key);
      if (!raw) {
        return json({ error: 'Caregiver code not found' }, 404);
      }
      const stored = JSON.parse(raw);
      if (stored.pinHash && stored.pinHash !== pinHeader) {
        return json({ error: 'Invalid PIN', pinRequired: true }, 401);
      }
      const { writeSecret: _omit, pinHash: _omitPin, ...publicSnapshot } = stored;
      return json(publicSnapshot, 200);
    }

    return json({ error: 'Method not allowed' }, 405);
  },
};
