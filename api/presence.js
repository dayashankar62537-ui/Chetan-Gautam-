// api/presence.js
// Tracks real live visitors — no fake numbers.
// POST: heartbeat — "this session is still here" (called every ~20s by the browser)
// GET: returns how many distinct sessions have pinged in the last 60 seconds

import { Client } from 'pg';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10kb'
    }
  }
};

export default async function handler(req, res) {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    return res.status(500).json({ error: 'Server is not configured.' });
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    if (req.method === 'POST') {
      let sessionId = '';
      try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        sessionId = (body && body.sessionId) ? String(body.sessionId).slice(0, 64) : '';
      } catch (e) {}
      if (!sessionId) {
        await client.end();
        return res.status(400).json({ error: 'sessionId is required.' });
      }

      await client.query(
        `INSERT INTO presence (session_id, last_seen) VALUES ($1, NOW())
         ON CONFLICT (session_id) DO UPDATE SET last_seen = NOW()`,
        [sessionId]
      );

      // Light cleanup: drop stale rows older than 10 minutes so the table
      // doesn't grow forever.
      await client.query(`DELETE FROM presence WHERE last_seen < NOW() - INTERVAL '10 minutes'`);

      await client.end();
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      const result = await client.query(
        `SELECT COUNT(*)::int AS count FROM presence WHERE last_seen > NOW() - INTERVAL '60 seconds'`
      );
      await client.end();
      return res.status(200).json({ online: result.rows[0].count });
    }

    await client.end();
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    try { await client.end(); } catch (e) {}
    return res.status(500).json({ error: 'Could not check presence right now.' });
  }
}
