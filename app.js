const CLIENT_ID = '973d808653bc42219c4d514c91e5e22b';
const REDIRECT_URI = 'http://rina-wakamonoo.vercel.app'; // Change if hosted
const SCOPES = [
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state'
].join('%20');

const STATUS = document.getElementById('status');

// ==========================
// 1. AUTH & TOKEN HANDLING
// ==========================
function getTokenFromUrl() {
  const hash = window.location.hash;
  const match = hash.match(/access_token=([^&]*)/);
  return match ? match[1] : null;
}

let token = getTokenFromUrl();

if (!token) {
  window.location = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${SCOPES}`;
} else {
  STATUS.textContent = '🎤 Listening...';
  window.history.pushState('', document.title, window.location.pathname + window.location.search); // clean URL
  startRina(token);
}

// ==========================
// 2. RINA VOICE HANDLING
// ==========================
function startRina(token) {
  window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.lang = 'en-US';
  recognition.interimResults = false;

  recognition.start();
  recognition.onresult = async (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim();
    STATUS.textContent = `🎵 Heard: "${transcript}"`;
    searchAndPlay(transcript, token);
  };

  recognition.onerror = (event) => {
    STATUS.textContent = `❌ Error: ${event.error}`;
  };
}

// ==========================
// 3. SPOTIFY SEARCH & PLAY
// ==========================
async function searchAndPlay(query, token) {
  try {
    const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await searchRes.json();

    if (!data.tracks || !data.tracks.items.length) {
      STATUS.textContent = '🚫 No results found.';
      return;
    }

    const trackUri = data.tracks.items[0].uri;

    await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: [trackUri] })
    });

    STATUS.textContent = '✅ Playing on Spotify!';
  } catch (error) {
    STATUS.textContent = '⚠️ Playback failed.';
    console.error(error);
  }
}
