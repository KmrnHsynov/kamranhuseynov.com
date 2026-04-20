const WORDS = [
  "SÖYÜD","TANRI","ÜZÜM","VƏTƏN","ATLAS","BAHAR","BORAN","BULUD","DƏNİZ","MARAL","NOHUR","ÖRTÜK","QIZIL","TIKAN","ULDUZ","ÜZGÜN","YETİM","ZƏFƏR","CAVAN","ÇOBAN","DƏMİR","DOLÇA","DÜNYA","LALƏR","FİDAN","QOŞUN","BADAM","BALIQ","BAĞÇA","BƏZƏK","BÖYÜK","BUDAQ","BULAQ","BUZLU","ÇƏMƏN","DAMAR","DİVAR","GÖZƏL","GÜNƏŞ","HƏDƏF","XALÇA","XƏZAN","XİYAR","KANAL","KƏNAR","MAĞAR","MAHİR","MEYVƏ","MURAD","NAXIŞ","NƏSİL","NƏZƏR","QABAN","QAÇAQ","QALİB","QAYIQ","QAZAN","QİYAM","QOYUN","SAMAN","SAVAB","SƏHƏR","SƏRGİ","TANIQ","TƏRƏF","TORBA","TƏNHA","YOLÇU","ÇƏKİC","DƏRYA","DÜZƏN","ƏMƏLİ","FAYDA","FİKİR","HƏYAT","LİRİK","NƏNƏM","YAŞIL","ŞƏHƏR","ŞİMAL","RƏVAN","ÜMMAN","LİMON","NAĞIL","NARIN","PALID","SARIQ","ÇAĞIL","DAŞLI","KÜLƏK","LÜLƏK","NƏFƏS","OTLAQ","OVÇU","ÖMRÜM","RƏQİB","SƏNƏM","SİNİF","BIÇAQ","ABİDƏ","ACILI","AÇIQI","ADLIQ","AĞDAM","AĞLIQ","AHƏNG","AXTAR","AXINI","AXŞAM","AYDIN","AYDIQ","AYRIQ","AYTƏN","AZĞIN","BAĞLI","BAXIŞ","BƏDİR","BƏHRƏ","BƏKİR","BƏLLİ","BEYİN","BİLGİ","BİLİK","BİTKİ","BİTMƏ","BOYLU","BOYNU","BOZUQ","BUDUR","BURAX","BURMA","BURUL","BÜKÜM","BÜKÜŞ","CƏBHƏ","CƏFAİ","CƏHDİ","CƏLDİ","CİDDİ","CİNSİ","CİVAN","COŞQU","ÇAĞIR","ÇALGI","ÇALIQ","ÇAPAR","ÇAPIQ","ÇATAL","ÇƏKƏR","ÇƏLİK","ÇƏPƏR","ÇƏRÇİ","ÇİÇƏK","ÇİLLƏ","ÇİMƏR","ÇİNAR","ÇİYNİ","ÇOVĞU","ÇOXLU","ÇUBUQ","ÇULĞA","DABAN","DAĞAR","DALĞA","DƏRIN","DƏRSİ","DƏRZİ","DİKİŞ","DİLİM","DİŞLİ","DİVAN","DİZİN","DOĞMA","DOĞRU","DOLUB","DONUQ","DÖYMƏ","DÖZÜM","DURUL","DURUR","DÜYMƏ","ELÇİN","ELDAR","ELMİR","ELNUR","ELMAN","ELVƏR","ƏBƏDİ","ƏCƏLİ","ƏFSUN","ƏHALİ","ƏHVAL","ƏKSİK","ƏLCƏK","ƏLVAN","ƏMİNƏ","ƏRAZİ","ƏRKİN","ARSIZ","ƏSƏBİ","ƏSİLİ","FAKİR","FATİH","FƏRDİ","FƏXRI","FİKRİ","FİŞƏK","FORMA","GƏLMƏ","GƏLİŞ","GENİŞ","GİLAS","GİRİŞ","GİZLİ","GÖRÜŞ","GÖTÜR","GÜCLÜ","GÜLƏR","GÜLÜŞ","GÜNDƏ","GÜVƏN","HALAL","HASİL","HƏKİM","HƏLİM","HƏRİF","HƏVƏS","HİKMƏ","HİSSİ","HOVUZ","HÖRÜM","HÖRMƏ","İBRƏT","İDDİA","İDEAL","İDMAN","İKİLİ","İLAHI","İLGƏK","İLKIN","İNSAN","İSLAM","İSTƏK","KAFİR","KAMİL","KATİB","KAYİŞ","KÖMƏK","KÖNÜL","KÖRPÜ","KÖTÜK","KÜÇÜK","KUSMƏ","LAYİQ","LƏPİR","LƏTİF","LİMAN","LİSAN","LÜĞƏT","MƏDƏN","MƏHƏL","MƏNİM","MUĞAM","MULKİ","NASİL","NAZİK","NƏDİM","NƏFİS","NƏĞMƏ","NİFAQ","NİŞAN","NÖQTƏ","NÜFUZ","NÜSXƏ","OBRAZ","ÖNDƏR","ÖYRƏN","QABIQ","QAİMƏ","QARŞI","QAYĞI","QAZAN","QƏBUL","QƏDİM","QƏFƏS","QƏLBİ","QƏLƏM","QƏMGİ","QƏRİB","QIFIL","QOCAL","QONŞU","QURĞU","SADƏL","SAFDİ","SAHİB","SAKİN","SALAM","SALEH","SALIQ","SANKİ","SARAY","SAYAQ","SAYGI","SAYIQ","SƏBƏB","SƏFƏR","SƏHƏR","SƏHNƏ","SƏNƏT","SƏNGƏ","SƏRGİ","SƏTİR","SİLAH","SİRKƏ","SOYAD","SOYUQ","SÖZLƏ","SÖZLÜ","SÜBUT","SÜFRƏ","SÜKUT","SÜRƏT","SÜRGÜ","ŞAGİR","ŞAHİD","ŞAMAR","ŞAXTA","ŞƏKİL","ŞƏKƏR","ŞƏRƏF","ŞƏHƏR","ŞİRİN","TABEL","TALEY","TARİX","TAYFA","TƏKLİ","TƏMƏL","TƏMİZ","TƏRƏF","TƏRZİ","TƏSİR","TİKİŞ","TOXUM","TUFAN","TUTAR","TÜFAN","ULDUZ","UNVAN","ÜMUMİ","ÜSLUB","ÜSTÜN","ÜZLÜK","VAHİD","VÜQAR","VÜSAL","XAHİŞ","XARAB","XATİR","XEYİR","XİLAF","XİLAS","YAĞIŞ","YALAN","YANAR","YANĞI","YAŞAR","YAŞLI","YATAQ","YAZIQ","YERLİ","YOLÇU","YÜNGÜ","ZAHİD","ZALIM","ZAMAN","ZƏRBƏ","ZƏRİF","ZÜLÜM","HAMAM","HƏRİS","HƏYƏT","HİSSƏ","İNCƏL","İNSAF","KİTAB","MAŞIN","MİLLİ","ONLAR","ORAYA","PİŞİK","QABAQ","QAÇAQ","QADIN","QAPIN","QONAQ","QORXU","RƏSUL","SAKİT","TALEH","TƏRİF","TƏBİB","ALMAN","RAHAT","DARAQ","QARĞA","İSPAN","DÖNƏR","ƏLAVƏ","SƏNƏD","KƏLƏM"
].filter(w => {
  const clean = w.replace(/[^A-ZƏŞÇĞIİÖÜa-zəşçğıiöü]/gi, '');
  return clean.length === 5;
}).map(w => w.toUpperCase());

