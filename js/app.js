import { SUBJECTS, WEEKDAY_NAMES, RATINGS, BOOKS, TITLES, TIERS, HOLIDAYS, holidayFor } from './data.js';
import {
  todayKey, toKey, addDays, weekStart, weekDays, weekdayIndex, parseKey,
  tasksForDate, isPerfectDay, isDone, starsOf, bossState, weekPlan, weekStats,
  treeLeaves, treeStage, totalStars, starBalance, ticketBalance, drawPrize,
  storyProgress, currentSeason, titleFor, computeBadges, formatStars, CHAPTER_CLEAR_RATE,
} from './logic.js';
import { loadState, saveState, importState, createDefaultState, uid } from './store.js';

let state = loadState();
const ui = { tab: 'today', date: todayKey(), week: weekStart(todayKey()), reportWeek: weekStart(todayKey()), settings: null };
let installEvent = null;

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (x) => `${Math.round(x * 100)}%`;
const fmtDate = (k) => { const d = parseKey(k); return `${d.getMonth() + 1}月${d.getDate()}日`; };
const today = () => todayKey();

function commit() {
  if (!saveState(state)) toast('⚠️ 保存失败：浏览器存储空间不足或被禁用');
  render();
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

function confetti(n = 80) {
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#FF6B9D', '#4ECDC4', '#FFD43B', '#9775FA', '#FFA94D', '#69DB7C'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.style.left = `${Math.random() * 100}%`;
    s.style.background = colors[i % colors.length];
    s.style.animationDelay = `${Math.random() * 0.6}s`;
    s.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    s.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3800);
}

function openSheet(html, cls = '') {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-backdrop';
  wrap.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeSheet(); });
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  return wrap.firstElementChild;
}
function closeSheet() {
  document.querySelectorAll('.sheet-backdrop').forEach((x) => x.remove());
  document.body.classList.remove('no-scroll');
}

function progressBar(rate, color = 'var(--accent)') {
  return `<div class="bar"><span style="width:${Math.min(100, rate * 100)}%;background:${color}"></span></div>`;
}

// ---------- 头部 ----------
function renderHeader() {
  const t = today();
  const season = currentSeason(state, t);
  const sStars = season ? totalStars(state, season.start, season.end) : totalStars(state);
  const title = titleFor(sStars);
  const story = storyProgress(state, t);
  const ch = story.chapters[story.current];
  const wk = weekStats(state, weekStart(t));
  return `
    <header class="top">
      <div class="who">
        <div class="avatar">${title.icon}</div>
        <div>
          <div class="name">${esc(state.settings.childName)}</div>
          <div class="sub">${title.name}</div>
        </div>
      </div>
      <div class="chips">
        <button class="chip" data-action="tab" data-tab="rewards" title="星星余额">⭐ ${formatStars(starBalance(state))}</button>
        <button class="chip" data-action="tab" data-tab="rewards" title="抽奖券">🎟️ ${ticketBalance(state, t)}</button>
        <button class="icon-btn" data-action="settings" aria-label="家长设置">⚙️</button>
      </div>
    </header>
    <button class="story-strip" data-action="tab" data-tab="adventure">
      <span>${story.book.emoji} ${esc(story.book.title)} · ${story.finished ? '🎉 全书通关！' : `第 ${story.current + 1} 章「${esc(ch.title)}」`}</span>
      ${progressBar(story.finished ? 1 : wk.rate / CHAPTER_CLEAR_RATE, 'linear-gradient(90deg,#FFD43B,#FF922B)')}
    </button>`;
}

function holidayBanner() {
  const h = state.settings.holidayPreview || holidayFor(today());
  return h ? `<div class="holiday-banner">${HOLIDAYS[h].banner}</div>` : '';
}

// ---------- 今日 ----------
function renderToday() {
  const t = today();
  const d = ui.date;
  const ws = weekStart(d);
  const days = weekDays(ws);
  const items = tasksForDate(state, d);
  const req = items.filter((x) => x.status === 'required');
  const skipped = items.filter((x) => x.status === 'skipped');
  const doneN = req.filter((x) => isDone(x.completion)).length;
  const isFuture = d > t;
  const perfect = isPerfectDay(state, d) || !!state.ticketDays[d];

  const dayBar = days.map((k) => {
    const its = tasksForDate(state, k).filter((x) => x.status === 'required');
    const dn = its.filter((x) => isDone(x.completion)).length;
    const dot = !its.length ? '🌙' : k > t ? '' : dn === its.length ? '🌟' : dn ? '✨' : '';
    return `<button class="day ${k === d ? 'sel' : ''} ${k === t ? 'today' : ''}" data-action="pick-date" data-date="${k}">
      <small>${WEEKDAY_NAMES[weekdayIndex(k)]}</small><b>${parseKey(k).getDate()}</b><i>${dot}</i></button>`;
  }).join('');

  const groups = Object.entries(SUBJECTS).map(([key, sub]) => {
    const list = req.filter((x) => x.task.subject === key);
    if (!list.length) return '';
    return `<section class="region" style="--rc:${sub.color}">
      <h3>${sub.icon} ${sub.region} <small>${sub.name}</small></h3>
      ${list.map((x) => taskCard(x, isFuture)).join('')}
    </section>`;
  }).join('');

  return `
    <div class="week-nav">
      <button class="icon-btn" data-action="date-shift" data-n="-7" aria-label="上一周">‹</button>
      <div class="days">${dayBar}</div>
      <button class="icon-btn" data-action="date-shift" data-n="7" aria-label="下一周">›</button>
    </div>
    <div class="day-head">
      <h2>${d === t ? '今天' : fmtDate(d)} · ${WEEKDAY_NAMES[weekdayIndex(d)]}</h2>
      ${d !== t ? `<button class="link" data-action="pick-date" data-date="${t}">回到今天</button>` : ''}
    </div>
    ${req.length ? `
      <div class="today-sum card">
        <div><b>${doneN}</b> / ${req.length} 项完成</div>
        ${progressBar(req.length ? doneN / req.length : 0)}
        <div class="ticket-hint">${perfect ? '🎟️ 今天全部完成，抽奖券 +1 已到手！' : isFuture ? '🔮 未来的任务，先看看计划吧' : '全部完成即可获得 1 张 🎟️ 抽奖券'}</div>
      </div>
      ${renderBoss(d, isFuture)}
      ${groups}` : `<div class="rest card">🌙 今天是休息日，好好玩吧！</div>`}
    ${skipped.length ? `<section class="region skipped"><h3>⏭️ 今日已顺延 <small>会留到本周后面几天</small></h3>
      ${skipped.map((x) => `<div class="task muted"><span class="emo">${x.task.emoji}</span><div class="info"><b>${esc(x.task.name)}</b>
      <small>本周还差 ${x.remaining} 次</small></div><button class="btn small ghost" data-action="unskip" data-id="${x.task.id}">撤销顺延</button></div>`).join('')}
    </section>` : ''}`;
}

