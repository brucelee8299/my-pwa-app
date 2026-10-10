// 本地存储：所有数据只保存在这台设备的 localStorage
import { DEFAULT_TASKS, DEFAULT_PRIZES, TIERS } from './data.js';
import { todayKey, weekStart } from './logic.js';

const KEY = 'adventure_island_v1';

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

function defaultSeason(today) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  // 上学期：9 月–次年 1 月；下学期：2 月–7 月；暑假单独一个赛季
  if (m >= 9) return { id: uid(), name: `${y} 秋季学期`, start: `${y}-09-01`, end: `${y + 1}-01-31` };
  if (m === 1) return { id: uid(), name: `${y - 1} 秋季学期`, start: `${y - 1}-09-01`, end: `${y}-01-31` };
  if (m <= 7) return { id: uid(), name: `${y} 春季学期`, start: `${y}-02-01`, end: `${y}-07-15` };
  return { id: uid(), name: `${y} 暑假`, start: `${y}-07-16`, end: `${y}-08-31` };
}

export function createDefaultState() {
  const today = todayKey();
  return {
    version: 1,
    tasks: DEFAULT_TASKS.map((t) => ({ id: uid(), target: 1, date: today, boss: false, ...t, createdAt: weekStart(today) })),
    completions: {},
    skips: {},
    bossDefeats: {},
    ticketDays: {},
    vault: [],
    prizes: DEFAULT_PRIZES.map((p) => ({ id: uid(), ...p })),
    tierWeights: Object.fromEntries(Object.entries(TIERS).map(([k, v]) => [k, v.weight])),
    tierColors: Object.fromEntries(Object.entries(TIERS).map(([k, v]) => [k, v.color])),
    reports: {},
    story: { bookId: 'oz', startWeek: weekStart(today), custom: { title: '', chapters: [] } },
    seasons: [defaultSeason(today)],
    settings: { childName: '小冒险家', theme: 'dopamine', pin: '', holidayPreview: '' },
  };
}

function migrate(s) {
  const base = createDefaultState();
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  s.settings = { ...base.settings, ...s.settings };
  s.story = { ...base.story, ...s.story };
  return s;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('读取数据失败，使用默认数据', e);
  }
  return createDefaultState();
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('保存失败', e);
    return false;
  }
}

export function importState(json) {
  const s = JSON.parse(json);
  if (!s || !Array.isArray(s.tasks) || typeof s.completions !== 'object') throw new Error('不是有效的备份文件');
  return migrate(s);
}
