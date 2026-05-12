import { completeAuth } from '../../_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  await completeAuth(req, res, 'okta');
}