function taskCard(x, isFuture) {
  const { task, completion } = x;
  const r = completion ? RATINGS[completion.rating] : null;
  const cls = !completion ? '' : completion.rating === 'full' ? 'done' : completion.rating === 'none' ? 'fail' : 'half';
  const meta = [task.slot, task.minutes ? `计划 ${task.minutes} 分钟` : '', completion?.minutes ? `实际 ${completion.minutes} 分钟` : ''].filter(Boolean).join(' · ');
  const weekly = task.type === 'weekly'
    ? `<span class="tag">${x.remaining > 0 ? `本周还差 ${x.remaining} 次` : '本周达标 🎉'}</span>` : '';
  return `<div class="task ${cls}">
    <button class="task-main" data-action="rate" data-id="${task.id}" ${isFuture ? 'disabled' : ''}>
      <span class="emo">${task.emoji || '📌'}</span>
      <span class="info"><b>${esc(task.name)}</b>${task.boss ? ' <span class="tag tag-boss">BOSS</span>' : ''} ${weekly}<small>${esc(meta)}</small></span>
      <span class="state">${r ? r.icon : isFuture ? '🔒' : '○'}</span>
    </button>
    ${x.canSkip && !completion && !isFuture ? `<button class="btn small ghost skip" data-action="skip" data-id="${task.id}" title="今天作业太多？顺延到本周后面">跳过今日</button>` : ''}
  </div>`;
}

function renderBoss(d, isFuture) {
  const b = bossState(state, d);
  if (!b.targets.length) return '';
  const hpPct = b.defeated ? 0 : b.hp;
  return `<div class="boss card ${b.defeated ? 'defeated' : ''}">
    <div class="boss-face" id="boss-face">${b.defeated ? '💀' : b.boss.emoji}</div>
    <div class="boss-info">
      <b>${b.boss.name}</b>
      <small>${b.marked ? 'BOSS 任务：' + b.targets.map((x) => esc(x.task.name)).join('、') : '挑战今日全部任务'}</small>
      <div class="hp"><span style="width:${hpPct * 100}%"></span></div>
      <small>${b.defeated ? `已击败！战利品 ${state.bossDefeats[d].loot}` : `血量 ${Math.round(hpPct * 100)}%`}</small>
    </div>
    ${b.defeated ? '' : `<button class="btn ${b.canAttack ? 'primary pulse' : 'half-lit'}" data-action="attack" ${isFuture ? 'disabled' : ''}>⚔️ 攻击</button>`}
  </div>`;
}

function rateSheet(taskId) {
  const d = ui.date;
  const task = state.tasks.find((t) => t.id === taskId);
  const c = state.completions[d]?.[taskId];
  const sheet = openSheet(`
    <h2>${task.emoji} ${esc(task.name)}</h2>
    <p class="muted">${fmtDate(d)} · 这次完成得怎么样？</p>
    <div class="rate-grid">
      ${Object.entries(RATINGS).map(([k, r]) => `<button class="rate-btn r-${k} ${c?.rating === k ? 'sel' : ''}" data-rate="${k}">
        <span>${r.icon}</span><b>${r.label}</b><small>${r.short}</small></button>`).join('')}
    </div>
    <label class="field">实际用时（分钟）<input type="number" inputmode="numeric" min="0" max="600" id="rate-min" value="${esc(c?.minutes ?? task.minutes ?? '')}"></label>
    <div class="row">
      ${c ? '<button class="btn ghost" data-clear>清除打卡</button>' : ''}
      <button class="btn" data-close>取消</button>
    </div>`);
  sheet.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.close !== undefined) return closeSheet();
    if (b.dataset.clear !== undefined) {
      delete state.completions[d][taskId];
      closeSheet();
      return commit();
    }
    if (b.dataset.rate) {
      const before = isPerfectDay(state, d);
      state.completions[d] ??= {};
      const minutes = $('#rate-min', sheet).value;
      state.completions[d][taskId] = { rating: b.dataset.rate, minutes: minutes === '' ? null : Number(minutes), at: Date.now() };
      if (state.skips[d]) delete state.skips[d][taskId];
      closeSheet();
      commit();
      const stars = starsOf(state.completions[d][taskId]);
      if (isPerfectDay(state, d) && !state.ticketDays[d]) { state.ticketDays[d] = true; saveState(state); }
      if (!before && isPerfectDay(state, d)) { confetti(); toast('🎉 今天全部完成！获得 1 张抽奖券'); }
      else if (stars === 1) toast('⭐ 获得 1 颗星！');
      else if (stars === 0.5) toast('🌗 半颗星也是努力的回响！');
    }
  });
}

function attack() {
  const d = ui.date;
  const b = bossState(state, d);
  if (!b.canAttack) {
    const face = $('#boss-face');
    face?.classList.remove('shake');
    void face?.offsetWidth;
    face?.classList.add('shake');
    return toast('🛡️ 还有任务没完成，无法攻击 Boss！');
  }
  const face = $('#boss-face');
  face?.classList.add('hit');
  setTimeout(() => {
    state.bossDefeats[d] = { loot: b.boss.loot, at: Date.now() };
    commit();
    confetti(120);
    toast(`💥 击败${b.boss.name}！获得 2 张抽奖券和 ${b.boss.loot}`);
  }, 650);
}

