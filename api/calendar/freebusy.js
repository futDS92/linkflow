import { getProviderConnection } from '../_auth.js';

function fail(res, status, message) {
  res.status(status).json({ error: message });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    fail(res, 405, 'Method not allowed');
    return;
  }

  const google = await getProviderConnection(req, 'google');
  if (!google?.accessToken) {
    fail(res, 401, 'Google Calendar is not connected');
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${google.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: body.timeMin,
      timeMax: body.timeMax,
      items: [{ id: process.env.GOOGLE_CALENDAR_ID || 'primary' }],
    }),
  });

  const data = await response.json();
  res.status(response.ok ? 200 : response.status).json(data);
}