const WORD_LIST = [...new Set(WORDS)];
const VALID_SET = new Set(WORD_LIST);

const WIN_MSG  = ["Təbriklərrr!", "Halaldır!", "Bu işi bacarırsan!", "Əlasan!", "Babat"];
const LOSE_MSG = ["Bu səfər alınmadı :( Söz: ", "Məğlub oldun. Söz: ", "Növbəti dəfə bacaracaqsan! Söz: ", "Çətin idi, hə? Söz: ", "Yenə cəhd et! Söz: "];

const KB_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "Ü", "İ", "O", "P", "Ö", "Ğ"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "I", "Ə"],
  ["SİL", "Z", "X", "C", "V", "B", "N", "M", "Ç", "Ş", "DAXİL"]
];

let target = "", currentRow = 0, currentCol = 0, gameOver = false, mode = "daily", revealing = false;
let board = Array.from({ length: 6 }, () => Array(5).fill(""));
let keyStates = {};

function getDailyWord() {
  const start = new Date(2024, 0, 1);
  const diff = Math.floor((new Date() - start) / 864e5);
  return WORD_LIST[diff % WORD_LIST.length];
}

function setMode(m) {
  mode = m;
  document.getElementById('btn-daily').classList.toggle('active', m === 'daily');
  document.getElementById('btn-random').classList.toggle('active', m === 'random');
  initGame();
}

function initGame() {
  target = mode === 'daily' ? getDailyWord() : WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
  currentRow = 0; currentCol = 0; gameOver = false; revealing = false;
  board = Array.from({ length: 6 }, () => Array(5).fill(""));
  keyStates = {};
  renderGrid();
  renderKeyboard();
}

