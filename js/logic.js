// 纯计算逻辑（不依赖 DOM），便于测试
import { RATINGS, BOOKS, TITLES, TIERS, BOSSES, SUBJECTS } from './data.js';

// ---------- 日期工具（均为本地日期，键为 YYYY-MM-DD） ----------
export function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}
// 0 = 周一 … 6 = 周日
export function weekdayIndex(key) {
  return (parseKey(key).getDay() + 6) % 7;
}
export function weekStart(key) {
  return addDays(key, -weekdayIndex(key));
}
export function weekDays(startKey) {
  return Array.from({ length: 7 }, (_, i) => addDays(startKey, i));
}
export function daysBetween(a, b) {
  return Math.round((parseKey(b) - parseKey(a)) / 86400000);
}
export function todayKey() {
  return toKey(new Date());
}

// ---------- 打卡 ----------
export function getCompletion(state, date, taskId) {
  return state.completions[date]?.[taskId] || null;
}
export function isDone(c) {
  return !!c && c.rating !== 'none';
}
export function starsOf(c) {
  return c ? RATINGS[c.rating]?.stars ?? 0 : 0;
}
function isSkipped(state, date, taskId) {
  return !!state.skips[date]?.[taskId];
}
// ---------- 暂停 ----------
// task.pauses = [{ from, to }]：从 from 当天起暂停，到 to 当天恢复（to 为 null 表示等家长手动恢复）
export function pauseAt(task, date) {
  return (task.pauses || []).find((p) => date >= p.from && (!p.to || date < p.to)) || null;
}
// 今天正在生效（或明天开始）的暂停；已经自动恢复的历史暂停不算
export function openPause(task, today) {
  return (task.pauses || []).find((p) => !p.to || p.to > today) || null;
}
export function activeOn(task, date) {
  return (!task.createdAt || date >= task.createdAt) && !pauseAt(task, date);
}

// ---------- 每周 N 次：按「连续可用段」计次 ----------
// 新建或暂停会把一周切成几段，每段单独计次；不满一周的段按剩余可用天数折算目标（向上取整）
function allowedIn(task, days) {
  return days.filter((d) => task.days.includes(weekdayIndex(d)));
}
function doneIn(state, task, days) {
  return days.filter((d) => isDone(getCompletion(state, d, task.id))).length;
}
export function weeklySegments(task, start) {
  const days = weekDays(start);
  const totalAllowed = allowedIn(task, days).length;
  const segs = [];
  let cur = null;
  for (const d of days) {
    if (activeOn(task, d)) {
      if (!cur) segs.push((cur = { days: [], endedByPause: false }));
      cur.days.push(d);
    } else {
      if (cur && pauseAt(task, d)) cur.endedByPause = true;
      cur = null;
    }
  }
  for (const seg of segs) {
    const n = allowedIn(task, seg.days).length;
    const target = n >= totalAllowed ? task.target : Math.ceil((task.target * n) / totalAllowed);
    seg.target = Math.min(n, target);
  }
  return segs;
}
function segmentOf(task, date) {
  return weeklySegments(task, weekStart(date)).find((seg) => seg.days.includes(date));
}

/**
 * 某天的任务清单。
 * 返回 [{ task, completion, status, remaining, canSkip }]
 * status: 'required' 今日要做 | 'skipped' 今日已顺延
 * remaining（仅 weekly）：做完今天这次之后本周还差几次
 */
export function tasksForDate(state, date) {
  const out = [];
  const wd = weekdayIndex(date);
  for (const task of state.tasks) {
    if (!activeOn(task, date)) continue;
    const completion = getCompletion(state, date, task.id);
    if (task.type === 'once') {
      if (task.date === date) out.push({ task, completion, status: 'required', canSkip: false });
      continue;
    }
    if (!task.days.includes(wd)) continue;
    if (task.type === 'fixed') {
      out.push({ task, completion, status: 'required', canSkip: false });
      continue;
    }
    // weekly：滑动窗口，不翻旧账
    const seg = segmentOf(task, date);
    const left = seg.target - doneIn(state, task, seg.days.filter((d) => d < date));
    if (left <= 0 && !completion) continue; // 本周已达标：任务消失，提前放假
    const remaining = Math.max(0, left - (isDone(completion) ? 1 : 0));
    const skipped = isSkipped(state, date, task.id) && !completion;
    const canSkip = !completion && allowedIn(task, seg.days.filter((d) => d > date)).length >= left;
    out.push({ task, completion, status: skipped ? 'skipped' : 'required', remaining, canSkip: canSkip || skipped });
  }
  return out;
}

