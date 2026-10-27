// 记忆调度（类似 Anki 的莱特纳盒子）+ 出题、掌握度、水平评估、每日计划。纯函数。
import { STAGES, LEVELS, poolUpTo, BADGES } from './curriculum.js';

// ---------- 日期 ----------
const pad = (n) => String(n).padStart(2, '0');
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => toKey(new Date());
export const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return toKey(d); };

// ---------- 卡片调度 ----------
// 盒子 0~6，对应下次复习间隔（天）。答对且够快才升一级；答错降两级并当天重练。
export const INTERVALS = [1, 1, 2, 4, 7, 15, 30];
export const MAX_BOX = INTERVALS.length - 1;
export const FAST_MS = 3000; // 3 秒内答对才算"认得"
export const MASTER_MS = 1500; // 1.5 秒内才算"一眼认出"
const RECENT = 12;

export const newCard = (today) => ({ box: 0, due: today, last: null, seen: 0, ok: 0, r: [], intro: today });

/** 记录一次作答。card.r 保存最近 12 次：答对存用时（毫秒），答错存 -1 */
export function recordAnswer(card, correct, ms, today, { srs = true } = {}) {
  card.seen += 1;
  if (correct) card.ok += 1;
  card.r.push(correct ? Math.round(ms) : -1);
  if (card.r.length > RECENT) card.r.splice(0, card.r.length - RECENT);
  if (!srs) return card;
  if (!correct) {
    card.box = Math.max(0, card.box - 2);
    card.due = today;
    card.last = today; // 当天不再升级，明天再考
  } else if (card.due <= today && card.last !== today) {
    if (ms <= FAST_MS) card.box = Math.min(MAX_BOX, card.box + 1);
    card.due = addDays(today, INTERVALS[card.box]);
    card.last = today;
  }
  return card;
}

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function cardStats(card) {
  const r = card?.r || [];
  const times = r.filter((x) => x >= 0);
  return { n: r.length, acc: r.length ? times.length / r.length : 0, ms: median(times) };
}

// 掌握度：0 未学 🥚 → 1 刚认识 🐣 → 2 熟悉 🐥 → 3 熟练 🐦 → 4 精通 🦅
export const MASTERY = [
  { icon: '🥚', name: '未学', color: '#CED4DA' },
  { icon: '🐣', name: '刚认识', color: '#FFA94D' },
  { icon: '🐥', name: '熟悉', color: '#FCC419' },
  { icon: '🐦', name: '熟练', color: '#69DB7C' },
  { icon: '🦅', name: '精通', color: '#4C6EF5' },
];
export function masteryOf(card) {
  if (!card) return 0;
  const st = cardStats(card);
  if (card.box >= 5 && st.acc >= 0.9 && st.ms !== null && st.ms <= MASTER_MS) return 4;
  if (card.box >= 4) return 3;
  if (card.box >= 2) return 2;
  return 1;
}

export const isDue = (card, today) => !!card && card.due <= today && card.last !== today;
export const introduced = (state) => Object.keys(state.cards).filter((k) => state.cards[k]?.intro);
export const dueCards = (state, today) => introduced(state).filter((k) => isDue(state.cards[k], today));

/** 出题权重：新卡、薄弱、到期、慢的卡出现得更多 */
export function weightOf(card, today, focus = false) {
  if (!card) return focus ? 8 : 4;
  const st = cardStats(card);
  let w = [6, 5, 4, 3, 2, 1.5, 1][card.box] ?? 1;
  if (isDue(card, today)) w *= 2;
  if (st.n && st.acc < 0.8) w *= 2;
  if (st.ms !== null && st.ms > FAST_MS) w *= 1.5;
  if (card.r.at(-1) === -1) w *= 2;
  if (focus) w *= 4;
  return w;
}

/** 按权重随机挑下一张，避免和最近出现的重复 */
export function pickNext(pool, cards, { today, recent = [], focus = [], rng = Math.random } = {}) {
  if (!pool.length) return null;
  const avoid = new Set(recent.slice(-Math.min(2, pool.length - 1)));
  const cand = pool.filter((k) => !avoid.has(k));
  const fset = new Set(focus);
  const ws = cand.map((k) => weightOf(cards[k], today, fset.has(k)));
  let x = rng() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cand.length; i++) {
    x -= ws[i];
    if (x < 0) return cand[i];
  }
  return cand.at(-1);
}

export function weakest(state, keys, n = 4) {
  const score = (k) => {
    const c = state.cards[k];
    const st = cardStats(c);
    return (c?.box ?? 0) * 10 + st.acc * 20 - (st.ms ?? 4000) / 500;
  };
  return [...keys].sort((a, b) => score(a) - score(b)).slice(0, n);
}

// ---------- 关卡进度 ----------
export const stageStars = (state, id) => state.stages[id]?.stars || 0;
/** 当前关卡：第一个还没通过（0 星）的关 */
export function currentStage(state) {
  const i = STAGES.findIndex((s) => !stageStars(state, s.id));
  return i < 0 ? STAGES.length : i;
}
export const unlockedPool = (state) => poolUpTo(Math.min(currentStage(state), STAGES.length - 1));
/** 当前关卡的卡片里还没学过的 */
export function newNotesOf(state, i) {
  const st = STAGES[i];
  return st ? st.notes.filter((k) => !state.cards[k]?.intro) : [];
}
/** BOSS 解锁条件：本关的音都学过，且每个至少答对 3 次 */
export function bossReady(state, i) {
  const st = STAGES[i];
  if (!st) return false;
  return st.notes.every((k) => state.cards[k]?.intro && state.cards[k].ok >= 3);
}