// ---------- 一周 ----------
function renderWeek() {
  const t = today();
  const ws = ui.week;
  const plan = weekPlan(state, ws, t);
  const stats = weekStats(state, ws);
  const icon = { done: '⭐', half: '🌗', none: '❌', planned: '○', missed: '·', skipped: '⏭️' };
  const cols = weekDays(ws).map((d) => {
    const list = plan[d];
    return `<div class="wcol ${d === t ? 'today' : ''}">
      <div class="whead">${WEEKDAY_NAMES[weekdayIndex(d)]}<small>${fmtDate(d)}</small>${state.bossDefeats[d] ? '<span title="击败 BOSS">💀</span>' : ''}</div>
      <div class="witems">${list.length ? list.map((x) => `<div class="witem k-${x.kind}" style="--rc:${SUBJECTS[x.task.subject].color}" title="${esc(x.task.name)}">
        <span>${x.task.emoji}</span><span class="wname">${esc(x.task.name)}</span><span>${icon[x.kind]}</span></div>`).join('') : '<div class="wrest">🌙 休息</div>'}</div>
    </div>`;
  }).join('');
  return `
    <div class="day-head">
      <button class="icon-btn" data-action="week-shift" data-n="-7" aria-label="上一周">‹</button>
      <h2>${fmtDate(ws)} – ${fmtDate(addDays(ws, 6))}</h2>
      <button class="icon-btn" data-action="week-shift" data-n="7" aria-label="下一周">›</button>
    </div>
    ${ws !== weekStart(t) ? `<p class="center"><button class="link" data-action="week-today">回到本周</button></p>` : ''}
    <div class="card week-sum">
      <div>本周完成率 <b>${pct(stats.rate)}</b> · 收集 ⭐ <b>${formatStars(stats.stars)}</b> · 完美日 <b>${stats.perfectDays}</b></div>
      ${progressBar(stats.rate)}
    </div>
    <div class="week-grid">${cols}</div>
    <p class="legend">⭐ 整星　🌗 半星　❌ 没动手　○ 待完成　⏭️ 顺延　· 未打卡</p>`;
}

// ---------- 冒险（剧情地图 + 区域） ----------
function renderAdventure() {
  const t = today();
  const sp = storyProgress(state, t);
  const stats = weekStats(state, weekStart(t));
  const nodes = sp.chapters.map((c, i) => {
    const icon = c.state === 'cleared' ? '⭐' : c.state === 'passed' ? '👣' : c.state === 'current' ? '📍' : '🔒';
    return `<li class="node n-${c.state} ${i % 2 ? 'r' : 'l'}">
      <span class="dot">${icon}</span>
      <div><small>第 ${i + 1} 章</small><b>${c.state === 'locked' ? '？？？' : esc(c.title)}</b>
      ${c.state === 'current' ? progressBar(c.rate / CHAPTER_CLEAR_RATE, 'linear-gradient(90deg,#FFD43B,#FF922B)') + `<small>本周完成率达到 ${pct(CHAPTER_CLEAR_RATE)} 即可通关</small>` : ''}
      ${c.state === 'locked' ? `<small>${fmtDate(c.week)} 解锁</small>` : ''}</div>
    </li>`;
  }).join('');
  const regions = Object.entries(SUBJECTS).map(([k, s]) => {
    const r = stats.perSubject[k];
    const rate = r.req ? r.done / r.req : 0;
    return `<div class="reg" style="--rc:${s.color}"><span class="ricon">${s.icon}</span>
      <div><b>${s.region}</b> <small>${s.name} · ${r.done}/${r.req}</small>${progressBar(rate, s.color)}</div></div>`;
  }).join('');
  const loot = Object.entries(state.bossDefeats).sort((a, b) => b[0].localeCompare(a[0]));
  return `
    <div class="card">
      <h2>${sp.book.emoji} ${esc(sp.book.title)}</h2>
      <p class="muted">每周解锁一章，本周的任务就是这一章的探索节点。${sp.finished ? '🎉 全书已经走完啦！可以在家长设置里换一本新书。' : ''}</p>
    </div>
    <ol class="map">${nodes}</ol>
    <h3 class="sec">🧭 本周区域探索</h3>
    <div class="card regions">${regions}</div>
    <h3 class="sec">🏆 BOSS 战利品（${loot.length}）</h3>
    <div class="card">${loot.length ? `<div class="loot">${loot.slice(0, 30).map(([d, v]) => `<span title="${fmtDate(d)}">${v.loot}</span>`).join('')}</div>` : '<p class="muted">还没有战利品，去打败今天的 BOSS 吧！</p>'}</div>`;
}

