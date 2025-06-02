import { CLIENT_ID, REDIRECT_URI, SCOPES } from './config.js';

/* ---------- helpers ---------- */
const rand = (len = 128) =>
  [...crypto.getRandomValues(new Uint8Array(len))]
    .map(x => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[x % 62])
    .join('');

const sha256 = async (str) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
          .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};

/* ---------- step-1 ---------- */
export async function startAuth() {
  const verifier  = rand();
  const challenge = await sha256(verifier);
  localStorage.setItem('pkce_verifier', verifier);

  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri : REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge      : challenge,
    scope : SCOPES.join(' ')
  });

  window.location.href = `https://accounts.spotify.com/authorize?${p}`;
}

/* ---------- step-2 ---------- */
export async function exchangeCode(code) {
  const verifier = localStorage.getItem('pkce_verifier');

  const body = new URLSearchParams({
    client_id   : CLIENT_ID,
    grant_type  : 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier
  });

  const r = await fetch('https://accounts.spotify.com/api/token', {
    method : 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body   : body.toString()
  });

  if (!r.ok) throw new Error('Token request failed');
  return r.json(); // {access_token, expires_in, …}
}
