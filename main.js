import { REDIRECT_URI }      from './config.js';
import { startAuth, getToken } from './auth.js';

const statusEl = document.getElementById('status');
let   accessToken = localStorage.getItem('spotify_access_token');
let   deviceId    = null;

/* ----------  App bootstrap ---------- */
bootstrap();

async function bootstrap() {
  const qp   = new URLSearchParams(window.location.search);
  const code = qp.get('code');

  if (!accessToken) {
    if (!code) {
      /* First visit → send to Spotify */
      startAuth();
      return;                       // browser will redirect
    }
    /* Returned from Spotify → exchange code */
    try {
      const tokenData = await getToken(code);
      accessToken = tokenData.access_token;
      localStorage.setItem('spotify_access_token', accessToken);
      window.history.replaceState({}, document.title, REDIRECT_URI); // clean URL
    } catch (e) {
      statusEl.textContent = '❌ Auth failed';
      console.error(e);
      return;
    }
  }

  statusEl.textContent = '🔄 Initializing player…';
  await initWebPlaybackSDK();
  statusEl.textContent = '🎤 Listening…';
  startSpeech();
}

/* ----------  Web Playback SDK ---------- */
function initWebPlaybackSDK() {
  return new Promise(resolve => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new Spotify.Player({
        name: 'Rina Web Player',
        getOAuthToken: cb => cb(accessToken),
        volume: 0.8
      });

      player.addListener('ready', ({ device_id }) => {
        deviceId = device_id;
        /* Transfer playback to this device so it's active */
        fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ device_ids: [deviceId], play: false })
        }).finally(resolve);
      });

      /* Minimal error logs */
      ['initialization_error','authentication_error','account_error','playback_error']
        .forEach(evt => player.addListener(evt, ({message}) => console.error(evt, message)));

      player.connect();
    };
  });
}

/* ----------  Voice recognition ---------- */
function startSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recog = new SR();
  recog.interimResults = false;
  recog.continuous     = true;
  recog.lang           = 'en-US';

  recog.onresult = ({ results }) => {
    const query = results[results.length - 1][0].transcript.trim();
    statusEl.textContent = `🎵 Heard: “${query}”`;
    searchAndPlay(query);
  };
  recog.onerror  = e => statusEl.textContent = `❌ ${e.error}`;
  recog.start();
}

/* ----------  Search + play ---------- */
async function searchAndPlay(query) {
  try {
    /* 1. search */
    const r = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await r.json();
    if (!data.tracks.items.length) {
      statusEl.textContent = '🚫 No match';
      return;
    }
    const uri = data.tracks.items[0].uri;

    /* 2. play on our device */
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: [uri] })
    });

    statusEl.textContent = '✅ Playing on Spotify!';
  } catch (err) {
    statusEl.textContent = '⚠️ Playback error';
    console.error(err);
  }
}
