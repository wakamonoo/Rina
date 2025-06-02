import { REDIRECT_URI } from './config.js';
import { startAuth, exchangeCode } from './auth.js';

const statusEl = document.getElementById('status');
let accessToken  = localStorage.getItem('spotify_access_token');
let expiresAt = +localStorage.getItem('spotify_expires_at') || 0;

/* ------------ bootstrap ------------ */
(async () => {
  if (!accessToken || Date.now() > expiresAt) {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) {           // first visit → go to Spotify
      startAuth();
      return;
    }
    try {
      const t = await exchangeCode(code);
      accessToken = t.access_token;
      expiresAt   = Date.now() + (t.expires_in - 60) * 1000; // 60-s safety
      localStorage.setItem('spotify_access_token', accessToken);
      localStorage.setItem('spotify_expires_at', expiresAt);
      history.replaceState({}, '', REDIRECT_URI);            // neat URL
    } catch (e) {
      statusEl.textContent = '❌ Auth failed';
      console.error(e);
      return;
    }
  }

  statusEl.textContent = '🎤 Listening…';
  initSpeech();
})();

/* ------------ speech logic ------------ */
function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { statusEl.textContent = 'SpeechRecognition not supported'; return; }

  const recog = new SR();
  recog.continuous = true;
  recog.lang       = 'en-US';

  recog.onresult = ({results}) => {
    const query = results[results.length-1][0].transcript.trim();
    statusEl.textContent = `🔍 Searching: “${query}”`;
    searchAndOpen(query);
  };
  recog.onerror  = e => statusEl.textContent = `❌ ${e.error}`;
  recog.onend    = () => recog.start();   // keep listening
  recog.start();
}

/* ------------ spotify search + open ------------ */
async function searchAndOpen(q) {
  try {
    const r = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await r.json();
    if (data.tracks?.items?.length) {
      window.location.href = data.tracks.items[0].external_urls.spotify; // opens Spotify app / web
    } else {
      statusEl.textContent = '🚫 No results';
    }
  } catch (err) {
    statusEl.textContent = '⚠️ Search error';
    console.error(err);
  }
}
