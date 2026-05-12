import { randomUUID } from 'node:crypto';

const globalState = globalThis;
const kvKey = 'linkflow:bookings';

if (!globalState.__linkflowStore) {
  globalState.__linkflowStore = { bookings: [] };
}

function hasKvConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function kvHeaders() {
  return {
    Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function kvUrl(path) {
  return new URL(path, process.env.KV_REST_API_URL).toString();
}

export async function readJson(key) {
  if (!hasKvConfig()) return null;

  const response = await fetch(kvUrl(`/get/${encodeURIComponent(key)}`), {
    headers: kvHeaders(),
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (!data || typeof data.result !== 'string') return null;

  try {
    return JSON.parse(data.result);
  } catch {
    return null;
  }
}

export async function writeJson(key, value) {
  if (!hasKvConfig()) return false;

  const payload = JSON.stringify(value);
  const response = await fetch(kvUrl(`/set/${encodeURIComponent(key)}/${encodeURIComponent(payload)}`), {
    headers: kvHeaders(),
  });

  return response.ok;
}

export async function listBookings() {
  const kvBookings = await readJson(kvKey);
  if (kvBookings && Array.isArray(kvBookings.bookings)) return kvBookings.bookings;
  return globalState.__linkflowStore.bookings;
}

export async function addBooking(payload) {
  const booking = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'confirmed',
    ...payload,
  };

  const bookings = await listBookings();
  const next = [booking, ...bookings];

  if (await writeJson(kvKey, { bookings: next })) {
    return booking;
  }

  globalState.__linkflowStore.bookings = next;
  return booking;
}