// 当天是否「全部完成」（至少有一个必做任务，且必做的都做了）
export function isPerfectDay(state, date) {
  const req = tasksForDate(state, date).filter((x) => x.status === 'required');
  return req.length > 0 && req.every((x) => isDone(x.completion));
}

// ---------- BOSS ----------
export function bossFor(date) {
  return BOSSES[weekdayIndex(date)];
}
export function bossState(state, date) {
  const req = tasksForDate(state, date).filter((x) => x.status === 'required');
  const marked = req.filter((x) => x.task.boss);
  const targets = marked.length ? marked : req;
  const done = targets.filter((x) => isDone(x.completion)).length;
  const total = targets.length;
  const hp = total ? (total - done) / total : 0;
  return {
    boss: bossFor(date),
    targets,
    marked: marked.length > 0,
    hp,
    canAttack: total > 0 && done === total,
    defeated: !!state.bossDefeats[date],
  };
}

// ---------- 周视图投影 ----------
// 返回 { [date]: [{ task, kind }] }，kind: done | half | none | planned | skipped
export function weekPlan(state, start, today) {
  const days = weekDays(start);
  const plan = Object.fromEntries(days.map((d) => [d, []]));
  const kindOf = (c) => (c.rating === 'none' ? 'none' : c.rating === 'full' ? 'done' : 'half');
  for (const task of state.tasks) {
    if (task.type === 'once') {
      if (plan[task.date] && activeOn(task, task.date)) {
        const c = getCompletion(state, task.date, task.id);
        plan[task.date].push({ task, kind: c ? kindOf(c) : task.date >= today ? 'planned' : 'missed' });
      }
      continue;
    }
    if (task.type === 'fixed') {
      for (const d of days) {
        if (!task.days.includes(weekdayIndex(d)) || !activeOn(task, d)) continue;
        const c = getCompletion(state, d, task.id);
        plan[d].push({ task, kind: c ? kindOf(c) : d >= today ? 'planned' : 'missed' });
      }
      continue;
    }
    // weekly：已完成的天如实显示；过去没做的不显示（不翻旧账）；剩余次数排到今天及以后的可用日
    for (const seg of weeklySegments(task, start)) {
      let left = seg.target - doneIn(state, task, seg.days);
      for (const d of seg.days) {
        const c = getCompletion(state, d, task.id);
        if (c) {
          plan[d].push({ task, kind: kindOf(c) });
          continue;
        }
        if (d < today || left <= 0 || !task.days.includes(weekdayIndex(d))) continue;
        if (isSkipped(state, d, task.id)) {
          plan[d].push({ task, kind: 'skipped' });
          continue;
        }
        plan[d].push({ task, kind: 'planned' });
        left--;
      }
    }
  }
  return plan;
}

// ---------- 周统计 ----------
function requiredInWeek(state, task, start) {
  const days = weekDays(start).filter((d) => activeOn(task, d));
  if (task.type === 'once') return days.includes(task.date) ? 1 : 0;
  if (task.type === 'fixed') return allowedIn(task, days).length;
  // 被暂停打断的段：做了几次就算几次，不追究没做完的部分
  return weeklySegments(task, start).reduce(
    (sum, seg) => sum + (seg.endedByPause ? Math.min(seg.target, doneIn(state, task, seg.days)) : seg.target), 0);
}