// ---------- 奖励 ----------
function renderRewards() {
  const t = today();
  const tickets = ticketBalance(state, t);
  const bal = starBalance(state);
  const pending = state.vault.filter((v) => !v.redeemedAt).sort((a, b) => a.cost - b.cost);
  const redeemed = state.vault.filter((v) => v.redeemedAt).sort((a, b) => b.redeemedAt - a.redeemedAt);
  const tierColor = (k) => state.tierColors[k] || TIERS[k].color;
  const w = state.tierWeights;
  const sumW = Object.keys(TIERS).filter((k) => state.prizes.some((p) => p.tier === k)).reduce((a, k) => a + Number(w[k] || 0), 0) || 1;
  return `
    <div class="card wallet">
      <div><span>🎟️</span><b>${tickets}</b><small>抽奖券</small></div>
      <div><span>⭐</span><b>${formatStars(bal)}</b><small>星星余额</small></div>
    </div>
    <p class="muted center">每天全部完成 +1 张 🎟️ · 打败 BOSS +2 张 🎟️ · 打卡赚 ⭐ 用来兑换奖品</p>
    <div class="card blindbox">
      <div class="box" id="box">🎁</div>
      <button class="btn primary big" data-action="draw" ${tickets ? '' : 'disabled'}>${tickets ? '用 1 张抽奖券开盲盒' : '还没有抽奖券'}</button>
    </div>
    <h3 class="sec">📦 我的奖品库（${pending.length}）</h3>
    ${pending.length ? pending.map((v) => `<div class="card prize" style="--tc:${tierColor(v.tier)}">
      <span class="pe">${v.emoji}</span>
      <div class="info"><b>${esc(v.name)}</b><small><span class="tier">${TIERS[v.tier].name}</span> 需要 ⭐ ${v.cost}</small>
      ${progressBar(Math.min(1, bal / v.cost), tierColor(v.tier))}</div>
      <div class="col">
        <button class="btn small ${bal >= v.cost ? 'primary' : ''}" data-action="redeem" data-id="${v.id}" ${bal >= v.cost ? '' : 'disabled'}>兑换</button>
        ${state.prizes.some((p) => p.cost === v.cost && p.name !== v.name) ? `<button class="btn small ghost" data-action="swap" data-id="${v.id}">调换</button>` : ''}
      </div>
    </div>`).join('') : '<div class="card muted">抽到的奖品会先放在这里，攒够星星就能兑换。</div>'}
    <h3 class="sec">🎁 盲盒里有什么</h3>
    <div class="card catalog">
      ${Object.keys(TIERS).map((k) => {
        const list = state.prizes.filter((p) => p.tier === k);
        if (!list.length) return '';
        return `<div class="tier-row"><b style="color:${tierColor(k)}">${TIERS[k].name} · ${Math.round((Number(w[k] || 0) / sumW) * 100)}%</b>
          <div class="pills">${list.map((p) => `<span class="pill" style="--tc:${tierColor(k)}">${p.emoji} ${esc(p.name)} <small>⭐${p.cost}</small></span>`).join('')}</div></div>`;
      }).join('')}
    </div>
    ${redeemed.length ? `<h3 class="sec">✅ 已兑换</h3><div class="card">${redeemed.slice(0, 20).map((v) => `<div class="redeemed">${v.emoji} ${esc(v.name)} <small>${fmtDate(toKey(new Date(v.redeemedAt)))} · ⭐${v.cost}</small></div>`).join('')}</div>` : ''}`;
}

function doDraw() {
  if (ticketBalance(state, today()) < 1) return toast('还没有抽奖券哦');
  const prize = drawPrize(state);
  if (!prize) return toast('盲盒里还没有奖品，请家长先在设置里添加');
  const box = $('#box');
  box.classList.add('shaking');
  setTimeout(() => {
    state.vault.push({ id: uid(), prizeId: prize.id, name: prize.name, emoji: prize.emoji, tier: prize.tier, cost: prize.cost, at: Date.now(), redeemedAt: null });
    commit();
    confetti(prize.tier === 'legendary' ? 200 : 100);
    openSheet(`<div class="reveal" style="--tc:${state.tierColors[prize.tier] || TIERS[prize.tier].color}">
      <div class="big-emoji">${prize.emoji}</div>
      <div class="tier">${TIERS[prize.tier].name}奖品</div>
      <h2>${esc(prize.name)}</h2>
      <p>已放进奖品库，攒够 ⭐ ${prize.cost} 就能兑换！</p>
      <button class="btn primary" data-close>太棒了！</button></div>`)
      .addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet(); });
  }, 1400);
}

function swapSheet(vid) {
  const v = state.vault.find((x) => x.id === vid);
  const options = state.prizes.filter((p) => p.cost === v.cost && p.name !== v.name);
  const sheet = openSheet(`<h2>调换奖品</h2><p class="muted">同样 ⭐ ${v.cost} 档位的奖品可以自由调换</p>
    ${options.map((p) => `<button class="btn block" data-pid="${p.id}">${p.emoji} ${esc(p.name)}</button>`).join('')}
    <button class="btn ghost block" data-close>取消</button>`);
  sheet.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.pid) {
      const p = state.prizes.find((x) => x.id === b.dataset.pid);
      Object.assign(v, { prizeId: p.id, name: p.name, emoji: p.emoji, tier: p.tier });
      closeSheet();
      commit();
      toast(`已换成 ${p.emoji} ${p.name}`);
    } else closeSheet();
  });
}

// ---------- 成长（能量树、时间、周报、赛季） ----------
const LEAF_POS = [
  [100, 40], [80, 48], [120, 48], [62, 60], [138, 60], [92, 62], [110, 64], [48, 78], [152, 78], [72, 78],
  [128, 80], [100, 82], [56, 96], [144, 96], [84, 96], [116, 98], [68, 112], [132, 112], [100, 104], [40, 104],
];
function treeSvg(leaves) {
  const trunkH = 20 + Math.min(leaves, 20) * 3.5;
  const leafEls = LEAF_POS.slice(0, leaves).map(([x, y], i) =>
    `<ellipse cx="${x}" cy="${y + (80 - trunkH) * 0.6}" rx="11" ry="7" fill="${i % 3 ? '#51CF66' : '#8CE99A'}" transform="rotate(${(i * 37) % 60 - 30} ${x} ${y + (80 - trunkH) * 0.6})" class="leaf" style="animation-delay:${i * 40}ms"/>`).join('');
  return `<svg viewBox="0 0 200 180" class="tree" role="img" aria-label="能量树 ${leaves} 片叶子">
    <ellipse cx="100" cy="168" rx="70" ry="9" fill="#C3A27A" opacity=".5"/>
    ${leaves === 0 ? '<ellipse cx="100" cy="160" rx="9" ry="6" fill="#8D6E63"/>'
      : `<path d="M96 168 L98 ${168 - trunkH} L102 ${168 - trunkH} L104 168 Z" fill="#8D6E63"/>${leafEls}`}
  </svg>`;
}

