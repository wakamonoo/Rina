document.getElementById('startBtn').addEventListener('click', () => {
  startListening();
});

function startListening() {
  const status = document.getElementById('status');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    status.textContent = 'Speech recognition not supported.';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;

  recognition.onresult = async (event) => {
    const query = event.results[0][0].transcript.trim();
    status.textContent = `Searching YouTube for: "${query}"`;
    await searchYouTubeAndPlay(query);
  };

  recognition.onerror = (e) => {
    status.textContent = `Error: ${e.error}`;
  };

  recognition.start();
}

async function searchYouTubeAndPlay(query) {
  try {
    const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
    const text = await response.text();
    const match = text.match(/"videoId":"(.*?)"/);
    const videoId = match ? match[1] : null;

    if (videoId) {
      const iframe = document.createElement('iframe');
      iframe.width = "100%";
      iframe.height = "100%";
      iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
      iframe.allow = "autoplay; encrypted-media";
      iframe.allowFullscreen = true;

      const player = document.getElementById('player');
      player.innerHTML = '';
      player.appendChild(iframe);

      document.getElementById('status').textContent = 'Playing now!';
    } else {
      document.getElementById('status').textContent = 'No video found.';
    }
  } catch (err) {
    console.error(err);
    document.getElementById('status').textContent = 'Error loading video.';
  }
}