export function weekStats(state, start) {
  const days = weekDays(start);
  const counts = { full: 0, effort: 0, quality: 0, none: 0 };
  let stars = 0, minutes = 0, req = 0, done = 0;
  const perTask = [];
  const perSubject = Object.fromEntries(Object.keys(SUBJECTS).map((k) => [k, { req: 0, done: 0 }]));
  for (const task of state.tasks) {
    const r = requiredInWeek(state, task, start);
    let d = 0, tStars = 0, planned = 0, actual = 0;
    for (const day of days) {
      const c = getCompletion(state, day, task.id);
      if (!c) continue;
      counts[c.rating]++;
      tStars += starsOf(c);
      if (isDone(c)) {
        d++;
        planned += task.minutes || 0;
        actual += Number(c.minutes) || 0;
      }
    }
    if (r === 0 && d === 0) continue;
    stars += tStars;
    minutes += actual;
    req += r;
    done += Math.min(d, r);
    perSubject[task.subject].req += r;
    perSubject[task.subject].done += Math.min(d, r);
    perTask.push({ task, required: r, done: d, stars: tStars, planned, actual, met: d >= r });
  }
  return {
    start,
    rate: req ? done / req : 0,
    required: req,
    done,
    stars,
    counts,
    minutes,
    perTask,
    perSubject,
    perfectDays: days.filter((d) => isPerfectDay(state, d)).length,
  };
}

// 能量树：本周完成率 → 0..20 片叶子
export function treeLeaves(rate) {
  return Math.round(Math.max(0, Math.min(1, rate)) * 20);
}
export function treeStage(leaves) {
  if (leaves === 0) return '一颗种子';
  if (leaves <= 4) return '冒出嫩芽';
  if (leaves <= 9) return '小树苗';
  if (leaves <= 14) return '茁壮小树';
  if (leaves <= 19) return '大树';
  return '参天大树';
}

// ---------- 星星与抽奖券 ----------
export function allDates(state) {
  return Object.keys(state.completions).sort();
}
export function totalStars(state, from = '0000-00-00', to = '9999-99-99') {
  let s = 0;
  for (const [date, map] of Object.entries(state.completions)) {
    if (date < from || date > to) continue;
    for (const c of Object.values(map)) s += starsOf(c);
  }
  return s;
}
export function spentStars(state) {
  return state.vault.filter((v) => v.redeemedAt).reduce((a, v) => a + v.cost, 0);
}
export function starBalance(state) {
  return totalStars(state) - spentStars(state);
}
export function perfectDayList(state, today) {
  return allDates(state).filter((d) => d <= today && isPerfectDay(state, d));
}
// 抽奖券一旦获得就记录在 ticketDays 里，之后新增任务也不会收回
export function ticketsEarned(state, today) {
  const days = new Set([...perfectDayList(state, today), ...Object.keys(state.ticketDays || {})]);
  return days.size + 2 * Object.keys(state.bossDefeats).length;
}
export function ticketBalance(state, today) {
  return Math.max(0, ticketsEarned(state, today) - state.vault.length);
}

// 盲盒抽奖：先按档位概率选档，再在档内等概率选奖品
export function drawPrize(state, rand = Math.random) {
  const tiers = Object.keys(TIERS).filter((t) => state.prizes.some((p) => p.tier === t));
  if (!tiers.length) return null;
  const weights = tiers.map((t) => Math.max(0, Number(state.tierWeights[t] ?? TIERS[t].weight)));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  let r = rand() * sum;
  let tier = tiers[tiers.length - 1];
  for (let i = 0; i < tiers.length; i++) {
    if (r < weights[i]) { tier = tiers[i]; break; }
    r -= weights[i];
  }
  const pool = state.prizes.filter((p) => p.tier === tier);
  return pool[Math.floor(rand() * pool.length)];
}

// ---------- 剧情 ----------
export function currentBook(state) {
  if (state.story.bookId === 'custom' && state.story.custom?.chapters?.length) {
    return { id: 'custom', emoji: '📘', ...state.story.custom };
  }
  return BOOKS.find((b) => b.id === state.story.bookId) || BOOKS[0];
}
export const CHAPTER_CLEAR_RATE = 0.8;
export function storyProgress(state, today) {
  const book = currentBook(state);
  const start = state.story.startWeek;
  const nowWeek = weekStart(today);
  const idx = Math.floor(daysBetween(start, nowWeek) / 7);
  const chapters = book.chapters.map((title, i) => {
    const wk = addDays(start, i * 7);
    if (i > idx || idx < 0) return { title, state: 'locked', week: wk };
    const rate = weekStats(state, wk).rate;
    if (i === idx) return { title, state: rate >= CHAPTER_CLEAR_RATE ? 'cleared' : 'current', rate, week: wk };
    return { title, state: rate >= CHAPTER_CLEAR_RATE ? 'cleared' : 'passed', rate, week: wk };
  });
  const current = Math.max(0, Math.min(idx, book.chapters.length - 1));
  return { book, chapters, current, finished: idx >= book.chapters.length };
}