function renderGrowth() {
  const t = today();
  const ws = ui.reportWeek;
  const s = weekStats(state, ws);
  const leaves = treeLeaves(s.rate);
  const report = state.reports[ws] || { good: '', improve: '', plan: '' };
  const maxMin = Math.max(1, ...s.perTask.map((x) => Math.max(x.planned, x.actual)));
  const season = currentSeason(state, t);
  const sStars = season ? totalStars(state, season.start, season.end) : totalStars(state);
  const title = titleFor(sStars);
  const badges = computeBadges(state, t);
  const histWeeks = [...new Set([...Object.keys(state.reports), ...Object.keys(state.completions).map(weekStart)])].sort().reverse();

  return `
    <div class="day-head">
      <button class="icon-btn" data-action="report-shift" data-n="-7" aria-label="上一周">‹</button>
      <h2>${fmtDate(ws)} – ${fmtDate(addDays(ws, 6))}</h2>
      <button class="icon-btn" data-action="report-shift" data-n="7" aria-label="下一周">›</button>
    </div>
    <div class="card tree-card">
      ${treeSvg(leaves)}
      <div><b>能量树 · ${treeStage(leaves)}</b><small>${leaves} / 20 片叶子 · 本周完成率 ${pct(s.rate)}</small></div>
    </div>

    <h3 class="sec">📝 周复盘</h3>
    <div class="card report">
      <div class="stat-grid">
        <div><b>${pct(s.rate)}</b><small>完成率</small></div>
        <div><b>${formatStars(s.stars)}</b><small>收集星星</small></div>
        <div><b>${s.minutes}</b><small>学习分钟</small></div>
        <div><b>${s.perfectDays}</b><small>完美日</small></div>
      </div>
      <div class="star-counts">⭐ 整星 ${s.counts.full}　🌗 尽力半星 ${s.counts.effort}　🌓 质量半星 ${s.counts.quality}　❌ ${s.counts.none}</div>
      <table class="tbl"><thead><tr><th>任务</th><th>完成</th><th>星星</th><th></th></tr></thead><tbody>
        ${s.perTask.map((x) => `<tr><td>${x.task.emoji} ${esc(x.task.name)}</td><td>${x.done}/${x.required}</td><td>${formatStars(x.stars)}</td><td>${x.met ? '✅' : '—'}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">本周还没有任务</td></tr>'}
      </tbody></table>
      <label class="field">👍 做得好的地方<textarea data-report="good" rows="2" placeholder="比如：英语阅读提前完成了！">${esc(report.good)}</textarea></label>
      <label class="field">🔧 需要改进<textarea data-report="improve" rows="2" placeholder="一句孩子听得懂、够得着的话">${esc(report.improve)}</textarea></label>
      <label class="field">🎯 下周计划<textarea data-report="plan" rows="2" placeholder="比如：磨耳朵功夫要用在平时">${esc(report.plan)}</textarea></label>
      <small class="muted">自动保存 · 历史周报可用上方箭头翻看</small>
    </div>

    <h3 class="sec">⏱️ 计划用时 vs 实际用时</h3>
    <div class="card chart">
      ${s.perTask.filter((x) => x.done).map((x) => `<div class="crow"><span class="cl">${x.task.emoji} ${esc(x.task.name)}</span>
        <div class="cbars"><span class="plan" style="width:${(x.planned / maxMin) * 100}%">${x.planned}</span>
        <span class="act ${x.actual > x.planned ? 'over' : ''}" style="width:${(x.actual / maxMin) * 100}%">${x.actual}</span></div></div>`).join('') || '<p class="muted">完成任务并填写实际用时后，这里会出现对比图。</p>'}
      <p class="legend"><span class="sw plan"></span> 计划分钟　<span class="sw act"></span> 实际分钟　<span class="sw over"></span> 超时</p>
    </div>

    <h3 class="sec">🏅 赛季 ${season ? '· ' + esc(season.name) : ''}</h3>
    <div class="card season">
      <div class="title-big">${title.icon} ${title.name}</div>
      <small>本赛季已收集 ⭐ ${formatStars(sStars)}${title.next ? `，再收集 ${formatStars(title.next.min - sStars)} 颗升级为「${title.next.name}」` : '，已是最高称号！'}</small>
      ${title.next ? progressBar((sStars - title.min) / (title.next.min - title.min), 'linear-gradient(90deg,#9775FA,#FF6B9D)') : ''}
      <div class="ladder">${TITLES.map((x) => `<span class="${sStars >= x.min ? 'got' : ''}" title="⭐${x.min}">${x.icon}<small>${x.name}</small></span>`).join('')}</div>
    </div>
    <div class="badges">${badges.list.map((b) => `<div class="badge ${b.got ? 'got' : ''}"><span>${b.icon}</span><b>${b.name}</b><small>${b.desc}</small></div>`).join('')}</div>
    ${histWeeks.length > 1 ? `<h3 class="sec">📚 历史周报</h3><div class="card hist">${histWeeks.map((w) => `<button class="pill ${w === ws ? 'sel' : ''}" data-action="report-week" data-week="${w}">${fmtDate(w)} 周</button>`).join('')}</div>` : ''}`;
}

// ---------- 家长设置 ----------
function openSettings() {
  const pin = state.settings.pin;
  if (pin && ui.settings !== 'ok') {
    const v = prompt('请输入家长密码');
    if (v !== pin) { if (v !== null) toast('密码不对哦'); return; }
    ui.settings = 'ok';
  }
  renderSettings();
}

function renderSettings(section = 'tasks') {
  const s = state.settings;
  const typeName = { fixed: '固定星期', weekly: '每周 N 次', once: '指定日期' };
  const tabs = { tasks: '📋 任务', prizes: '🎁 奖品', story: '📖 剧情', season: '🏅 赛季', basic: '⚙️ 通用', data: '💾 数据' };
  let body = '';
  if (section === 'tasks') {
    body = `<button class="btn primary block" data-edit-task="">＋ 新增任务</button>
      ${state.tasks.map((t) => `<div class="set-row"><span class="emo">${t.emoji}</span><div class="info"><b>${esc(t.name)}</b>
        <small>${SUBJECTS[t.subject].name} · ${typeName[t.type]}${t.type === 'weekly' ? ` ${t.target} 次` : ''}${t.type === 'once' ? ` ${t.date}` : ` · ${t.days.map((d) => WEEKDAY_NAMES[d].slice(1)).join('')}`} · ${t.minutes || 0} 分钟${t.boss ? ' · BOSS' : ''}</small></div>
        <button class="btn small" data-edit-task="${t.id}">编辑</button></div>`).join('')}`;
  } else if (section === 'prizes') {
    body = `<div class="tier-set">${Object.entries(TIERS).map(([k, x]) => `<label>${x.name}概率权重 <input type="number" min="0" data-weight="${k}" value="${state.tierWeights[k]}"></label>
        <label>颜色 <input type="color" data-color="${k}" value="${state.tierColors[k] || x.color}"></label>`).join('')}</div>
      <button class="btn primary block" data-edit-prize="">＋ 新增奖品</button>
      ${state.prizes.map((p) => `<div class="set-row"><span class="emo">${p.emoji}</span><div class="info"><b>${esc(p.name)}</b><small>${TIERS[p.tier].name} · ⭐ ${p.cost}</small></div>
        <button class="btn small" data-edit-prize="${p.id}">编辑</button></div>`).join('')}`;
  } else if (section === 'story') {
    const grades = ['低年级', '中年级', '高年级'];
    body = `<label class="field">主线故事书<select data-story-book>
        ${grades.map((g) => `<optgroup label="${g}">${BOOKS.filter((b) => b.grade === g).map((b) => `<option value="${b.id}" ${state.story.bookId === b.id ? 'selected' : ''}>${b.emoji} ${b.title}</option>`).join('')}</optgroup>`).join('')}
        <option value="custom" ${state.story.bookId === 'custom' ? 'selected' : ''}>📘 自定义书籍</option></select></label>
      <fieldset class="box-field"><legend>自定义书籍</legend>
        <label class="field">书名<input data-custom-title value="${esc(state.story.custom.title)}" placeholder="比如：夏洛的网"></label>
        <label class="field">章节（每行一个，会自动生成剧情节点）<textarea data-custom-chapters rows="6">${esc(state.story.custom.chapters.join('\n'))}</textarea></label>
        <button class="btn" data-save-custom>保存并使用自定义书籍</button></fieldset>
      <p class="muted">剧情从 ${state.story.startWeek} 所在周开始，每周解锁一章。</p>
      <button class="btn block" data-story-restart>从本周重新开始剧情</button>`;
  } else if (section === 'season') {
    body = `${state.seasons.map((x) => `<div class="season-edit" data-season="${x.id}">
        <input data-sf="name" value="${esc(x.name)}"><input type="date" data-sf="start" value="${x.start}"><input type="date" data-sf="end" value="${x.end}">
        <button class="btn small ghost" data-del-season="${x.id}">删除</button></div>`).join('')}
      <button class="btn block" data-add-season>＋ 新增赛季</button>
      <p class="muted">称号按赛季内累计星星授予：${TITLES.map((t) => `${t.icon}${t.name}(${t.min})`).join(' → ')}</p>`;
  } else if (section === 'basic') {
    body = `<label class="field">孩子的昵称<input data-set="childName" value="${esc(s.childName)}"></label>
      <label class="field">配色主题<select data-set="theme">
        <option value="dopamine" ${s.theme === 'dopamine' ? 'selected' : ''}>🍭 多巴胺</option>
        <option value="mint" ${s.theme === 'mint' ? 'selected' : ''}>🌿 薄荷森林</option>
        <option value="ocean" ${s.theme === 'ocean' ? 'selected' : ''}>🌊 海洋</option>
        <option value="night" ${s.theme === 'night' ? 'selected' : ''}>🌌 星空（深色）</option></select></label>
      <label class="field">家长密码（留空表示不设）<input data-set="pin" type="password" inputmode="numeric" value="${esc(s.pin)}" placeholder="防止孩子自己改规则"></label>
      <label class="field">节日皮肤预览（孩子端不显示切换按钮，到日子自动触发）<select data-set="holidayPreview">
        <option value="">自动</option>${Object.entries(HOLIDAYS).map(([k, h]) => `<option value="${k}" ${s.holidayPreview === k ? 'selected' : ''}>${h.deco} ${h.name}</option>`).join('')}</select></label>
      ${installEvent ? '<button class="btn primary block" data-install>📲 安装到桌面</button>' : '<p class="muted">📲 安装：Android/电脑 Chrome 在地址栏或菜单中选择「安装应用」；iPhone/iPad 用 Safari 点「分享」→「添加到主屏幕」。</p>'}`;
  } else if (section === 'data') {
    body = `<p class="muted">所有数据只保存在这台设备的浏览器里。换设备或清理浏览器前，请先导出备份。</p>
      <button class="btn block" data-export>⬇️ 导出备份（JSON）</button>
      <label class="btn block">⬆️ 导入备份<input type="file" accept="application/json,.json" data-import hidden></label>
      <button class="btn ghost block danger" data-reset>🗑️ 清空所有数据并恢复默认</button>`;
  }
  const sheet = openSheet(`
    <div class="sheet-head"><h2>家长设置</h2><button class="icon-btn" data-close aria-label="关闭">✕</button></div>
    <div class="seg">${Object.entries(tabs).map(([k, v]) => `<button class="${k === section ? 'sel' : ''}" data-sec="${k}">${v}</button>`).join('')}</div>
    <div class="set-body">${body}</div>`, 'tall');
  bindSettings(sheet);
}

function bindSettings(sheet) {
  sheet.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (ds.close !== undefined) return closeSheet();
    if (ds.sec) return renderSettings(ds.sec);
    if (ds.editTask !== undefined) return taskForm(ds.editTask);
    if (ds.editPrize !== undefined) return prizeForm(ds.editPrize);
    if (ds.saveCustom !== undefined) {
      const title = $('[data-custom-title]', sheet).value.trim();
      const chapters = $('[data-custom-chapters]', sheet).value.split('\n').map((x) => x.trim()).filter(Boolean);
      if (!title || !chapters.length) return toast('请填写书名和至少一个章节');
      state.story.custom = { title, chapters };
      state.story.bookId = 'custom';
      commit(); toast('已切换到自定义书籍'); return renderSettings('story');
    }
    if (ds.storyRestart !== undefined) {
      state.story.startWeek = weekStart(today());
      commit(); toast('剧情从本周第 1 章重新开始'); return renderSettings('story');
    }
    if (ds.addSeason !== undefined) {
      const last = state.seasons[state.seasons.length - 1];
      const start = last ? addDays(last.end, 1) : today();
      state.seasons.push({ id: uid(), name: '新赛季', start, end: addDays(start, 150) });
      commit(); return renderSettings('season');
    }
    if (ds.delSeason) {
      if (state.seasons.length <= 1) return toast('至少保留一个赛季');
      state.seasons = state.seasons.filter((x) => x.id !== ds.delSeason);
      commit(); return renderSettings('season');
    }
    if (ds.install !== undefined && installEvent) {
      installEvent.prompt();
      installEvent = null;
      return;
    }
    if (ds.export !== undefined) {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `学习冒险岛备份-${today()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return;
    }
    if (ds.reset !== undefined) {
      if (!confirm('确定清空所有打卡、奖品和设置吗？此操作无法撤销。')) return;
      state = createDefaultState();
      commit(); closeSheet(); toast('已恢复默认');
    }
  });
  sheet.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.set !== undefined) {
      state.settings[el.dataset.set] = el.value;
      if (el.dataset.set === 'pin') ui.settings = 'ok';
      commit();
    } else if (el.dataset.weight) {
      state.tierWeights[el.dataset.weight] = Math.max(0, Number(el.value) || 0); commit();
    } else if (el.dataset.color) {
      state.tierColors[el.dataset.color] = el.value; commit();
    } else if (el.dataset.storyBook !== undefined) {
      if (el.value === 'custom' && !state.story.custom.chapters.length) return toast('请先在下方填写自定义书籍');
      state.story.bookId = el.value; commit();
    } else if (el.dataset.sf) {
      const row = el.closest('[data-season]');
      const season = state.seasons.find((x) => x.id === row.dataset.season);
      season[el.dataset.sf] = el.value; commit();
    } else if (el.dataset.import !== undefined && el.files[0]) {
      el.files[0].text().then((txt) => {
        try {
          const next = importState(txt);
          if (!confirm('导入会覆盖当前所有数据，确定吗？')) return;
          state = next; commit(); closeSheet(); toast('导入成功');
        } catch (err) { toast('导入失败：' + err.message); }
      });
    }
  });
}

