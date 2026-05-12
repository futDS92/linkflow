import { readJson, writeJson } from './_store.js';

const sharesKey = 'linkflow:shares';

function getStore() {
  return readJson(sharesKey);
}

async function ensureStore() {
  const existing = await getStore();
  if (existing && typeof existing === 'object' && existing.items) return existing;
  return { items: {} };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://127.0.0.1');
    const id = url.searchParams.get('id');
    if (!id) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }
    const store = (await getStore()) || { items: {} };
    const share = store.items?.[id];
    if (!share) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(200).json(share);
    return;
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const store = await ensureStore();
    const id = crypto.randomUUID();
    store.items[id] = {
      id,
      createdAt: new Date().toISOString(),
      payload: body.payload || body,
    };
    await writeJson(sharesKey, store);
    res.status(201).json({ id });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