/** BOSS 战星级：通过 = 错误不超过 2 个；2 星平均 ≤2.5 秒；3 星全对且平均 ≤1.5 秒 */
export function bossStars({ total, wrong, avgMs }) {
  if (wrong > 2 || !total) return 0;
  if (wrong === 0 && avgMs <= 1500) return 3;
  if (avgMs <= 2500) return 2;
  return 1;
}

// ---------- 水平评估 ----------
export function evaluateLevel(state, level) {
  const keys = poolUpTo(level.stages - 1);
  let n = 0; let ok = 0; const times = []; const weak = []; let covered = 0;
  for (const k of keys) {
    const c = state.cards[k];
    if (!c || c.r.length < 3) continue;
    covered += 1;
    const st = cardStats(c);
    n += c.r.length;
    ok += c.r.filter((x) => x >= 0).length;
    times.push(...c.r.filter((x) => x >= 0));
    if (st.acc < level.acc - 0.15 || (st.ms ?? Infinity) > level.ms * 1.5) weak.push(k);
  }
  const acc = n ? ok / n : 0;
  const ms = median(times);
  const passedStages = STAGES.slice(0, level.stages).every((s) => stageStars(state, s.id) > 0);
  const pass = passedStages && covered === keys.length && acc >= level.acc && ms !== null && ms <= level.ms && !weak.length;
  return { pass, covered, total: keys.length, acc, ms, weak, passedStages };
}
export function currentLevel(state) {
  let lv = 0;
  for (const l of LEVELS) {
    if (evaluateLevel(state, l).pass) lv = l.id; else break;
  }
  return lv;
}

// ---------- 打卡与统计 ----------
export const DAY_GOAL_MS = 5 * 60 * 1000; // 一天练够 5 分钟或完成今日训练，就算打卡
export const dayChecked = (d) => !!d && (d.done || d.ms >= DAY_GOAL_MS);

export function streakOf(state, today) {
  let k = dayChecked(state.days[today]) ? today : addDays(today, -1);
  let n = 0;
  while (dayChecked(state.days[k])) { n += 1; k = addDays(k, -1); }
  return n;
}
export function bestStreak(state) {
  const keys = Object.keys(state.days).filter((k) => dayChecked(state.days[k])).sort();
  let best = 0; let run = 0; let prev = null;
  for (const k of keys) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

export function summary(state, today) {
  const keys = Object.keys(state.cards);
  const days = Object.values(state.days);
  return {
    totalOk: keys.reduce((a, k) => a + state.cards[k].ok, 0),
    totalSeen: keys.reduce((a, k) => a + state.cards[k].seen, 0),
    totalMs: days.reduce((a, d) => a + (d.ms || 0), 0),
    streak: streakOf(state, today),
    bestStreak: bestStreak(state),
    passed: STAGES.filter((s) => stageStars(state, s.id) > 0).length,
    stars: STAGES.reduce((a, s) => a + stageStars(state, s.id), 0),
    mastered: keys.filter((k) => masteryOf(state.cards[k]) === 4).length,
    best: state.best,
  };
}
export const earnedBadges = (state, today) => {
  const s = summary(state, today);
  return BADGES.map((b) => ({ ...b, got: b.test(s) }));
};

/** 最常见的混淆：例如把低音谱表的 A 认成高音谱表的 C */
export function topConfusions(state, n = 5) {
  return Object.entries(state.confusions)
    .map(([k, count]) => { const [card, answer] = k.split('>'); return { card, answer, count }; })
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

// ---------- 每日 10 分钟计划 ----------
// ① 复习热身（到期、薄弱的音）→ ② 学新音 或 弱项特训 → ③ 挑战（BOSS 或小游戏）
export const GAME_ROTATION = ['speed', 'rain', 'word', 'place'];
export function dailyPlan(state, today, minutes = 10) {
  const scale = minutes / 10;
  const i = currentStage(state);
  const learned = introduced(state);
  const due = dueCards(state, today);
  const recent = learned.flatMap((k) => state.cards[k].r.slice(-3));
  const recentAcc = recent.length ? recent.filter((x) => x >= 0).length / recent.length : 1;
  const phases = [];
  if (learned.length) phases.push({ type: 'review', title: '复习热身', icon: '🔁', seconds: Math.round(180 * scale) });
  const fresh = newNotesOf(state, i);
  // 只有复习情况良好（到期不多、最近正确率 ≥ 80%）才学新音，避免越学越乱
  if (fresh.length && (due.length <= 8 || !learned.length) && recentAcc >= 0.8) {
    phases.push({ type: 'learn', title: '认识新朋友', icon: '🐣', notes: fresh, seconds: Math.round(150 * scale) });
  } else if (learned.length) {
    phases.push({ type: 'weak', title: '弱项特训', icon: '💪', seconds: Math.round(150 * scale) });
  }
  const dayNo = Math.floor(parseKey(today).getTime() / 86400000);
  const bossAfterLearn = fresh.length && phases.some((p) => p.type === 'learn');
  if (i < STAGES.length && (bossReady(state, i) || bossAfterLearn)) {
    phases.push({ type: 'boss', title: `BOSS：${STAGES[i].boss}`, icon: '⚔️', stage: i });
  } else {
    phases.push({ type: 'game', title: '今日游戏', icon: '🎮', game: GAME_ROTATION[dayNo % GAME_ROTATION.length] });
  }
  return phases;
}