function taskForm(id) {
  const t = state.tasks.find((x) => x.id === id) || { name: '', emoji: '📌', subject: 'en', type: 'fixed', days: [0, 1, 2, 3, 4, 5, 6], target: 3, date: today(), slot: '', minutes: 15, boss: false };
  const sheet = openSheet(`
    <div class="sheet-head"><h2>${id ? '编辑任务' : '新增任务'}</h2><button class="icon-btn" data-back aria-label="返回">✕</button></div>
    <form class="form" id="task-form">
      <div class="row2"><label class="field emoji-field">图标<input name="emoji" value="${esc(t.emoji)}" maxlength="4"></label>
      <label class="field">任务名<input name="name" value="${esc(t.name)}" required maxlength="30" placeholder="比如：RAZ 阅读"></label></div>
      <label class="field">科目 / 区域<select name="subject">${Object.entries(SUBJECTS).map(([k, x]) => `<option value="${k}" ${t.subject === k ? 'selected' : ''}>${x.icon} ${x.name}（${x.region}）</option>`).join('')}</select></label>
      <label class="field">类型<select name="type">
        <option value="fixed" ${t.type === 'fixed' ? 'selected' : ''}>固定星期（每天/指定星期都要做）</option>
        <option value="weekly" ${t.type === 'weekly' ? 'selected' : ''}>每周 N 次（灵活安排，不翻旧账）</option>
        <option value="once" ${t.type === 'once' ? 'selected' : ''}>指定日期（只做一次）</option></select></label>
      <div class="field days-field">安排星期<div class="days-pick">${WEEKDAY_NAMES.map((n, i) => `<label><input type="checkbox" name="days" value="${i}" ${t.days.includes(i) ? 'checked' : ''}><span>${n.slice(1)}</span></label>`).join('')}</div></div>
      <label class="field target-field">每周目标次数<input type="number" name="target" min="1" max="7" value="${t.target || 3}"></label>
      <label class="field date-field">日期<input type="date" name="date" value="${t.date || today()}"></label>
      <div class="row2"><label class="field">时间段<input name="slot" value="${esc(t.slot)}" placeholder="早上/放学后/睡前"></label>
      <label class="field">计划分钟<input type="number" name="minutes" min="0" max="600" value="${t.minutes ?? 15}"></label></div>
      <label class="check"><input type="checkbox" name="boss" ${t.boss ? 'checked' : ''}> ⚔️ 设为 BOSS 任务（难啃的硬骨头）</label>
      <div class="row">
        ${id ? '<button type="button" class="btn ghost danger" data-del>删除</button>' : ''}
        <button type="submit" class="btn primary">保存</button>
      </div>
    </form>`, 'tall');
  const form = $('#task-form', sheet);
  const sync = () => {
    const type = form.type.value;
    $('.days-field', sheet).hidden = type === 'once';
    $('.target-field', sheet).hidden = type !== 'weekly';
    $('.date-field', sheet).hidden = type !== 'once';
  };
  form.type.addEventListener('change', sync);
  sync();
  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) return renderSettings('tasks');
    if (e.target.closest('[data-del]')) {
      if (!confirm(`删除「${t.name}」？它的历史打卡记录也会一起清除。`)) return;
      state.tasks = state.tasks.filter((x) => x.id !== id);
      for (const map of [state.completions, state.skips]) for (const d of Object.keys(map)) delete map[d][id];
      commit();
      renderSettings('tasks');
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const days = fd.getAll('days').map(Number);
    const type = fd.get('type');
    if (type !== 'once' && !days.length) return toast('至少选择一天');
    const data = {
      name: fd.get('name').trim(), emoji: fd.get('emoji').trim() || '📌', subject: fd.get('subject'), type, days,
      target: Math.max(1, Math.min(7, Number(fd.get('target')) || 1)), date: fd.get('date') || today(),
      slot: fd.get('slot').trim(), minutes: Number(fd.get('minutes')) || 0, boss: fd.get('boss') === 'on',
    };
    if (!data.name) return toast('请填写任务名');
    if (id) Object.assign(t, data);
    else state.tasks.push({ id: uid(), ...data, createdAt: today() });
    commit();
    toast('已保存');
    renderSettings('tasks');
  });
}

