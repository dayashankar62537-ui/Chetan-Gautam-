// api/live-token.js
// Mints a short-lived (ephemeral) token for the Gemini Live API.
// The real GEMINI_API_KEY NEVER leaves this server — the browser only ever
// receives a token that expires in a few minutes and can only be used to
// open ONE live voice session. This is Google's recommended pattern for
// direct browser-to-Gemini realtime voice connections.

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10kb'
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server is not configured. Add GEMINI_API_KEY in your Vercel project settings.'
    });
  }

  const now = Date.now();
  const expireTime = new Date(now + 15 * 60 * 1000).toISOString();          // token valid 15 min
  const newSessionExpireTime = new Date(now + 60 * 1000).toISOString();     // must start session within 1 min

  try {
    const tokenRes = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uses: 1,
        expireTime,
        newSessionExpireTime
      })
    });

    const data = await tokenRes.json();

    if (!tokenRes.ok) {
      const errMsg = (data && data.error && data.error.message) || 'Could not create a live session token.';
      return res.status(tokenRes.status).json({ error: errMsg });
    }

    return res.status(200).json({ token: data.name, model: 'gemini-3.1-flash-live-preview' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reach the Gemini Live API.' });
  }
}
