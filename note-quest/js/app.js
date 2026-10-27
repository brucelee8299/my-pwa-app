import {
  LETTERS, SOLFEGE, JIANPU, NOTE_COLORS, CLEFS, splitKey, describe, diatonic, noteFromDiatonic,
  freqOf, noteFromMidi, relOf, positionName, letterOf, solfegeOf, colorOf, jianpuOf,
} from './music.js';
import { ISLANDS, STAGES, LEVELS, WORDS, GAMES, poolUpTo, ALL_CARDS } from './curriculum.js';
import {
  todayKey, addDays, parseKey, newCard, recordAnswer, cardStats, MASTERY, masteryOf, introduced, dueCards,
  pickNext, weakest, currentStage, stageStars, newNotesOf, bossReady, bossStars, evaluateLevel, currentLevel,
  streakOf, summary, earnedBadges, topConfusions, dailyPlan, dayChecked,
} from './srs.js';
import { staffSvg, noteGroup, layoutOf, CLEF_W } from './staff.js';
import { playFreq, playMelody, sfx, unlockAudio, setSoundEnabled, midiSupported, connectMidi } from './audio.js';
import { loadState, saveState, importState, createDefaultState } from './store.js';

let state = loadState();
setSoundEnabled(state.settings.sound);
const ui = { tab: 'home', gallery: 'treble', gameClef: 'all' };
let installEvent = null;
let midiOn = false;
let active = null; // 当前游戏/测验的输入处理：{ onName(letter), onNote(id|null) }

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (x) => `${Math.round(x * 100)}%`;
const sec = (ms) => (ms === null || ms === undefined ? '—' : `${(ms / 1000).toFixed(1)} 秒`);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const today = () => todayKey();
const bossEmoji = (st) => st.boss.split(' ')[0];
const bossName = (st) => st.boss.split(' ').slice(1).join(' ');

function commit() {
  if (!saveState(state)) toast('⚠️ 保存失败：浏览器存储空间不足或被禁用');
}

// ---------- 记录 ----------
function dayRec() {
  const t = today();
  return (state.days[t] ??= { ms: 0, q: 0, ok: 0, done: false });
}
function record(key, correct, ms, given, { srs = true } = {}) {
  const t = today();
  const c = (state.cards[key] ??= newCard(t));
  recordAnswer(c, correct, ms, t, { srs });
  const d = dayRec();
  d.q += 1;
  if (correct) d.ok += 1;
  if (!correct && given) state.confusions[`${key}>${given}`] = (state.confusions[`${key}>${given}`] || 0) + 1;
  commit();
}
function addTime(ms) { dayRec().ms += Math.max(0, Math.min(ms, 20000)); commit(); }
function introduce(keys) {
  const t = today();
  for (const k of keys) {
    state.cards[k] ??= newCard(t);
    state.cards[k].intro ||= t;
  }
  commit();
}

// ---------- 通用组件 ----------
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2200);
  setTimeout(() => el.remove(), 2700);
}
function confetti(n = 90) {
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.style.left = `${Math.random() * 100}%`;
    s.style.background = NOTE_COLORS[i % 7];
    s.style.animationDelay = `${Math.random() * 0.6}s`;
    s.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3800);
}
function openSheet(html) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-backdrop';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="sheet-x" data-action="close-sheet" aria-label="关闭">✕</button>${html}</div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeSheet(); });
  document.body.appendChild(wrap);
  return wrap.firstElementChild;
}
function closeSheet() { $$('.sheet-backdrop').forEach((x) => x.remove()); }
const bar = (rate, color = '') => `<div class="bar"><span style="width:${Math.min(100, Math.max(0, rate * 100))}%${color ? `;background:${color}` : ''}"></span></div>`;

function jianpuHtml(id) {
  const { num, dots } = jianpuOf(id);
  const d = '•'.repeat(Math.abs(dots));
  return `<span class="jp">${dots > 0 ? `<i>${d}</i>` : ''}<b>${num}</b>${dots < 0 ? `<i>${d}</i>` : ''}</span>`;
}
/** 音名 · 唱名 · 简谱 的小标签 */
function nameTag(id, big = false) {
  return `<span class="ntag ${big ? 'big' : ''}" style="--nc:${colorOf(id)}"><b>${letterOf(id)}</b><em>${solfegeOf(id)}</em>${state.settings.showJianpu ? jianpuHtml(id) : ''}</span>`;
}