function prizeForm(id) {
  const p = state.prizes.find((x) => x.id === id) || { name: '', emoji: '🎁', tier: 'common', cost: 20 };
  const sheet = openSheet(`
    <div class="sheet-head"><h2>${id ? '编辑奖品' : '新增奖品'}</h2><button class="icon-btn" data-back aria-label="返回">✕</button></div>
    <p class="muted">奖品最好和孩子一起商量着填 💕</p>
    <form class="form" id="prize-form">
      <div class="row2"><label class="field emoji-field">图标<input name="emoji" value="${esc(p.emoji)}" maxlength="4"></label>
      <label class="field">奖品名<input name="name" value="${esc(p.name)}" required maxlength="30"></label></div>
      <div class="row2"><label class="field">档位<select name="tier">${Object.entries(TIERS).map(([k, x]) => `<option value="${k}" ${p.tier === k ? 'selected' : ''}>${x.name}</option>`).join('')}</select></label>
      <label class="field">兑换需要的星星<input type="number" name="cost" min="1" max="99999" value="${p.cost}"></label></div>
      <div class="row">${id ? '<button type="button" class="btn ghost danger" data-del>删除</button>' : ''}<button type="submit" class="btn primary">保存</button></div>
    </form>`);
  const form = $('#prize-form', sheet);
  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) return renderSettings('prizes');
    if (e.target.closest('[data-del]')) {
      state.prizes = state.prizes.filter((x) => x.id !== id);
      commit();
      renderSettings('prizes');
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = { name: fd.get('name').trim(), emoji: fd.get('emoji').trim() || '🎁', tier: fd.get('tier'), cost: Math.max(1, Number(fd.get('cost')) || 1) };
    if (!data.name) return toast('请填写奖品名');
    if (id) Object.assign(p, data); else state.prizes.push({ id: uid(), ...data });
    commit();
    renderSettings('prizes');
  });
}

