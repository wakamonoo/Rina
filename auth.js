import { CLIENT_ID, REDIRECT_URI, SCOPES } from './config.js';

/* ----------  PKCE helpers ---------- */
function randomStr(len = 128) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
              .map(x => chars[x % chars.length])
              .join('');
}
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ----------  Step-1: redirect to Spotify ---------- */
export async function startAuth() {
  const verifier  = randomStr();
  const challenge = await sha256(verifier);
  localStorage.setItem('pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id:           CLIENT_ID,
    response_type:       'code',
    redirect_uri:        REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge:        challenge,
    scope:               SCOPES.join(' '),
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

/* ----------  Step-2: exchange code for token ---------- */
export async function getToken(code) {
  const verifier = localStorage.getItem('pkce_verifier');

  const body = new URLSearchParams({
    client_id:     CLIENT_ID,
    grant_type:    'authorization_code',
    code,
    redirect_uri:  REDIRECT_URI,
    code_verifier: verifier,
  });

  const res  = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!res.ok) throw new Error('Token request failed');
  return res.json();   // {access_token, expires_in, refresh_token? …}
}
