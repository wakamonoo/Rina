import { REDIRECT_URI } from "./config.js";
import { redirectToSpotifyAuth, exchangeCodeForToken } from "./auth.js";

const STATUS = document.getElementById("status");
let accessToken = localStorage.getItem("spotify_access_token");

init();

async function init() {
  const params = new URLSearchParams(window.location.search);
  const authCode = params.get("code");

  if (!accessToken) {
    if (!authCode) {
      redirectToSpotifyAuth();
      return; // will redirect
    }
    try {
      const tokenData = await exchangeCodeForToken(authCode);
      accessToken = tokenData.access_token;
      localStorage.setItem("spotify_access_token", accessToken);
      // Clean the URL (remove ?code=…)
      window.history.replaceState({}, document.title, REDIRECT_URI);
    } catch (err) {
      STATUS.textContent = "❌ Auth failed.";
      console.error(err);
      return;
    }
  }

  STATUS.textContent = "🎤 Listening…";
  startVoice(accessToken);
}

function startVoice(token) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recog = new SpeechRecognition();
  recog.continuous = true;
  recog.interimResults = false;
  recog.lang = "en-US";

  recog.onresult = (e) => {
    const query = e.results[e.results.length - 1][0].transcript.trim();
    STATUS.textContent = `🎵 Heard: "${query}"`;
    searchAndPlay(query, token);
  };
  recog.onerror = (e) => {
    STATUS.textContent = `❌ ${e.error}`;
  };

  recog.start();
}

async function searchAndPlay(q, token) {
  try {
    const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.tracks.items.length) {
      STATUS.textContent = "🚫 No match.";
      return;
    }
    const uri = data.tracks.items[0].uri;

    await fetch("https://api.spotify.com/v1/me/player/play", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: [uri] }),
    });

    STATUS.textContent = "✅ Playing on Spotify!";
  } catch (err) {
    STATUS.textContent = "⚠️ Playback error.";
    console.error(err);
  }
}