// ---------- 主渲染 ----------
const TABS = [
  ['today', '🏝️', '今日'],
  ['week', '📅', '一周'],
  ['adventure', '🗺️', '冒险'],
  ['rewards', '🎁', '奖励'],
  ['growth', '🌳', '成长'],
];

function render() {
  const holiday = state.settings.holidayPreview || holidayFor(today());
  document.body.dataset.theme = state.settings.theme;
  if (holiday) document.body.dataset.holiday = holiday; else delete document.body.dataset.holiday;
  const view = { today: renderToday, week: renderWeek, adventure: renderAdventure, rewards: renderRewards, growth: renderGrowth }[ui.tab];
  const app = $('#app');
  const scrollY = window.scrollY;
  app.innerHTML = `
    ${holiday ? `<div class="deco" aria-hidden="true">${HOLIDAYS[holiday].deco.repeat(6)}</div>` : ''}
    ${renderHeader()}
    ${holidayBanner()}
    <main>${view()}</main>
    <nav class="tabs">${TABS.map(([k, i, n]) => `<button class="${ui.tab === k ? 'sel' : ''}" data-action="tab" data-tab="${k}"><span>${i}</span>${n}</button>`).join('')}</nav>`;
  window.scrollTo(0, scrollY);
}

let reportTimer;
document.addEventListener('input', (e) => {
  const key = e.target.dataset?.report;
  if (!key) return;
  const ws = ui.reportWeek;
  state.reports[ws] ??= { good: '', improve: '', plan: '' };
  state.reports[ws][key] = e.target.value;
  clearTimeout(reportTimer);
  reportTimer = setTimeout(() => saveState(state), 400);
});

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]');
  if (!b || b.closest('.sheet')) return;
  const { action } = b.dataset;
  const t = today();
  switch (action) {
    case 'tab':
      ui.tab = b.dataset.tab;
      render();
      window.scrollTo(0, 0);
      break;
    case 'pick-date': ui.date = b.dataset.date; render(); break;
    case 'date-shift': ui.date = addDays(ui.date, Number(b.dataset.n)); render(); break;
    case 'week-shift': ui.week = addDays(ui.week, Number(b.dataset.n)); render(); break;
    case 'week-today': ui.week = weekStart(t); render(); break;
    case 'report-shift': ui.reportWeek = addDays(ui.reportWeek, Number(b.dataset.n)); render(); break;
    case 'report-week': ui.reportWeek = b.dataset.week; render(); break;
    case 'rate': rateSheet(b.dataset.id); break;
    case 'skip':
      state.skips[ui.date] ??= {};
      state.skips[ui.date][b.dataset.id] = true;
      commit();
      toast('⏭️ 已顺延到本周后面几天，不欠债！');
      break;
    case 'unskip':
      delete state.skips[ui.date]?.[b.dataset.id];
      commit();
      break;
    case 'attack': attack(); break;
    case 'draw': doDraw(); break;
    case 'redeem': {
      const v = state.vault.find((x) => x.id === b.dataset.id);
      if (starBalance(state) < v.cost) return toast('星星还不够，继续加油！');
      if (!confirm(`用 ⭐ ${v.cost} 兑换「${v.name}」？`)) return;
      v.redeemedAt = Date.now();
      commit();
      confetti();
      toast(`🎉 兑换成功：${v.emoji} ${v.name}`);
      break;
    }
    case 'swap': swapSheet(b.dataset.id); break;
    case 'settings': openSettings(); break;
  }
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
});

// 跨过零点时自动刷新“今天”
let lastDay = today();
setInterval(() => {
  if (today() !== lastDay) {
    if (ui.date === lastDay) ui.date = today();
    lastDay = today();
    if (!document.querySelector('.sheet')) render();
  }
}, 60000);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW 注册失败', e)));
}

render();