// ---------- 赛季、称号、徽章 ----------
export function currentSeason(state, today) {
  return state.seasons.find((s) => today >= s.start && today <= s.end) || state.seasons[state.seasons.length - 1] || null;
}
export function titleFor(stars) {
  let t = TITLES[0];
  for (const x of TITLES) if (stars >= x.min) t = x;
  const next = TITLES.find((x) => x.min > stars) || null;
  return { ...t, next };
}

export function computeBadges(state, today) {
  const dates = allDates(state).filter((d) => d <= today);
  const all = dates.flatMap((d) => Object.values(state.completions[d]));
  const doneDays = new Set(dates.filter((d) => Object.values(state.completions[d]).some(isDone)));
  // 最长连续打卡
  let streak = 0, best = 0, prev = null;
  for (const d of [...doneDays].sort()) {
    streak = prev && addDays(prev, 1) === d ? streak + 1 : 1;
    best = Math.max(best, streak);
    prev = d;
  }
  const weeks = [...new Set(dates.map(weekStart))];
  const weekStatsList = weeks.map((w) => weekStats(state, w));
  const perfectWeek = weekStatsList.some((s) => s.required > 0 && s.rate >= 1 && addDays(s.start, 6) <= today);
  const allSubjects = weekStatsList.some((s) => Object.values(s.perSubject).every((x) => x.done > 0));
  const halfStars = all.filter((c) => c.rating === 'effort' || c.rating === 'quality').length;
  let onTime = 0;
  for (const d of dates) {
    for (const [id, c] of Object.entries(state.completions[d])) {
      const t = state.tasks.find((x) => x.id === id);
      if (t && isDone(c) && c.minutes && Number(c.minutes) <= t.minutes) onTime++;
    }
  }
  const bosses = Object.keys(state.bossDefeats).length;
  const cleared = storyProgress(state, today).chapters.filter((c) => c.state === 'cleared').length;
  const list = [
    { id: 'first', icon: '🌱', name: '冒险启程', desc: '完成第一次打卡', got: all.some(isDone) },
    { id: 'perfectday', icon: '🌈', name: '完美一天', desc: '某天全部任务完成', got: perfectDayList(state, today).length > 0 },
    { id: 'perfectweek', icon: '🏆', name: '完美一周', desc: '一整周完成率 100%', got: perfectWeek },
    { id: 'streak7', icon: '🔥', name: '七日连击', desc: '连续 7 天都有打卡', got: best >= 7 },
    { id: 'boss1', icon: '⚔️', name: '初战告捷', desc: '第一次击败 BOSS', got: bosses >= 1 },
    { id: 'boss10', icon: '🗡️', name: 'Boss 猎人', desc: '累计击败 10 个 BOSS', got: bosses >= 10 },
    { id: 'half', icon: '🌗', name: '永不放弃', desc: '收集 10 个半颗星', got: halfStars >= 10 },
    { id: 'time', icon: '⏱️', name: '时间管理大师', desc: '20 次在计划时长内完成', got: onTime >= 20 },
    { id: 'allsub', icon: '🧭', name: '全岛探险家', desc: '一周内四大区域都有探索', got: allSubjects },
    { id: 'chapter3', icon: '📖', name: '故事迷', desc: '通关 3 个剧情章节', got: cleared >= 3 },
    { id: 'draw10', icon: '🎁', name: '盲盒达人', desc: '开启 10 次盲盒', got: state.vault.length >= 10 },
    { id: 'saver', icon: '🐷', name: '攒星小达人', desc: '星星余额达到 200', got: starBalance(state) >= 200 },
  ];
  return { list, best, bosses, halfStars, onTime };
}

export function formatStars(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
