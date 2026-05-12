export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    environment: process.env.VERCEL ? 'vercel' : 'local',
    kv: Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
  });
}