function renderGrid() {
  const g = document.getElementById('grid');
  g.innerHTML = '';
  for (let r = 0; r < 6; r++) {
    const row = document.createElement('div');
    row.className = 'row'; row.id = 'row-' + r;
    for (let c = 0; c < 5; c++) {
      const t = document.createElement('div');
      t.className = 'tile'; t.id = `tile-${r}-${c}`;
      row.appendChild(t);
    }
    g.appendChild(row);
  }
}

function renderKeyboard() {
  const kb = document.getElementById('keyboard');
  kb.innerHTML = '';
  KB_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';
    row.forEach(k => {
      const btn = document.createElement('button');
      btn.className = 'key' + (k === 'SİL' || k === 'DAXİL' ? ' wide' : '');
      btn.textContent = k;
      btn.id = 'key-' + k;
      if (keyStates[k]) btn.classList.add(keyStates[k]);
      btn.addEventListener('click', () => handleKey(k));
      rowEl.appendChild(btn);
    });
    kb.appendChild(rowEl);
  });
}

function updateTile(r, c, letter) {
  const t = document.getElementById(`tile-${r}-${c}`);
  t.textContent = letter;
  t.classList.toggle('filled', !!letter);
}

function handleKey(k) {
  if (gameOver || revealing) return;
  if (k === 'SİL') {
    if (currentCol > 0) {
      currentCol--;
      board[currentRow][currentCol] = "";
      updateTile(currentRow, currentCol, "");
    }
  } else if (k === 'DAXİL') {
    submitRow();
  } else if (currentCol < 5) {
    board[currentRow][currentCol] = k;
    updateTile(currentRow, currentCol, k);
    currentCol++;
  }
}

function submitRow() {
  if (currentCol < 5) { showToast("5 hərf daxil edin!"); shakeRow(currentRow); return; }
  const guess = board[currentRow].join('');
  if (!VALID_SET.has(guess)) { showToast("Söz tapılmadı!"); shakeRow(currentRow); return; }
  const result = evaluateGuess(guess);
  revealRow(currentRow, result, () => {
    updateKeyStates(board[currentRow], result);
    renderKeyboard();
    if (result.every(r => r === 'correct')) {
      gameOver = true;
      setTimeout(() => showToast(WIN_MSG[Math.floor(Math.random() * WIN_MSG.length)], 3000), 400);
    } else if (currentRow === 5) {
      gameOver = true;
      setTimeout(() => showToast(LOSE_MSG[Math.floor(Math.random() * LOSE_MSG.length)] + target, 4000), 400);
    }
    currentRow++; currentCol = 0;
  });
}

function evaluateGuess(guess) {
  const res = Array(5).fill('absent');
  const tArr = target.split(''), gArr = guess.split(''), used = Array(5).fill(false);
  for (let i = 0; i < 5; i++) {
    if (gArr[i] === tArr[i]) { res[i] = 'correct'; used[i] = true; }
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] === 'correct') continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && gArr[i] === tArr[j]) { res[i] = 'present'; used[j] = true; break; }
    }
  }
  return res;
}

function revealRow(row, result, cb) {
  revealing = true;
  result.forEach((res, i) => {
    setTimeout(() => {
      const t = document.getElementById(`tile-${row}-${i}`);
      t.classList.add('reveal');
      setTimeout(() => { t.classList.add(res); t.classList.remove('reveal'); }, 250);
    }, i * 300);
  });
  setTimeout(() => { revealing = false; cb(); }, result.length * 300 + 300);
}

function updateKeyStates(letters, results) {
  const p = { correct: 3, present: 2, absent: 1 };
  letters.forEach((l, i) => {
    const cur = keyStates[l];
    if (!cur || (p[results[i]] || 0) > (p[cur] || 0)) keyStates[l] = results[i];
  });
}

function shakeRow(r) {
  document.getElementById('row-' + r).querySelectorAll('.tile').forEach(t => {
    t.classList.remove('shake');
    void t.offsetWidth;
    t.classList.add('shake');
    setTimeout(() => t.classList.remove('shake'), 500);
  });
}

let toastTimer;
function showToast(msg, dur = 2000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), dur);
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  document.body.classList.toggle('light');
}

function showHelp()  { document.getElementById('modal').style.display = 'flex'; }
function closeModal(){ document.getElementById('modal').style.display = 'none'; }

document.addEventListener('keydown', e => {
  if (e.key === 'Backspace') { handleKey('SİL'); return; }
  if (e.key === 'Enter')     { handleKey('DAXİL'); return; }
  const k = e.key.toUpperCase();
  const allKeys = KB_ROWS.flat().filter(x => x !== 'SİL' && x !== 'DAXİL');
  if (allKeys.includes(k)) handleKey(k);
});

initGame();
