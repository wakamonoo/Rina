import { YT_API_KEY } from './config.js';

/* DOM refs */
const status  = document.getElementById('status');
const grid    = document.getElementById('results');
const btnAuto = document.getElementById('modeAutoplay');
const btnSrch = document.getElementById('modeSearch');
const micBtn  = document.getElementById('startBtn');

/* Mode state (toggled by buttons) */
let mode = 'autoplay';
updateButtons();
btnAuto.onclick = () => { mode = 'autoplay'; updateButtons(); };
btnSrch.onclick = () => { mode = 'search';  updateButtons(); };

function updateButtons() {
  btnAuto.classList.toggle('bg-red-600', mode === 'autoplay');
  btnAuto.classList.toggle('bg-gray-700', mode !== 'autoplay');
  btnSrch.classList.toggle('bg-red-600', mode === 'search');
  btnSrch.classList.toggle('text-white',  mode === 'search');
  btnSrch.classList.toggle('bg-gray-700', mode !== 'search');
}

/* Helper: speak with female voice preference */
function speak(text, lang='en-US') {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang; u.pitch = 1.4; u.rate = 1;
  const pick = () => {
    const v = speechSynthesis.getVoices()
      .find(v => v.lang === lang && /(female|kyoko|mizuki)/i.test(v.name));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  };
  speechSynthesis.getVoices().length
    ? pick()
    : speechSynthesis.addEventListener('voiceschanged', pick, { once:true });
}

/* Mic click -> wake listening */
micBtn.onclick = listenWake;

function listenWake() {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) { status.textContent = 'SpeechRecognition not supported.'; return; }

  const rec = new Rec();
  rec.lang = 'en-US'; rec.interimResults = false;
  status.textContent = 'Listening…';

  rec.onresult = ({ results }) => {
    const t = results[0][0].transcript.toLowerCase().trim();
    if (t.includes('rina chan') || t.includes('rina-chan')) {
      speak('Hai!', 'ja-JP');
      setTimeout(listenCommand, 1100);
    } else {
      processQuery(t);
    }
  };
  rec.onerror = e => status.textContent = `Error: ${e.error}`;
  rec.start();
}

function listenCommand() {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new Rec();
  rec.lang = 'en-US';
  status.textContent = 'Listening for your command…';

  rec.onresult = ({ results }) => {
    const q = results[0][0].transcript.trim();
    q ? processQuery(q) : status.textContent = 'No command.';
  };
  rec.onerror = e => status.textContent = `Error: ${e.error}`;
  rec.start();
}

/* Main dispatcher */
function processQuery(q) {
  grid.innerHTML = '';
  status.textContent = `Searching “${q}”…`;
  speak(`Here are the results for ${q}`, 'en-US');
  mode === 'autoplay' ? autoplay(q) : showGrid(q);
}

/* Fetch helpers */
const SEARCH = 'https://www.googleapis.com/youtube/v3/search';
const mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
const j = async u => (await fetch(u)).json();

/* Autoplay mode */
async function autoplay(q) {
  try {
    const p = new URLSearchParams({ part:'snippet', maxResults:1, q, type:'video', key:YT_API_KEY });
    const v = (await j(`${SEARCH}?${p}`)).items?.[0]?.id?.videoId;
    if (!v) { status.textContent = 'No match.'; return; }
    const url = mobile
      ? `https://www.youtube.com/watch?v=${v}`
      : `https://www.youtube.com/watch?v=${v}&autoplay=1`;
    window.open(url, '_blank');
    status.textContent = 'Opened in new tab.';
  } catch { status.textContent = 'Search failed.'; }
}

/* Grid mode */
async function showGrid(q) {
  try {
    const p = new URLSearchParams({ part:'snippet', maxResults:8, q, type:'video', key:YT_API_KEY });
    const data = await j(`${SEARCH}?${p}`);
    if (!data.items?.length) { status.textContent = 'No results.'; return; }

    data.items.forEach((it,i) => {
      const id = it.id.videoId;
      const { title, thumbnails } = it.snippet;

      const card = document.createElement('a');
      card.href = `https://www.youtube.com/watch?v=${id}`;
      card.target = '_blank';
      card.className =
        'bg-[#181818] rounded-lg overflow-hidden transform transition hover:scale-[1.03]';
      card.style.animation = `fadeIn .4s ease ${i*70}ms forwards`;

      card.innerHTML = `
        <img src="${thumbnails.high.url}" alt="${title}" class="w-full object-cover">
        <div class="p-3 text-xs text-gray-200">${title}</div>`;
      grid.appendChild(card);
    });
    status.textContent = 'Results ready.';
  } catch { status.textContent = 'Search failed.'; }
}
