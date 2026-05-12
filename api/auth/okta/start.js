import { startAuth } from '../../_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  await startAuth(req, res, 'okta');
}
