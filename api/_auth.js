import { randomUUID } from 'node:crypto';
import { readJson, writeJson } from './_store.js';

const memory = globalThis.__linkflowAuth ??= { sessions: {} };
const sessionPrefix = 'linkflow:session:';
const cookieAge = 60 * 60 * 24 * 30;

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      const index = part.indexOf('=');
      if (index === -1) return [part, ''];
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    }),
  );
}

function cookie(name, value, extra = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  if (extra.httpOnly !== false) parts.push('HttpOnly');
  if (extra.secure !== false && process.env.VERCEL) parts.push('Secure');
  if (extra.maxAge) parts.push(`Max-Age=${extra.maxAge}`);
  return parts.join('; ');
}

function providerConfig(provider) {
  if (provider === 'okta') {
    const issuer = process.env.OKTA_ISSUER;
    return issuer ? {
      provider: 'okta',
      authorizeUrl: `${issuer.replace(/\/$/, '')}/v1/authorize`,
      tokenUrl: `${issuer.replace(/\/$/, '')}/v1/token`,
      userInfoUrl: `${issuer.replace(/\/$/, '')}/v1/userinfo`,
      clientId: process.env.OKTA_CLIENT_ID,
      clientSecret: process.env.OKTA_CLIENT_SECRET,
      redirectUri: process.env.OKTA_REDIRECT_URI,
      scopes: ['openid', 'profile', 'email'],
    } : null;
  }

  if (provider === 'google') {
    return process.env.GOOGLE_CLIENT_ID ? {
      provider: 'google',
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      scopes: [
        'openid',
        'profile',
        'email',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.freebusy',
      ],
    } : null;
  }

  return null;
}

function sessionKey(sessionId) {
  return `${sessionPrefix}${sessionId}`;
}

async function readSession(sessionId) {
  const kv = await readJson(sessionKey(sessionId));
  if (kv && typeof kv === 'object') return kv;
  return memory.sessions[sessionId] || { providers: {} };
}

async function writeSession(sessionId, value) {
  if (await writeJson(sessionKey(sessionId), value)) return;
  memory.sessions[sessionId] = value;
}

export function ensureSession(req, res) {
  const cookies = parseCookies(req);
  const existing = cookies.linkflow_sid;
  if (existing) return existing;
  const sid = randomUUID();
  res.setHeader('Set-Cookie', cookie('linkflow_sid', sid, { maxAge: cookieAge }));
  return sid;
}

export function getAuthState(req, provider) {
  const cookies = parseCookies(req);
  return cookies[`linkflow_state_${provider}`] || '';
}

export function clearAuthState(res, provider) {
  res.setHeader('Set-Cookie', [
    cookie(`linkflow_state_${provider}`, '', { maxAge: 0 }),
  ]);
}

export async function startAuth(req, res, provider) {
  const config = providerConfig(provider);
  if (!config || !config.clientId || !config.clientSecret || !config.redirectUri) {
    res.status(503).json({
      error: `${provider} auth is not configured`,
      required: provider === 'okta'
        ? ['OKTA_ISSUER', 'OKTA_CLIENT_ID', 'OKTA_CLIENT_SECRET', 'OKTA_REDIRECT_URI']
        : ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'],
    });
    return;
  }

  const sid = ensureSession(req, res);
  const state = randomUUID();
  const redirect = new URL(req.headers.referer || process.env.PUBLIC_APP_URL || 'http://127.0.0.1:4175');
  redirect.searchParams.set('auth', `${provider}-connected`);

  const authorization = new URL(config.authorizeUrl);
  authorization.searchParams.set('client_id', config.clientId);
  authorization.searchParams.set('redirect_uri', config.redirectUri);
  authorization.searchParams.set('response_type', 'code');
  authorization.searchParams.set('scope', config.scopes.join(' '));
  authorization.searchParams.set('state', state);
  if (provider === 'google') {
    authorization.searchParams.set('access_type', 'offline');
    authorization.searchParams.set('prompt', 'consent');
  }

  res.setHeader('Set-Cookie', [
    cookie('linkflow_sid', sid, { maxAge: cookieAge }),
    cookie(`linkflow_state_${provider}`, state, { maxAge: 900 }),
    cookie(`linkflow_return_to_${provider}`, redirect.toString(), { maxAge: 900, httpOnly: false }),
  ]);
  res.writeHead(302, { Location: authorization.toString() });
  res.end();
}

async function exchangeCode(config, code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code,
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  return response.json();
}

async function fetchProfile(config, accessToken) {
  const response = await fetch(config.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return {};
  return response.json();
}

export async function completeAuth(req, res, provider) {
  const config = providerConfig(provider);
  if (!config) {
    res.status(503).json({ error: `${provider} auth is not configured` });
    return;
  }

  const url = new URL(req.url, 'http://127.0.0.1');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = getAuthState(req, provider);

  if (!code || !state || state !== expectedState) {
    res.status(400).json({ error: 'Invalid auth callback state' });
    return;
  }

  const tokens = await exchangeCode(config, code);
  const profile = await fetchProfile(config, tokens.access_token);
  const sid = ensureSession(req, res);
  const session = await readSession(sid);
  session.providers ||= {};
  session.providers[provider] = {
    email: profile.email || profile.preferred_username || profile.upn || '',
    name: profile.name || profile.given_name || profile.email || '',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || '',
    expiresIn: tokens.expires_in || 0,
    scope: tokens.scope || '',
    connectedAt: new Date().toISOString(),
  };
  await writeSession(sid, session);

  const returnCookies = parseCookies(req);
  const returnTo = returnCookies[`linkflow_return_to_${provider}`] || '/?auth=connected';
  res.setHeader('Set-Cookie', [
    cookie('linkflow_sid', sid, { maxAge: cookieAge }),
    cookie(`linkflow_state_${provider}`, '', { maxAge: 0 }),
    cookie(`linkflow_return_to_${provider}`, '', { maxAge: 0, httpOnly: false }),
  ]);
  res.writeHead(302, { Location: returnTo });
  res.end();
}

export async function getSession(req) {
  const cookies = parseCookies(req);
  const sid = cookies.linkflow_sid;
  if (!sid) return { id: '', data: { providers: {} } };
  return { id: sid, data: await readSession(sid) };
}

export async function getProviderConnection(req, provider) {
  const { data } = await getSession(req);
  return data.providers?.[provider] || null;
}

export async function readAuthStatus(req) {
  const cookies = parseCookies(req);
  const sid = cookies.linkflow_sid;
  if (!sid) {
    return { oktaConnected: false, googleConnected: false };
  }

  const session = await readSession(sid);
  const okta = session.providers?.okta || null;
  const google = session.providers?.google || null;

  return {
    oktaConnected: Boolean(okta),
    googleConnected: Boolean(google),
    hostName: okta?.name || '',
    hostEmail: okta?.email || '',
    googleEmail: google?.email || '',
  };
}