// ---------- 键盘与答题按钮 ----------
/** 键盘范围：覆盖题库，至少两个八度，并包含中央C */
function kbRange(pool) {
  const ds = pool.map((k) => diatonic(splitKey(k).id));
  const mn = Math.min(28, ...ds);
  const mx = Math.max(28, ...ds);
  let lo = mn % 7 === 6 ? mn : Math.floor(mn / 7) * 7;
  let hi = mx % 7 === 0 ? mx : Math.floor(mx / 7) * 7 + 6;
  while (hi - lo + 1 < 14) { if (28 - lo <= hi - 28) lo -= 7; else hi += 7; }
  return [lo, hi];
}
function keyboardHtml([lo, hi], { mini = false, labels = state.settings.keyLabels } = {}) {
  const whites = [];
  for (let d = lo; d <= hi; d++) whites.push(noteFromDiatonic(d));
  const n = whites.length;
  const w = 100 / n;
  const bw = w * 0.62;
  let keys = '';
  whites.forEach((id, i) => {
    const l = id[0];
    let lab = '';
    if (id === 'C4') lab = '<em>中C</em>';
    else if (labels === 'all' || (labels === 'c' && l === 'C')) lab = l;
    keys += `<button class="wk" data-note="${id}" style="left:${i * w}%;width:${w}%" tabindex="-1" aria-label="${id}">${mini ? '' : `<span>${lab}</span>`}</button>`;
  });
  whites.forEach((id, i) => {
    if (i < n - 1 && !'EB'.includes(id[0])) keys += `<button class="bk" data-black="1" style="left:${(i + 1) * w - bw / 2}%;width:${bw}%" tabindex="-1" aria-label="黑键"></button>`;
  });
  return `<div class="kb-scroll"><div class="kb ${mini ? 'mini' : ''}" style="${mini ? '' : `min-width:${n * 30}px`}">${keys}</div></div>`;
}
function centerKeyboard(root, id = 'C4') {
  const sc = $('.kb-scroll', root);
  const key = sc && $(`[data-note="${id}"]`, sc);
  if (key && sc.scrollWidth > sc.clientWidth) sc.scrollLeft = key.offsetLeft - sc.clientWidth / 2 + key.offsetWidth / 2;
}
function nameButtonsHtml() {
  return `<div class="names">${LETTERS.map((l, i) => `<button class="nb" data-letter="${l}" style="--nc:${NOTE_COLORS[i]}"><b>${SOLFEGE[i]}</b><span>${l}${state.settings.showJianpu ? ` · ${JIANPU[i]}` : ''}</span></button>`).join('')}</div>`;
}
function bindAnswerInputs(root) {
  root.addEventListener('pointerdown', (e) => {
    const nb = e.target.closest('.nb');
    const wk = e.target.closest('.wk');
    const bk = e.target.closest('.bk');
    if (!active || (!nb && !wk && !bk)) return;
    if (e.target.closest('.kb.mini')) return;
    e.preventDefault();
    unlockAudio();
    if (nb) active.onName?.(nb.dataset.letter, nb);
    else if (wk) active.onNote?.(wk.dataset.note, wk);
    else active.onNote?.(null, bk);
  });
}
function pressFx(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// ---------- 全屏游戏层 ----------
let cleanup = null;
function openPlay(cls = '') {
  closeSheet();
  cleanup?.();
  cleanup = null;
  let el = $('#play');
  if (!el) {
    el = document.createElement('div');
    el.id = 'play';
    document.body.appendChild(el);
    bindAnswerInputs(el);
  }
  el.className = cls;
  el.innerHTML = '';
  document.body.classList.add('playing');
  return el;
}
function closePlay() {
  cleanup?.();
  cleanup = null;
  active = null;
  $('#play')?.remove();
  document.body.classList.remove('playing');
  render();
}
function topBar(title, meta = '') {
  return `<div class="play-top"><button class="icon-btn" data-act="quit" aria-label="退出">✕</button><div class="pt-title">${title}</div><div class="pt-meta">${meta}</div></div>`;
}
function confirmQuit(onQuit) {
  const s = openSheet(`<h2>要退出吗？</h2><p class="muted">这一轮的进度不会保存成绩（已经答过的题会记住）。</p>
    <div class="row"><button class="btn" data-action="close-sheet">继续玩</button><button class="btn primary" id="do-quit">退出</button></div>`);
  $('#do-quit', s).onclick = () => { closeSheet(); onQuit(); };
}

// ---------- 视图选择 ----------
function viewFor(clef) {
  const v = state.settings.staffView;
  if (v === 'single') return clef;
  if (v === 'grand') return 'grand';
  return currentStage(state) >= 8 ? 'grand' : clef; // 学完五线谱群岛后自动换成大谱表
}
function viewForPool(pool) {
  const clefs = new Set(pool.map((k) => splitKey(k).clef));
  return clefs.size > 1 ? 'grand' : viewFor([...clefs][0] || 'treble');
}

// ================= 测验引擎（练习 / 快闪 / BOSS） =================
/**
 * o: { title, pool, focus, seconds | count, mode: drill|speed|boss, perQ, hearts, boss, forceView, srs, onDone }
 * drill：答错必须自己点出正确答案才能继续（自我纠正），并在 2 题后再考一次
 */
function startQuiz(o) {
  const root = openPlay('quiz');
  const q = {
    n: 0, ok: 0, wrong: 0, times: [], combo: 0, maxCombo: 0, misses: {}, recent: [], pending: [],
    hearts: o.hearts || 0, hp: o.boss ? o.count : 0, start: performance.now(), cur: null, done: false, timers: [],
  };
  const range = kbRange(o.pool);
  const hasKb = state.settings.answerMode !== 'name' || midiOn;
  root.innerHTML = `
    ${topBar(o.title, `<span id="q-clock"></span><span id="q-combo"></span><span id="q-hearts"></span>`)}
    <div class="bar thin"><span id="q-prog"></span></div>
    ${o.boss ? `<div class="boss-strip"><div class="boss-emo" id="boss-emo">${o.boss.emoji}</div><div class="boss-info"><b>${esc(o.boss.name)}</b><div class="hp"><span id="boss-hp"></span></div></div></div>` : ''}
    <div class="q-area"><div class="q-staff" id="q-staff"></div>${o.perQ ? '<div class="qtime"><span id="q-time"></span></div>' : ''}</div>
    <div class="q-fb" id="q-fb"></div>
    <div class="q-answer">
      <div id="q-names">${nameButtonsHtml()}</div>
      <div id="q-mini">${keyboardHtml(range, { mini: true })}</div>
      ${hasKb ? `<div id="q-kb" hidden>${keyboardHtml(range)}</div>` : ''}
    </div>`;

  const clockEl = $('#q-clock', root);
  const progEl = $('#q-prog', root);
  const tick = setInterval(() => {
    const el = performance.now() - q.start;
    if (o.seconds) {
      const left = Math.max(0, o.seconds * 1000 - el);
      clockEl.textContent = `⏱ ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
      progEl.style.width = `${Math.min(100, (el / (o.seconds * 1000)) * 100)}%`;
      if (o.mode === 'speed' && left <= 0 && !q.done) finish();
    } else {
      clockEl.textContent = `${o.boss ? `⚔️ ${o.count - q.hp}` : q.n}/${o.count}`;
      progEl.style.width = `${((o.boss ? o.count - q.hp : q.n) / o.count) * 100}%`;
    }
  }, 200);
  cleanup = () => { clearInterval(tick); q.timers.forEach(clearTimeout); };

  const later = (fn, ms) => q.timers.push(setTimeout(fn, ms));
  const updateMeta = () => {
    $('#q-combo', root).textContent = q.combo >= 3 ? `🔥${q.combo}` : '';
    $('#q-hearts', root).textContent = o.hearts ? '❤️'.repeat(Math.max(0, q.hearts)) + '🤍'.repeat(o.hearts - Math.max(0, q.hearts)) : (o.mode === 'speed' ? `✅ ${q.ok}` : '');
    if (o.boss) $('#boss-hp', root).style.width = `${(q.hp / o.count) * 100}%`;
  };
  updateMeta();

  function shouldEnd() {
    if (o.boss) return q.hp <= 0 || q.hearts <= 0;
    if (o.count) return q.n >= o.count;
    return performance.now() - q.start >= o.seconds * 1000;
  }
  function drawStaff(c, extra = {}) {
    const view = o.forceView || viewFor(c.clef);
    const labels = extra.label ? [{ x: 72, text: `${letterOf(c.id)} ${solfegeOf(c.id)}`, color: extra.color }] : [];
    $('#q-staff', root).innerHTML = staffSvg({
      view, width: 110, labels, cls: `q ${view}`,
      notes: [{ clef: c.clef, id: c.id, x: 72, cls: extra.cls || 'pop-in', color: extra.color || '' }],
    });
  }
  function next() {
    if (q.done) return;
    if (q.cur) addTime(performance.now() - q.cur.shown);
    if (shouldEnd()) { finish(); return; }
    let key;
    const dueIdx = q.pending.findIndex((p) => p.after <= 0);
    if (dueIdx >= 0) key = q.pending.splice(dueIdx, 1)[0].key;
    else key = pickNext(o.pool, state.cards, { today: today(), recent: q.recent, focus: o.focus || [] });
    q.pending.forEach((p) => { p.after -= 1; });
    q.recent.push(key);
    const { clef, id } = splitKey(key);
    const card = state.cards[key];
    let mode = state.settings.answerMode;
    if (mode === 'mix') mode = card && card.box >= 1 && Math.random() < 0.5 ? 'key' : 'name';
    q.cur = { key, clef, id, mode, state: 'ask', shown: performance.now(), t0: performance.now() };
    drawStaff(q.cur);
    $('#q-fb', root).innerHTML = mode === 'key' ? '<div class="fb ask">🎹 在键盘上找到这个音</div>' : '<div class="fb ask">🎵 这是什么音？</div>';
    $$('.nb, .wk, .bk', root).forEach((b) => b.classList.remove('ok', 'bad', 'hint'));
    $('#q-names', root).hidden = mode === 'key';
    $('#q-mini', root).hidden = mode === 'key';
    if ($('#q-kb', root)) $('#q-kb', root).hidden = mode !== 'key';
    if (mode === 'key' && !q.centered) { centerKeyboard($('#q-kb', root)); q.centered = true; }
    requestAnimationFrame(() => { if (q.cur?.key === key) q.cur.t0 = performance.now(); });
    if (o.perQ) {
      const t = $('#q-time', root);
      t.style.transition = 'none';
      t.style.width = '100%';
      void t.offsetWidth;
      t.style.transition = `width ${o.perQ}ms linear`;
      t.style.width = '0%';
      const cur = q.cur;
      later(() => { if (q.cur === cur && cur.state === 'ask') respond({ timeout: true }); }, o.perQ);
    }
  }
  const matches = (c, g) => (g.note !== undefined ? g.note === c.id : g.letter === c.id[0]);

  function respond(g, el) {
    const c = q.cur;
    if (!c || q.done) return;
    if (c.state === 'fix') {
      if (matches(c, g) || (g.note && g.note[0] === c.id[0] && c.mode === 'name')) {
        pressFx(el, 'ok');
        playFreq(freqOf(c.id));
        c.state = 'done';
        later(next, 450);
      } else pressFx(el, 'shake');
      return;
    }
    if (c.state !== 'ask') return;
    const ms = performance.now() - c.t0;
    const correct = !g.timeout && matches(c, g);
    const given = g.timeout ? null : g.note === null ? 'black' : g.note || g.letter;
    record(c.key, correct, ms, given, { srs: o.srs !== false });
    q.n += 1;
    const d = describe(c.clef, c.id);
    const lightKey = (cls) => $$(`[data-note="${c.id}"]`, root).forEach((k) => k.classList.add(cls));
    if (correct) {
      q.ok += 1; q.times.push(ms); q.combo += 1; q.maxCombo = Math.max(q.maxCombo, q.combo);
      c.state = 'done';
      pressFx(el, 'ok');
      lightKey('ok');
      drawStaff(c, { color: d.color, label: true, cls: 'hit' });
      playFreq(freqOf(c.id));
      if (q.combo && q.combo % 5 === 0) sfx('combo');
      const speed = ms <= 1500 ? '⚡ 秒认！' : ms <= 3000 ? '👍 不错' : '🐢 再快一点';
      $('#q-fb', root).innerHTML = `<div class="fb ok">✓ ${nameTag(c.id)} <span>${d.position}</span><small>${sec(ms)} ${speed}</small></div>`;
      if (o.boss) {
        q.hp -= 1;
        const be = $('#boss-emo', root);
        pressFx(be, ms <= 1500 ? 'crit' : 'hurt');
        sfx('hit');
      }
      updateMeta();
      later(next, o.mode === 'speed' ? 380 : 750);
    } else {
      q.wrong += 1; q.combo = 0; q.misses[c.key] = (q.misses[c.key] || 0) + 1;
      q.pending.push({ key: c.key, after: 2 });
      pressFx(el, 'bad');
      sfx('bad');
      later(() => playFreq(freqOf(c.id)), 250);
      lightKey('hint');
      $$(`.nb[data-letter="${c.id[0]}"]`, root).forEach((b) => b.classList.add('hint'));
      drawStaff(c, { color: '#E03131', label: true, cls: 'miss' });
      let why = '';
      if (g.timeout) why = '⏰ 时间到！';
      else if (g.note && g.note[0] === c.id[0]) why = `音名对了，但八度不对：要找${d.key.where}。`;
      const fix = o.mode === 'drill';
      $('#q-fb', root).innerHTML = `<div class="fb bad">
        <div>✗ ${why}这是 ${nameTag(c.id)} <span>${d.position}</span></div>
        <div class="hintline">🧭 ${d.hint}</div>
        ${fix ? `<div class="fixline">👇 ${c.mode === 'key' ? '在键盘上点亮着的键' : '点一下闪烁的正确答案'}，记住它！</div>` : ''}
      </div>`;
      if (o.boss) {
        q.hearts -= 1;
        pressFx($('#boss-emo', root), 'laugh');
      }
      updateMeta();
      if (fix) c.state = 'fix';
      else { c.state = 'done'; later(next, o.mode === 'speed' ? 1300 : 2200); }
    }
  }
  function finish() {
    if (q.done) return;
    if (q.cur && q.cur.state !== 'done') addTime(performance.now() - q.cur.shown);
    q.done = true;
    cleanup?.();
    cleanup = null;
    active = null;
    const avgMs = q.times.length ? q.times.reduce((a, b) => a + b, 0) / q.times.length : null;
    o.onDone({
      n: q.n, ok: q.ok, wrong: q.wrong, acc: q.n ? q.ok / q.n : 0, avgMs, maxCombo: q.maxCombo, misses: q.misses,
      won: o.boss ? q.hp <= 0 && q.hearts > 0 : true,
    });
  }
  active = {
    onName: (letter, el) => respond({ letter }, el),
    onNote: (id, el) => respond({ note: id }, el),
    quit: () => (q.n ? confirmQuit(closePlay) : closePlay()),
  };
  next();
}

// ---------- 结果页 ----------
function missesHtml(misses) {
  const list = Object.entries(misses || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!list.length) return '';
  return `<div class="misses"><h3>需要再看看的音</h3><div class="mini-cards">${list.map(([k]) => miniCard(k)).join('')}</div></div>`;
}
function showResult({ emoji, title, sub = '', stats = [], misses, buttons }) {
  const root = openPlay('result');
  root.innerHTML = `
    <div class="result">
      <div class="res-emoji">${emoji}</div>
      <h2>${title}</h2>
      ${sub ? `<p class="muted">${sub}</p>` : ''}
      <div class="res-stats">${stats.map(([v, l]) => `<div><b>${v}</b><small>${l}</small></div>`).join('')}</div>
      ${missesHtml(misses)}
      <div class="res-btns">${buttons.map((b, i) => `<button class="btn ${b.primary ? 'primary big' : ''}" data-rb="${i}">${b.label}</button>`).join('')}</div>
    </div>`;
  $$('[data-rb]', root).forEach((el) => { el.onclick = () => buttons[Number(el.dataset.rb)].fn(); });
  $$('.mini-card', root).forEach((el) => { el.onclick = () => noteSheet(el.dataset.key); });
}
const quizStats = (r) => [[r.n, '答题'], [pct(r.acc), '正确率'], [sec(r.avgMs), '平均用时'], [r.maxCombo, '最高连击']];

// ================= 新音符介绍 =================
function noteInfoHtml(key, { range } = {}) {
  const { clef, id } = splitKey(key);
  const d = describe(clef, id);
  const view = clef;
  return `
    <div class="intro-staff">${staffSvg({ view, width: 110, notes: [{ clef, id, x: 72, color: d.color, cls: 'pop-in' }], labels: [{ x: 72, text: `${d.letter} ${d.solfege}`, color: d.color }], cls: 'big' })}</div>
    <div class="facts">
      <div class="fact"><i>🔤</i><div><small>音名 · 唱名 · 简谱</small>${nameTag(id, true)}</div></div>
      <div class="fact"><i>📍</i><div><small>在谱上的位置（形）</small><b>${d.position}</b>${d.landmark ? `<p>⭐ 地标音：${d.landmark}</p>` : ''}</div></div>
      <div class="fact"><i>🎹</i><div><small>在钢琴上（意）</small><b>${d.key.spot}</b><p>${d.key.where} · ${d.group.name}（${d.group.mark}）</p></div></div>
      ${d.landmark && !d.mnemonic ? '' : `<div class="fact"><i>🧭</i><div><small>记忆窍门</small>${d.landmark ? '' : `<p>${d.hint}</p>`}${d.mnemonic ? `<p>${d.mnemonic}</p>` : ''}</div></div>`}
    </div>
    ${keyboardHtml(range || kbRange([key]), { mini: false })}`;
}
function showIntro(keys, onDone) {
  introduce(keys);
  let i = 0;
  const root = openPlay('intro');
  const range = kbRange([...keys, ...unlockedLearned()]);
  const draw = () => {
    const key = keys[i];
    const { id } = splitKey(key);
    root.innerHTML = `
      ${topBar(`🐣 认识新朋友 ${i + 1}/${keys.length}`)}
      <div class="intro-card">${noteInfoHtml(key, { range })}</div>
      <p class="sing">🎤 跟着唱一唱：<b>${solfegeOf(id)}～</b>　看谱、按键、唱名，三样连在一起记！</p>
      <div class="row"><button class="btn big" id="i-play">🔊 再听一次</button><button class="btn primary big" id="i-next">${i < keys.length - 1 ? '下一个 ▶' : '开始练习 ▶'}</button></div>`;
    $$('.wk', root).forEach((k) => k.classList.toggle('ok', k.dataset.note === id));
    centerKeyboard(root, id);
    const play = () => playFreq(freqOf(id));
    setTimeout(play, 250);
    $('#i-play', root).onclick = play;
    $('#i-next', root).onclick = () => { if (++i < keys.length) draw(); else onDone(); };
  };
  active = { onNote: (nid, el) => { if (nid) { playFreq(freqOf(nid)); pressFx(el, nid === splitKey(keys[i]).id ? 'ok' : 'tap'); } }, quit: closePlay };
  draw();
}
const unlockedLearned = () => introduced(state).filter((k) => ALL_CARDS.includes(k));

// ================= BOSS =================
function bossPool(i) {
  const st = STAGES[i];
  if (st.id === 'G1') return ALL_CARDS;
  return poolUpTo(i).filter((k) => state.cards[k]?.intro);
}
function startBoss(i, after) {
  const st = STAGES[i];
  sfx('hit');
  startQuiz({
    title: `⚔️ ${esc(st.title)}`, mode: 'boss', pool: bossPool(i), focus: st.notes, count: 20, perQ: 6000, hearts: 3,
    boss: { emoji: bossEmoji(st), name: bossName(st) }, forceView: st.id === 'G1' ? 'grand' : null,
    onDone: (r) => {
      const stars = r.won ? bossStars({ total: r.n, wrong: r.wrong, avgMs: r.avgMs }) : 0;
      const prev = stageStars(state, st.id);
      if (stars > prev) state.stages[st.id] = { stars, acc: r.acc, avgMs: r.avgMs, date: today() };
      commit();
      if (stars) { sfx('win'); confetti(); } else sfx('lose');
      const unlockedNext = stars && !prev && i + 1 < STAGES.length;
      showResult({
        emoji: stars ? '🏆' : '💪',
        title: stars ? `击败 ${bossName(st)}！${'⭐'.repeat(stars)}` : `${bossName(st)} 还没倒下`,
        sub: stars ? (unlockedNext ? `新关卡解锁：${STAGES[i + 1].title}` : i + 1 === STAGES.length ? '🎉 全部通关！你已经是识谱高手了！' : '刷新纪录！') : '错 3 个就会失败，先练练再来挑战。2 星要平均 2.5 秒内，3 星要全对且 1.5 秒内。',
        stats: quizStats(r), misses: r.misses,
        buttons: after ? [{ label: '继续 ▶', primary: true, fn: after }] : [
          { label: '再挑战一次', fn: () => startBoss(i) }, { label: '返回地图', primary: true, fn: closePlay }],
      });
    },
  });
}

// ================= 游戏：音符小火车 =================
function startRain(pool, after) {
  const root = openPlay('rain');
  const view = viewForPool(pool);
  const W = 330;
  const station = CLEF_W + 12;
  const g = { notes: [], speed: 20, lives: 3, score: 0, recent: [], last: performance.now(), raf: 0, over: false, frontSince: performance.now(), start: performance.now() };
  root.innerHTML = `
    ${topBar('🚂 音符小火车', '<span id="r-score"></span><span id="r-lives"></span>')}
    <p class="muted center">音符开到左边红线前，认出最前面那一个！</p>
    <div class="q-staff wide" id="r-staff">${staffSvg({ view, width: W, cls: `rain ${view}`, extra: `<line class="station" x1="${station}" x2="${station}" y1="-80" y2="${view === 'grand' ? 140 : 40}"/><g id="train"></g>` })}</div>
    <div class="q-fb" id="r-fb"></div>
    <div class="q-answer">${nameButtonsHtml()}</div>`;
  const train = $('#train', root);
  const meta = () => {
    $('#r-score', root).textContent = `🚃 ${g.score}`;
    $('#r-lives', root).textContent = '❤️'.repeat(g.lives) + '🤍'.repeat(3 - g.lives);
  };
  meta();
  const spawn = () => {
    const key = pickNext(pool, state.cards, { today: today(), recent: g.recent });
    g.recent.push(key);
    const { clef, id } = splitKey(key);
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    el.setAttribute('class', 'rn');
    el.innerHTML = noteGroup(view, { clef, id, x: 0 });
    train.appendChild(el);
    g.notes.push({ key, clef, id, x: W + 10, el });
  };
  const remove = (n, ok) => {
    const lab = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lab.setAttribute('class', 'nlabel');
    lab.setAttribute('x', '0');
    lab.setAttribute('y', String(layoutOf(view).label));
    lab.setAttribute('text-anchor', 'middle');
    lab.textContent = `${n.id[0]} ${solfegeOf(n.id)}`;
    lab.style.fill = ok ? colorOf(n.id) : '#E03131';
    n.el.appendChild(lab);
    $$('.head, .stem', n.el).forEach((p) => { p.style.fill = ok ? colorOf(n.id) : '#E03131'; p.style.stroke = ok ? colorOf(n.id) : '#E03131'; });
    n.el.classList.add(ok ? 'gone' : 'missed');
    setTimeout(() => n.el.remove(), ok ? 500 : 1100);
    g.notes.shift();
    g.frontSince = performance.now();
  };
  const fail = (n, why) => {
    record(n.key, false, 0, why, {});
    g.lives -= 1;
    sfx('bad');
    playFreq(freqOf(n.id));
    const d = describe(n.clef, n.id);
    $('#r-fb', root).innerHTML = `<div class="fb bad">✗ 那是 ${nameTag(n.id)} <span>${d.position}</span><div class="hintline">🧭 ${d.hint}</div></div>`;
    remove(n, false);
    meta();
    if (g.lives <= 0) end();
  };
  const frame = (ts) => {
    if (g.over) return;
    const dt = Math.min(0.05, (ts - g.last) / 1000);
    g.last = ts;
    const lastX = g.notes.at(-1)?.x ?? -Infinity;
    if (!g.notes.length || lastX < W - 62) spawn();
    for (const n of g.notes) {
      n.x -= g.speed * dt;
      n.el.setAttribute('transform', `translate(${n.x.toFixed(1)} 0)`);
    }
    if (g.notes[0] && g.notes[0].x <= station) fail(g.notes[0], null);
    g.raf = requestAnimationFrame(frame);
  };
  const end = () => {
    if (g.over) return;
    g.over = true;
    cancelAnimationFrame(g.raf);
    addTime(performance.now() - g.start);
    active = null;
    const best = state.best.rain || 0;
    if (g.score > best) { state.best.rain = g.score; commit(); }
    sfx(g.score > best ? 'win' : 'lose');
    setTimeout(() => showResult({
      emoji: '🚂', title: `运送了 ${g.score} 节车厢`, sub: g.score > best ? '🎉 新纪录！' : `最高纪录 ${best}`,
      stats: [[g.score, '本次'], [Math.max(best, g.score), '最高'], [Math.round(g.speed), '最终速度']],
      buttons: after ? [{ label: '继续 ▶', primary: true, fn: after }] : [{ label: '再玩一次', fn: () => startRain(pool) }, { label: '返回', primary: true, fn: closePlay }],
    }), 900);
  };
  cleanup = () => { g.over = true; cancelAnimationFrame(g.raf); };
  active = {
    onName: (letter, el) => {
      const n = g.notes[0];
      if (!n || g.over) return;
      if (letter === n.id[0]) {
        record(n.key, true, performance.now() - g.frontSince, null, {});
        pressFx(el, 'ok');
        playFreq(freqOf(n.id));
        g.score += 1;
        g.speed = Math.min(70, 20 + g.score * 0.9);
        $('#r-fb', root).innerHTML = `<div class="fb ok">✓ ${nameTag(n.id)}</div>`;
        remove(n, true);
        meta();
      } else {
        pressFx(el, 'bad');
        fail(n, letter);
      }
    },
    onNote: (id) => { if (id) active.onName(id[0]); },
    quit: closePlay,
  };
  g.raf = requestAnimationFrame((ts) => { g.last = ts; frame(ts); });
}

// ================= 游戏：音符拼单词 =================
function wordPlan(pool, word) {
  const byLetter = (keys, l) => keys.filter((k) => splitKey(k).id[0] === l);
  const letters = [...word];
  if (!letters.every((l) => byLetter(pool, l).length)) return null;
  const single = ['treble', 'bass'].filter((c) => letters.every((l) => byLetter(pool.filter((k) => k.startsWith(c)), l).length));
  const clef = single.length ? single[Math.floor(Math.random() * single.length)] : null;
  const src = clef ? pool.filter((k) => k.startsWith(clef)) : pool;
  const keys = letters.map((l) => { const c = byLetter(src, l); return c[Math.floor(Math.random() * c.length)]; });
  return { keys, view: clef ? viewFor(clef) : 'grand' };
}
function startWord(pool, after) {
  const words = shuffle(WORDS).map((w) => ({ ...w, plan: wordPlan(pool, w.w) })).filter((w) => w.plan).slice(0, 5);
  if (!words.length) { toast('学过的音还不够拼单词，先去闯关吧'); if (after) after(); return; }
  const root = openPlay('word');
  const g = { wi: 0, idx: 0, perfect: 0, mistakes: 0, fixing: false, t0: performance.now(), start: performance.now() };
  const draw = () => {
    const w = words[g.wi];
    const { keys, view } = w.plan;
    const width = 46 + keys.length * 30;
    const notes = keys.map((k, i) => {
      const { clef, id } = splitKey(k);
      return { clef, id, x: 48 + i * 30, cls: i === g.idx ? 'cur' : '', color: i < g.idx ? colorOf(id) : '' };
    });
    $('#w-staff', root).innerHTML = staffSvg({ view, width, notes, cls: `word ${view}` });
    $('#w-blanks', root).innerHTML = keys.map((k, i) => `<span class="blank ${i === g.idx ? 'cur' : ''}" style="${i < g.idx ? `--nc:${colorOf(splitKey(k).id)}` : ''}">${i < g.idx ? w.w[i] : ''}</span>`).join('');
    $('#w-count', root).textContent = `${g.wi + 1}/${words.length}`;
    g.t0 = performance.now();
  };
  root.innerHTML = `
    ${topBar('🔤 音符拼单词', '<span id="w-count"></span>')}
    <p class="muted center">从左到右认出每个音，拼出一个英文单词</p>
    <div class="q-staff wide" id="w-staff"></div>
    <div class="blanks" id="w-blanks"></div>
    <div class="q-fb" id="w-fb"></div>
    <div class="q-answer" id="w-ans">${nameButtonsHtml()}</div>`;
  const reveal = () => {
    const w = words[g.wi];
    const ok = g.mistakes === 0;
    if (ok) g.perfect += 1;
    playMelody(w.plan.keys.map((k) => freqOf(splitKey(k).id)));
    $('#w-fb', root).innerHTML = `<div class="word-reveal"><span class="we">${w.e}</span><b>${w.w}</b><span>${w.cn}</span>${ok ? '<em>⭐ 全对！</em>' : ''}</div>
      <button class="btn primary big" id="w-next">${g.wi < words.length - 1 ? '下一个单词 ▶' : '看成绩 ▶'}</button>`;
    $('#w-ans', root).hidden = true;
    $('#w-next', root).onclick = () => {
      if (++g.wi >= words.length) return end();
      g.idx = 0; g.mistakes = 0;
      $('#w-ans', root).hidden = false;
      $('#w-fb', root).innerHTML = '';
      draw();
    };
  };
  const end = () => {
    addTime(performance.now() - g.start);
    active = null;
    const best = state.best.word || 0;
    if (g.perfect > best) { state.best.word = g.perfect; commit(); }
    sfx('win');
    showResult({
      emoji: '🔤', title: `拼对 ${words.length} 个单词`, sub: `其中 ${g.perfect} 个一次全对${g.perfect > best ? ' · 🎉 新纪录！' : ''}`,
      stats: [[g.perfect, '全对单词'], [words.length, '单词数']],
      buttons: after ? [{ label: '继续 ▶', primary: true, fn: after }] : [{ label: '再玩一次', fn: () => startWord(pool) }, { label: '返回', primary: true, fn: closePlay }],
    });
  };
  active = {
    onName: (letter, el) => {
      const w = words[g.wi];
      const key = w.plan.keys[g.idx];
      if (!key) return;
      const { clef, id } = splitKey(key);
      if (letter === id[0]) {
        if (!g.fixing) record(key, true, performance.now() - g.t0, null, {});
        g.fixing = false;
        pressFx(el, 'ok');
        playFreq(freqOf(id));
        $$('.nb', root).forEach((b) => b.classList.remove('hint'));
        $('#w-fb', root).innerHTML = '';
        g.idx += 1;
        draw();
        if (g.idx >= w.plan.keys.length) reveal();
      } else {
        pressFx(el, 'bad');
        sfx('bad');
        if (!g.fixing) { record(key, false, 0, letter, {}); g.mistakes += 1; }
        g.fixing = true;
        $$(`.nb[data-letter="${id[0]}"]`, root).forEach((b) => b.classList.add('hint'));
        const d = describe(clef, id);
        $('#w-fb', root).innerHTML = `<div class="fb bad">这是 ${nameTag(id)} <span>${d.position}</span><div class="hintline">🧭 ${d.hint}</div><div class="fixline">👇 点一下闪烁的正确答案</div></div>`;
      }
    },
    onNote: (id) => { if (id) active.onName(id[0]); },
    quit: () => confirmQuit(closePlay),
  };
  draw();
}

// ================= 游戏：摆音符（反向练习：音/键 → 谱） =================
function startPlace(pool, after) {
  const root = openPlay('place');
  const g = { i: 0, total: 10, ok: 0, recent: [], cur: null, rel: null, checked: false, start: performance.now() };
  const range = kbRange(pool);
  root.innerHTML = `
    ${topBar('🎯 摆音符', '<span id="p-count"></span>')}
    <div class="place-prompt" id="p-prompt"></div>
    <div id="p-kb">${keyboardHtml(range, { mini: true })}</div>
    <div class="q-staff place" id="p-staff"></div>
    <div class="q-fb" id="p-fb"></div>
    <div class="row place-ctrl"><button class="btn big" id="p-up" aria-label="上移">⬆️</button><button class="btn big" id="p-down" aria-label="下移">⬇️</button><button class="btn primary big" id="p-ok">✓ 确定</button></div>`;
  const bottomStep = (clef) => CLEFS[clef].bottom;
  const idFromRel = (clef, rel) => noteFromDiatonic(rel + bottomStep(clef) + 28);
  const drawStaff = () => {
    const { clef, id } = g.cur;
    const notes = [];
    if (g.checked) {
      if (g.rel !== relOf(clef, id) && g.rel !== null) notes.push({ clef, id: idFromRel(clef, g.rel), x: 60, color: '#E03131' });
      notes.push({ clef, id, x: g.rel === relOf(clef, id) ? 72 : 86, color: '#2B8A3E' });
    } else if (g.rel !== null) notes.push({ clef, id: idFromRel(clef, g.rel), x: 72, cls: 'ghost' });
    $('#p-staff', root).innerHTML = staffSvg({ view: clef, width: 110, notes, cls: 'big tap' });
  };
  const ask = () => {
    if (g.i >= g.total) return end();
    const key = pickNext(pool, state.cards, { today: today(), recent: g.recent });
    g.recent.push(key);
    g.cur = splitKey(key);
    g.cur.key = key;
    g.rel = null;
    g.checked = false;
    const { clef, id } = g.cur;
    $('#p-count', root).textContent = `${g.i + 1}/${g.total}`;
    $('#p-prompt', root).innerHTML = `<div>把 ${nameTag(id, true)} 摆到 <b>${CLEFS[clef].staff}</b> 上</div><button class="btn small" id="p-play">🔊 听</button>`;
    $('#p-play', root).onclick = () => playFreq(freqOf(id));
    $$('.wk', root).forEach((k) => k.classList.toggle('ok', k.dataset.note === id));
    $('#p-fb', root).innerHTML = '<div class="fb ask">👆 点五线谱放音符，可用 ⬆️⬇️ 微调，再点确定</div>';
    $('#p-ok', root).textContent = '✓ 确定';
    setTimeout(() => playFreq(freqOf(id)), 200);
    drawStaff();
  };
  const move = (dr) => {
    if (g.checked) return;
    g.rel = Math.max(-6, Math.min(14, (g.rel ?? 4) + dr));
    drawStaff();
    playFreq(freqOf(idFromRel(g.cur.clef, g.rel)), { vol: 0.15, dur: 0.6 });
  };
  $('#p-staff', root).addEventListener('pointerdown', (e) => {
    const svg = $('svg', $('#p-staff', root));
    if (!svg || g.checked) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    g.rel = Math.max(-6, Math.min(14, Math.round(-p.y / 5)));
    drawStaff();
    playFreq(freqOf(idFromRel(g.cur.clef, g.rel)), { vol: 0.15, dur: 0.6 });
  });
  $('#p-up', root).onclick = () => move(1);
  $('#p-down', root).onclick = () => move(-1);
  $('#p-ok', root).onclick = () => {
    if (g.checked) { g.i += 1; ask(); return; }
    if (g.rel === null) { toast('先在五线谱上点一下放音符'); return; }
    const { clef, id, key } = g.cur;
    const target = relOf(clef, id);
    const ok = g.rel === target;
    record(key, ok, 0, ok ? null : idFromRel(clef, g.rel), { srs: false });
    g.checked = true;
    if (ok) { g.ok += 1; sfx('ok'); } else sfx('bad');
    playFreq(freqOf(id));
    drawStaff();
    $('#p-fb', root).innerHTML = ok
      ? `<div class="fb ok">✓ 对了！${nameTag(id)} 在 <span>${positionName(target)}</span></div>`
      : `<div class="fb bad">✗ 你放在了${positionName(g.rel)}（${idFromRel(clef, g.rel)[0]}），${id[0]} 应该在<b>${positionName(target)}</b>（绿色）<div class="hintline">🧭 ${describe(clef, id).hint}</div></div>`;
    $('#p-ok', root).textContent = g.i < g.total - 1 ? '下一题 ▶' : '看成绩 ▶';
  };
  const end = () => {
    addTime(performance.now() - g.start);
    active = null;
    const best = state.best.place || 0;
    if (g.ok > best) { state.best.place = g.ok; commit(); }
    sfx(g.ok >= 8 ? 'win' : 'lose');
    showResult({
      emoji: '🎯', title: `摆对 ${g.ok}/${g.total}`, sub: g.ok > best ? '🎉 新纪录！' : `最高纪录 ${best}`,
      stats: [[g.ok, '摆对'], [g.total, '题数']],
      buttons: after ? [{ label: '继续 ▶', primary: true, fn: after }] : [{ label: '再玩一次', fn: () => startPlace(pool) }, { label: '返回', primary: true, fn: closePlay }],
    });
  };
  active = { onNote: () => {}, quit: () => confirmQuit(closePlay) };
  ask();
}

// ================= 游戏：60 秒快闪 =================
function startSpeed(pool, after) {
  startQuiz({
    title: '⚡ 60 秒快闪', mode: 'speed', pool, seconds: 60,
    onDone: (r) => {
      const best = state.best.speed || 0;
      if (r.ok > best) { state.best.speed = r.ok; commit(); }
      sfx(r.ok > best ? 'win' : 'ok');
      if (r.ok > best) confetti(50);
      showResult({
        emoji: '⚡', title: `60 秒认对 ${r.ok} 个`, sub: r.ok > best ? '🎉 新纪录！' : `最高纪录 ${best}`,
        stats: quizStats(r), misses: r.misses,
        buttons: after ? [{ label: '继续 ▶', primary: true, fn: after }] : [{ label: '再来一次', fn: () => startSpeed(pool) }, { label: '返回', primary: true, fn: closePlay }],
      });
    },
  });
}
const GAME_FN = { speed: startSpeed, rain: startRain, word: startWord, place: startPlace };

// ================= 今日训练 =================
function startDaily() {
  unlockAudio();
  const phases = dailyPlan(state, today(), state.settings.dailyMinutes);
  const total = phases.length;
  const label = (i) => `${i + 1}/${total} ${phases[i].icon} ${phases[i].title}`;
  const run = (i) => {
    if (i >= phases.length) return finishDaily();
    const p = phases[i];
    const after = () => run(i + 1);
    const resultThen = (r) => showResult({
      emoji: r.acc >= 0.9 ? '🌟' : r.acc >= 0.7 ? '👍' : '💪', title: `${p.title} 完成`, sub: i + 1 < total ? `下一步：${phases[i + 1].icon} ${phases[i + 1].title}` : '',
      stats: quizStats(r), misses: r.misses, buttons: [{ label: '继续 ▶', primary: true, fn: after }],
    });
    const learned = introduced(state);
    if (p.type === 'review') {
      startQuiz({ title: label(i), mode: 'drill', pool: learned, focus: dueCards(state, today()), seconds: p.seconds, onDone: resultThen });
    } else if (p.type === 'weak') {
      startQuiz({ title: label(i), mode: 'drill', pool: learned, focus: weakest(state, learned, 4), seconds: p.seconds, onDone: resultThen });
    } else if (p.type === 'learn') {
      showIntro(p.notes, () => startQuiz({ title: label(i), mode: 'drill', pool: introduced(state), focus: p.notes, seconds: p.seconds, onDone: resultThen }));
    } else if (p.type === 'boss') {
      if (bossReady(state, p.stage)) startBoss(p.stage, after);
      else { p.type = 'game'; p.game = 'speed'; run(i); }
    } else {
      const fn = GAME_FN[p.game];
      fn(learned.length >= 3 ? learned : poolUpTo(0), after);
    }
  };
  run(0);
}
function finishDaily() {
  const d = dayRec();
  const first = !d.done;
  d.done = true;
  commit();
  sfx('win');
  confetti();
  const s = summary(state, today());
  showResult({
    emoji: '🎉', title: first ? '今日训练完成！' : '又练了一轮，真棒！',
    sub: `连续打卡 🔥 ${s.streak} 天`,
    stats: [[`${Math.round(d.ms / 60000)} 分`, '今天练习'], [d.q, '今天答题'], [d.q ? pct(d.ok / d.q) : '—', '今天正确率']],
    buttons: [{ label: '回到主页', primary: true, fn: closePlay }],
  });
}

// ================= 主界面 =================
function miniCard(key) {
  const { clef, id } = splitKey(key);
  const c = state.cards[key];
  const m = c?.intro ? masteryOf(c) : 0;
  const st = cardStats(c);
  const known = m > 0;
  return `<button class="mini-card m${m}" data-key="${key}">
    ${staffSvg({ view: clef, width: 96, notes: [{ clef, id, x: 64, color: known ? colorOf(id) : '#ADB5BD', stem: false }] })}
    <div class="mc-name">${known ? `<b style="color:${colorOf(id)}">${id[0]}</b> ${solfegeOf(id)}` : '<b>?</b>'}</div>
    <div class="mc-meta">${MASTERY[m].icon} ${known && st.n ? pct(st.acc) : MASTERY[m].name}</div>
  </button>`;
}

function renderHeader() {
  const s = summary(state, today());
  const lv = currentLevel(state);
  const L = LEVELS.find((l) => l.id === lv);
  return `<header class="top">
    <div class="who"><div class="avatar">${esc(state.settings.avatar)}</div>
      <div><div class="name">${esc(state.settings.name)}</div><div class="sub">${L ? `${L.icon} 识谱${L.name}` : '🥚 识谱新手'}</div></div></div>
    <div class="chips"><span class="chip" title="连续打卡">🔥 ${s.streak}</span><span class="chip" title="关卡星星">⭐ ${s.stars}</span></div>
  </header>`;
}

function renderHome() {
  const t = today();
  const mins = state.settings.dailyMinutes;
  const plan = dailyPlan(state, t, mins);
  const d = state.days[t];
  const rate = Math.min(1, (d?.ms || 0) / (mins * 60000));
  const due = dueCards(state, t).length;
  const cur = currentStage(state);
  const islands = ISLANDS.map((isl) => {
    const nodes = STAGES.map((st, i) => ({ st, i })).filter((x) => x.st.island === isl.id).map(({ st, i }) => {
      const stars = stageStars(state, st.id);
      const status = stars ? 'passed' : i === cur ? 'current' : i < cur ? 'passed' : 'locked';
      return `<button class="node ${status}" data-action="stage" data-i="${i}" ${status === 'locked' ? 'aria-disabled="true"' : ''}>
        <span class="n-emo">${status === 'locked' ? '🔒' : bossEmoji(st)}</span>
        <span class="n-title">${i + 1}. ${esc(st.title)}</span>
        <span class="n-stars">${status === 'locked' ? '' : [1, 2, 3].map((k) => (k <= stars ? '⭐' : '☆')).join('')}</span>
      </button>`;
    }).join('');
    return `<section class="island" style="--ic:${isl.color}"><h3>${isl.emoji} ${isl.name} <small>${isl.desc}</small></h3><div class="path">${nodes}</div></section>`;
  }).join('');
  const badges = earnedBadges(state, t);
  return `
    <section class="daily card">
      <div class="ring" style="--p:${rate}"><div><b>${Math.floor((d?.ms || 0) / 60000)}</b><small>/${mins} 分钟</small></div></div>
      <div class="daily-info">
        <h2>${d?.done ? '✅ 今日训练已完成' : '今日训练'}</h2>
        <div class="phase-list">${plan.map((p) => `<span>${p.icon} ${p.title}</span>`).join('')}</div>
        <small>${due ? `🔁 ${due} 个音到了复习时间` : '没有待复习的音'}</small>
      </div>
    </section>
    <button class="btn primary big block go" data-action="daily">${d?.done ? '🔁 再练一轮' : '▶ 开始今日训练'}</button>
    ${islands}
    <section class="card"><h3>🏅 成就</h3><div class="badges">${badges.map((b) => `<span class="badge ${b.got ? 'got' : ''}" title="${esc(b.name)}">${b.icon}<small>${esc(b.name)}</small></span>`).join('')}</div></section>`;
}

function stageSheet(i) {
  const st = STAGES[i];
  const cur = currentStage(state);
  if (i > cur) { toast('🔒 先打败前一关的 BOSS'); return; }
  const fresh = newNotesOf(state, i);
  const ready = bossReady(state, i);
  const stars = stageStars(state, st.id);
  const notes = st.notes.length ? st.notes : ['treble:G4', 'bass:F3', 'treble:C5', 'bass:C3'];
  const view = st.clef === 'grand' ? 'grand' : st.clef;
  const svgNotes = notes.map((k, j) => { const { clef, id } = splitKey(k); const known = state.cards[k]?.intro; return { clef, id, x: 52 + j * 26, color: known ? colorOf(id) : '' }; });
  const labels = notes.map((k, j) => { const { id } = splitKey(k); return { x: 52 + j * 26, text: state.cards[k]?.intro || st.clef === 'grand' ? id[0] : '?' }; });
  const s = openSheet(`
    <h2>${bossEmoji(st)} 第 ${i + 1} 关 · ${esc(st.title)}</h2>
    <p class="muted">${esc(st.tip)}</p>
    <div class="sheet-staff">${staffSvg({ view, width: 52 + notes.length * 26, notes: svgNotes, labels })}</div>
    <p>BOSS：<b>${esc(st.boss)}</b>　${stars ? `最好成绩 ${'⭐'.repeat(stars)}` : ''}</p>
    <p class="muted small">挑战规则：认对 20 个音就能打败 BOSS，错 3 个就失败；每题 6 秒。</p>
    <div class="col">
      ${st.notes.length ? `<button class="btn ${fresh.length ? 'primary' : ''} block" data-s="learn">🐣 ${fresh.length ? `认识 ${fresh.length} 个新音符` : '复习本关音符'}</button>` : ''}
      <button class="btn block" data-s="drill" ${fresh.length ? 'disabled' : ''}>🎯 自由练习 2 分钟</button>
      <button class="btn ${!fresh.length && ready ? 'primary pulse' : ''} block" data-s="boss" ${ready ? '' : 'disabled'}>⚔️ 挑战 BOSS</button>
      ${!ready && !fresh.length ? '<small class="center">本关每个音至少答对 3 次后才能挑战 BOSS，先练习一下吧</small>' : ''}
    </div>`);
  s.addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    unlockAudio();
    const drill = () => startQuiz({
      title: `🎯 ${esc(st.title)}`, mode: 'drill', pool: bossPool(i).filter((k) => state.cards[k]?.intro), focus: st.notes, seconds: 120,
      forceView: st.id === 'G1' ? 'grand' : null,
      onDone: (r) => showResult({ emoji: '🎯', title: '练习完成', stats: quizStats(r), misses: r.misses, buttons: [
        { label: '再练一次', fn: drill }, ...(bossReady(state, i) ? [{ label: '⚔️ 挑战 BOSS', primary: true, fn: () => startBoss(i) }] : [{ label: '返回', primary: true, fn: closePlay }])] }),
    });
    if (b.dataset.s === 'learn') showIntro(st.notes, drill);
    else if (b.dataset.s === 'drill') drill();
    else startBoss(i);
  });
}

function renderGames() {
  const all = introduced(state);
  const pool = ui.gameClef === 'all' ? all : all.filter((k) => k.startsWith(ui.gameClef));
  const chips = [['all', '全部'], ['treble', '𝄞 高音'], ['bass', '𝄢 低音']].map(([v, l]) => `<button class="seg ${ui.gameClef === v ? 'on' : ''}" data-action="game-clef" data-v="${v}">${l}</button>`).join('');
  return `
    <h2 class="sec">🎮 游戏厅</h2>
    <p class="muted">只会出你已经学过的音（${pool.length} 个）。闯关越多，游戏越难！</p>
    <div class="segs">${chips}</div>
    <div class="game-grid">${GAMES.map((g) => `<button class="game card" data-action="game" data-g="${g.id}" ${pool.length < 3 ? 'disabled' : ''}>
      <span class="g-emo">${g.emoji}</span><b>${g.name}</b><small>${g.desc}</small><span class="g-best">🏆 ${state.best[g.id] ?? 0}</span></button>`).join('')}</div>
    ${pool.length < 3 ? '<p class="center muted">先去闯关认识至少 3 个音吧 🏡</p>' : ''}`;
}

function renderGallery() {
  const clef = ui.gallery;
  const keys = ALL_CARDS.filter((k) => k.startsWith(clef)).sort((a, b) => diatonic(splitKey(b).id) - diatonic(splitKey(a).id));
  const learned = keys.filter((k) => state.cards[k]?.intro).length;
  return `
    <h2 class="sec">📖 音符图鉴 <small>${learned}/${keys.length}</small></h2>
    <div class="segs">${['treble', 'bass'].map((c) => `<button class="seg ${clef === c ? 'on' : ''}" data-action="gallery" data-v="${c}">${CLEFS[c].icon} ${CLEFS[c].staff}</button>`).join('')}</div>
    <div class="legend">${MASTERY.map((m) => `<span>${m.icon} ${m.name}</span>`).join('')}</div>
    <p class="muted small">像认字卡一样：点开每个音，看它在谱上哪里、琴上哪个键、怎么唱。</p>
    <div class="mini-cards">${keys.map(miniCard).join('')}</div>`;
}

function noteSheet(key) {
  const { clef, id } = splitKey(key);
  const c = state.cards[key];
  const st = cardStats(c);
  const s = openSheet(`
    <h2>${CLEFS[clef].icon} ${CLEFS[clef].staff} · ${id}</h2>
    ${noteInfoHtml(key, { range: kbRange([key, 'treble:C4']) })}
    <div class="row"><button class="btn primary big" id="n-play">🔊 听一听</button></div>
    ${c ? `<p class="muted small center">掌握度 ${MASTERY[masteryOf(c)].icon} ${MASTERY[masteryOf(c)].name} · 答对 ${c.ok}/${c.seen} · 最近正确率 ${pct(st.acc)} · 中位用时 ${sec(st.ms)} · 下次复习 ${c.due}</p>` : '<p class="muted small center">还没学到这个音，闯关会遇到它</p>'}`);
  $$('.wk', s).forEach((k) => k.classList.toggle('ok', k.dataset.note === id));
  setTimeout(() => centerKeyboard(s, id), 30);
  const play = () => { unlockAudio(); playFreq(freqOf(id)); };
  $('#n-play', s).onclick = play;
  s.addEventListener('click', (e) => { const k = e.target.closest('.wk'); if (k) { unlockAudio(); playFreq(freqOf(k.dataset.note)); } });
  play();
}

// ---------- 家长 ----------
function masteryMap(clef) {
  const keys = ALL_CARDS.filter((k) => k.startsWith(clef)).sort((a, b) => diatonic(splitKey(a).id) - diatonic(splitKey(b).id));
  const notes = keys.map((k, i) => {
    const c = state.cards[k];
    const m = c?.intro ? masteryOf(c) : 0;
    return { clef, id: splitKey(k).id, x: 46 + i * 15, color: MASTERY[m].color, stem: false };
  });
  const labels = keys.map((k, i) => ({ x: 46 + i * 15, text: splitKey(k).id[0] }));
  return staffSvg({ view: clef, width: 46 + keys.length * 15, notes, labels, cls: 'map' });
}
function weekBars() {
  const t = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
  const max = Math.max(10, ...days.map((k) => (state.days[k]?.ms || 0) / 60000));
  return `<div class="wbars">${days.map((k) => {
    const d = state.days[k];
    const m = (d?.ms || 0) / 60000;
    const wd = '日一二三四五六'[parseKey(k).getDay()];
    return `<div class="wb"><small>${m >= 1 ? Math.round(m) : ''}</small><span style="height:${(m / max) * 100}%" class="${dayChecked(d) ? 'ok' : ''}"></span><i>${k === t ? '今' : wd}</i></div>`;
  }).join('')}</div>`;
}
function renderParent() {
  const t = today();
  const s = summary(state, t);
  const lv = currentLevel(state);
  const learned = introduced(state);
  const weak = weakest(state, learned.filter((k) => state.cards[k].seen >= 3), 5);
  const conf = topConfusions(state, 5);
  const set = state.settings;
  const levelRows = LEVELS.map((L) => {
    const ev = evaluateLevel(state, L);
    return `<div class="lv ${ev.pass ? 'pass' : L.id === lv + 1 ? 'next' : ''}">
      <div class="lv-head"><span>${L.icon} <b>${L.name}</b></span><span>${ev.pass ? '✅ 已达到' : L.id === lv + 1 ? '🎯 下一个目标' : ''}</span></div>
      <small>${L.range}</small><p>${L.desc}</p>
      ${ev.pass ? '' : `<div class="lv-checks">
        <span class="${ev.passedStages ? 'y' : ''}">关卡 ${ev.passedStages ? '✓' : `前 ${L.stages} 关`}</span>
        <span class="${ev.covered === ev.total ? 'y' : ''}">练过 ${ev.covered}/${ev.total} 个音</span>
        <span class="${ev.acc >= L.acc ? 'y' : ''}">正确率 ${ev.covered ? pct(ev.acc) : '—'} / ${pct(L.acc)}</span>
        <span class="${ev.ms !== null && ev.ms <= L.ms ? 'y' : ''}">用时 ${sec(ev.ms)} / ${sec(L.ms)}</span>
        ${ev.weak.length ? `<span>薄弱：${ev.weak.slice(0, 4).map((k) => splitKey(k).id).join(' ')}</span>` : ''}
      </div>`}
    </div>`;
  }).join('');
  const confText = (c) => {
    const { clef, id } = splitKey(c.card);
    const ans = c.answer === 'black' ? '黑键' : c.answer;
    return `<li>${CLEFS[clef].staff}的 <b>${id}</b>（${solfegeOf(id)}）→ 认成了 <b>${ans}</b> <small>×${c.count}</small></li>`;
  };
  return `
    <h2 class="sec">📊 家长看板</h2>
    <section class="card stats4">
      <div><b>🔥 ${s.streak}</b><small>连续打卡</small></div>
      <div><b>${Math.round(s.totalMs / 60000)}</b><small>累计分钟</small></div>
      <div><b>${s.totalSeen ? pct(s.totalOk / s.totalSeen) : '—'}</b><small>总正确率</small></div>
      <div><b>${learned.length}/${ALL_CARDS.length}</b><small>已学音符</small></div>
    </section>
    <section class="card"><h3>最近 7 天练习（分钟）</h3>${weekBars()}<small class="muted">绿色 = 当天打卡（完成今日训练或练满 5 分钟）</small></section>
    <section class="card"><h3>识谱水平标准</h3><p class="muted small">按这个标准分四级，App 会根据孩子最近的答题自动评估。</p>${levelRows}</section>
    <section class="card"><h3>掌握地图</h3><div class="legend">${MASTERY.map((m) => `<span><i style="background:${m.color}"></i>${m.name}</span>`).join('')}</div>
      <div class="map-wrap">${masteryMap('treble')}</div><div class="map-wrap">${masteryMap('bass')}</div></section>
    <section class="card"><h3>需要加强的音</h3>${weak.length ? `<div class="mini-cards">${weak.map(miniCard).join('')}</div>` : '<p class="muted">还没有足够的数据</p>'}</section>
    <section class="card"><h3>最常见的混淆</h3>${conf.length ? `<ul class="conf">${conf.map(confText).join('')}</ul><p class="muted small">如果总是把低音谱表的音认成高音谱表的（差两个音），说明还没养成"先看谱号"的习惯。</p>` : '<p class="muted">还没有记录到错误 👍</p>'}</section>
    <section class="card guide">
      <h3>给家长的说明（不懂五线谱也能陪练）</h3>
      <ul>
        <li><b>每天 10 分钟就够</b>：点「开始今日训练」，App 会自动安排 复习 → 学新音/弱项特训 → BOSS 或小游戏。</li>
        <li><b>不用您来判对错</b>：每题自动判断；答错时会显示正确答案、点亮琴键、播放声音、给出"从地标往上/下数"的方法，孩子必须自己点一次正确答案才能继续，错的音 2 题后会再考一次。</li>
        <li><b>像背单词一样复习</b>：每个音都有记忆盒子，答对且 3 秒内才升级，间隔 1→2→4→7→15→30 天再复习；答错会降级、当天重练。</li>
        <li><b>音、形、意一起记</b>：形 = 在谱上的位置；音 = 唱名（do re mi）和真实音高；意 = 钢琴上的哪个键。建议让孩子答题时<b>小声唱出唱名</b>。</li>
        <li><b>和真琴连起来</b>：电子琴可以用 USB/蓝牙 MIDI 连接（安卓 / 电脑 Chrome），直接在琴上按键答题。没有电子琴，也可以每天抽 1 分钟让孩子在真琴上把「图鉴」里的音弹一遍。</li>
        <li><b>看什么数据</b>：关注"用时"而不只是"正确率"——能答对但要数很久，弹琴时依然会卡。目标是每个音 1.5 秒内。</li>
        <li><b>还需要老师教的</b>：本 App 专注"认音"。节奏、指法、升降号、调号、音程（看两个音的距离）仍然要在琴课上学。</li>
      </ul>
    </section>
    <section class="card settings">
      <h3>⚙️ 设置</h3>
      <label>孩子的名字 <input id="set-name" value="${esc(set.name)}" maxlength="12"></label>
      <label>头像 <select id="set-avatar">${['🎹', '🎵', '🐱', '🐰', '🦄', '🐼', '🦊', '🐧', '🌸', '⭐'].map((a) => `<option ${a === set.avatar ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
      <label>答题方式 <select id="set-mode">
        <option value="mix" ${set.answerMode === 'mix' ? 'selected' : ''}>混合（推荐）：唱名按钮 + 钢琴键盘</option>
        <option value="name" ${set.answerMode === 'name' ? 'selected' : ''}>只用唱名按钮</option>
        <option value="key" ${set.answerMode === 'key' ? 'selected' : ''}>只用钢琴键盘（要找对八度）</option></select></label>
      <label>谱表显示 <select id="set-view">
        <option value="auto" ${set.staffView === 'auto' ? 'selected' : ''}>自动（第 9 关起用大谱表）</option>
        <option value="single" ${set.staffView === 'single' ? 'selected' : ''}>单行谱表</option>
        <option value="grand" ${set.staffView === 'grand' ? 'selected' : ''}>始终大谱表</option></select></label>
      <label>键盘标记 <select id="set-labels">
        <option value="c" ${set.keyLabels === 'c' ? 'selected' : ''}>只标 C 键（推荐，和真钢琴一样靠黑键找位置）</option>
        <option value="all" ${set.keyLabels === 'all' ? 'selected' : ''}>标出全部音名（初学）</option>
        <option value="none" ${set.keyLabels === 'none' ? 'selected' : ''}>只标中央C</option></select></label>
      <label>每日训练 <select id="set-min">${[5, 10, 15, 20].map((m) => `<option value="${m}" ${set.dailyMinutes === m ? 'selected' : ''}>${m} 分钟</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" id="set-jp" ${set.showJianpu ? 'checked' : ''}> 显示简谱数字（1 = do）</label>
      <label class="check"><input type="checkbox" id="set-sound" ${set.sound ? 'checked' : ''}> 声音</label>
      ${midiSupported() ? `<button class="btn block" data-action="midi">${midiOn ? '🎹 电子琴已连接' : '🎹 连接电子琴（MIDI）'}</button>` : '<small class="muted">这个浏览器不支持连接电子琴（iPhone/iPad 不支持 MIDI）</small>'}
      ${installEvent ? '<button class="btn block" data-action="install">📲 安装到桌面</button>' : ''}
      <div class="row"><button class="btn" data-action="export">📤 导出备份</button><button class="btn" data-action="import">📥 导入备份</button></div>
      <button class="btn danger block" data-action="reset">🗑️ 清空所有数据</button>
      <p class="muted small">数据只保存在这台设备的浏览器里。换设备请先导出备份。</p>
    </section>`;
}

function render() {
  if (document.body.classList.contains('playing')) return;
  const tabs = [['home', '🗺️', '闯关'], ['games', '🎮', '游戏'], ['gallery', '📖', '图鉴'], ['parent', '📊', '家长']];
  const body = { home: renderHome, games: renderGames, gallery: renderGallery, parent: renderParent }[ui.tab]();
  $('#app').innerHTML = `${renderHeader()}<main>${body}</main>
    <nav class="tabs">${tabs.map(([id, ic, name]) => `<button class="${ui.tab === id ? 'on' : ''}" data-action="tab" data-tab="${id}"><span>${ic}</span>${name}</button>`).join('')}</nav>`;
  if (ui.tab === 'parent') bindSettings();
}

function bindSettings() {
  const set = state.settings;
  const on = (id, fn) => { const el = $(id); if (el) el.onchange = () => { fn(el); commit(); }; };
  on('#set-name', (el) => { set.name = el.value.trim() || '小音乐家'; render(); });
  on('#set-avatar', (el) => { set.avatar = el.value; render(); });
  on('#set-mode', (el) => { set.answerMode = el.value; });
  on('#set-view', (el) => { set.staffView = el.value; });
  on('#set-labels', (el) => { set.keyLabels = el.value; });
  on('#set-min', (el) => { set.dailyMinutes = Number(el.value); });
  on('#set-jp', (el) => { set.showJianpu = el.checked; });
  on('#set-sound', (el) => { set.sound = el.checked; setSoundEnabled(el.checked); });
}

// ---------- 事件 ----------
document.addEventListener('click', async (e) => {
  const q = e.target.closest('[data-act="quit"]');
  if (q) { active?.quit ? active.quit() : closePlay(); return; }
  const a = e.target.closest('[data-action]');
  if (!a) return;
  const act = a.dataset.action;
  if (act === 'close-sheet') closeSheet();
  else if (act === 'tab') { ui.tab = a.dataset.tab; render(); window.scrollTo(0, 0); }
  else if (act === 'daily') startDaily();
  else if (act === 'stage') stageSheet(Number(a.dataset.i));
  else if (act === 'game-clef') { ui.gameClef = a.dataset.v; render(); }
  else if (act === 'gallery') { ui.gallery = a.dataset.v; render(); }
  else if (act === 'game') {
    unlockAudio();
    const all = introduced(state);
    const pool = ui.gameClef === 'all' ? all : all.filter((k) => k.startsWith(ui.gameClef));
    GAME_FN[a.dataset.g](pool);
  } else if (act === 'midi') {
    try {
      const n = await connectMidi(onMidi);
      midiOn = n > 0;
      toast(n ? `🎹 已连接 ${n} 个 MIDI 设备，可以直接在琴上答题` : '没找到 MIDI 设备，请先用线连接电子琴');
    } catch { toast('连接失败：请允许浏览器使用 MIDI 设备'); }
    render();
  } else if (act === 'install' && installEvent) {
    installEvent.prompt();
    installEvent = null;
  } else if (act === 'export') {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `识谱小勇士备份-${today()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } else if (act === 'import') {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      try {
        state = importState(await inp.files[0].text());
        setSoundEnabled(state.settings.sound);
        commit();
        render();
        toast('✅ 已导入备份');
      } catch (err) { toast(`导入失败：${err.message}`); }
    };
    inp.click();
  } else if (act === 'reset') {
    const s = openSheet(`<h2>清空所有数据？</h2><p class="muted">所有学习记录、关卡、成绩都会删除，不能恢复。建议先导出备份。</p>
      <div class="row"><button class="btn" data-action="close-sheet">取消</button><button class="btn danger" id="do-reset">确认清空</button></div>`);
    $('#do-reset', s).onclick = () => { state = createDefaultState(); commit(); closeSheet(); render(); toast('已清空'); };
  }
});
document.addEventListener('click', (e) => {
  const mc = e.target.closest('.mini-card');
  if (mc && !e.target.closest('#play')) noteSheet(mc.dataset.key);
});

function onMidi(midi) {
  if (!active) return;
  const id = noteFromMidi(midi);
  active.onNote?.(id, id ? $(`#play .wk[data-note="${id}"]`) : null);
}

document.addEventListener('keydown', (e) => {
  if (!active || e.target.closest('input, select, textarea')) return;
  const k = e.key.toUpperCase();
  if (LETTERS.includes(k)) active.onName?.(k, $(`#play .nb[data-letter="${k}"]`));
  else if (/^[1-7]$/.test(e.key)) { const l = LETTERS[Number(e.key) - 1]; active.onName?.(l, $(`#play .nb[data-letter="${l}"]`)); }
  else if (e.key === 'Escape') active.quit?.();
});

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

render();
