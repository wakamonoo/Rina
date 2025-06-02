import { YT_API_KEY } from './config.js';

/* ───────── DOM refs ───────── */
const status  = document.getElementById('status');
const grid    = document.getElementById('results');
const btnAuto = document.getElementById('modeAutoplay');
const btnSrch = document.getElementById('modeSearch');
const micBtn  = document.getElementById('startBtn');

/* ───────── mode state ───────── */
let mode = 'autoplay';
updateButtons();
btnAuto.onclick = () => { mode = 'autoplay'; updateButtons(); };
btnSrch.onclick = () => { mode = 'search'; updateButtons(); };

function updateButtons() {
  btnAuto.classList.toggle('bg-red-600', mode === 'autoplay');
  btnAuto.classList.toggle('bg-gray-700', mode !== 'autoplay');
  btnSrch.classList.toggle('bg-red-600', mode === 'search');
  btnSrch.classList.toggle('text-white', mode === 'search');
  btnSrch.classList.toggle('bg-gray-700', mode !== 'search');
}

/* ───────── speech synthesis helper ───────── */
function speak(txt, lang = 'en-US') {
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = lang;
  u.pitch = 1.4;
  u.rate = 1;

  const pick = () => {
    const v = speechSynthesis.getVoices()
      .find(v => v.lang === lang && /(female|kyoko|mizuki)/i.test(v.name));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  };

  speechSynthesis.getVoices().length
    ? pick()
    : speechSynthesis.addEventListener('voiceschanged', pick, { once: true });
}

/* ───────── mic click → wake word ───────── */
micBtn.onclick = listenWake;

function listenWake() {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) { status.textContent = 'SpeechRecognition not supported.'; return; }

  const rec = new Rec();
  rec.lang = 'en-US';
  rec.interimResults = false;
  status.textContent = 'Listening…';

  rec.onresult = ({ results }) => {
    const t = results[0][0].transcript.toLowerCase().trim();
    if (t.includes('rina chan') || t.includes('rina-chan')) {
      speak('Hai!', 'ja-JP');
      setTimeout(listenCommand, 1100);
    } else {
      dispatchQuery(t);
    }
  };

  rec.onerror = e => status.textContent = `Error: ${e.error}`;
  rec.start();
}

/* ───────── command listener ───────── */
function listenCommand() {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new Rec();
  rec.lang = 'en-US';
  status.textContent = 'Listening for your command…';

  rec.onresult = ({ results }) => {
    const q = results[0][0].transcript.trim();
    q ? dispatchQuery(q) : status.textContent = 'No command.';
  };

  rec.onerror = e => status.textContent = `Error: ${e.error}`;
  rec.start();
}

/* ───────── Dispatcher ───────── */
function dispatchQuery(q) {
  grid.innerHTML = '';
  status.textContent = `Searching “${q}”…`;
  speak(`Here are the results for ${q}`, 'en-US');
  mode === 'autoplay' ? autoplay(q) : listResults(q);
}

/* ───────── Helpers ───────── */
const SEARCH = 'https://www.googleapis.com/youtube/v3/search';
const isAndroid = /android/i.test(navigator.userAgent);
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const json = async u => (await fetch(u)).json();

/* Build mobile deep-link */
const deepLink = id => {
  if (isAndroid)
    return `intent://www.youtube.com/watch?v=${id}#Intent;package=com.google.android.youtube;scheme=https;end`;
  if (isIOS)
    return `youtube://www.youtube.com/watch?v=${id}`;
  return `https://www.youtube.com/watch?v=${id}&autoplay=1`;
};

/* ───────── Autoplay mode ───────── */
async function autoplay(q) {
  try {
    status.textContent = 'Fetching results…';
    const p = new URLSearchParams({ part: 'snippet', maxResults: 1, q, type: 'video', key: YT_API_KEY });
    const id = (await json(`${SEARCH}?${p}`)).items?.[0]?.id?.videoId;

    if (!id) {
      status.textContent = 'No match.';
      return;
    }

    const url = deepLink(id);
    window.open(url, '_blank');
    status.textContent = 'Opened in new tab.';
  } catch {
    status.textContent = 'Search failed.';
  }
}

/* ───────── Search-only mode ───────── */
async function listResults(q) {
  try {
    status.textContent = 'Fetching results…';
    const p = new URLSearchParams({ part: 'snippet', maxResults: 8, q, type: 'video', key: YT_API_KEY });
    const data = await json(`${SEARCH}?${p}`);

    if (!data.items?.length) {
      status.textContent = 'No results.';
      return;
    }

    data.items.forEach((it, i) => {
      const { videoId: id } = it.id;
      const { title, thumbnails } = it.snippet;

      const a = document.createElement('a');
      a.href = deepLink(id);
      a.target = '_blank';
      a.className = 'bg-[#181818] rounded-lg overflow-hidden transform transition hover:scale-[1.03]';
      a.style.animation = `fadeIn .4s ease ${i * 70}ms forwards`;

      a.innerHTML = `
        <img src="${thumbnails.high.url}" alt="${title}" class="w-full object-cover">
        <div class="p-3 text-xs text-gray-200">${title}</div>`;
      grid.appendChild(a);
    });

    status.textContent = 'Results ready.';
  } catch {
    status.textContent = 'Search failed.';
  }
}
