// 本地存储：所有数据只保存在这台设备的 localStorage
const KEY = 'note_quest_v1';

export const DEFAULT_SETTINGS = {
  name: '小音乐家',
  avatar: '🎹',
  answerMode: 'mix', // name 唱名按钮 / key 钢琴键盘 / mix 混合
  showJianpu: true,
  sound: true,
  staffView: 'auto', // auto / single / grand
  dailyMinutes: 10,
  keyLabels: 'c', // c 只在 C 键上标字 / all 全部标 / none 不标
};

export function createDefaultState() {
  return {
    version: 1,
    cards: {}, // 'treble:G4' → { box, due, last, seen, ok, r, intro }
    stages: {}, // 'T1' → { stars, acc, avgMs, date }
    days: {}, // '2026-10-27' → { ms, q, ok, done }
    confusions: {}, // 'treble:G4>E' → 次数
    best: {}, // 游戏最高分
    settings: { ...DEFAULT_SETTINGS },
  };
}

function migrate(s) {
  const base = createDefaultState();
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  s.settings = { ...base.settings, ...s.settings };
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
  if (!s || typeof s.cards !== 'object' || typeof s.days !== 'object') throw new Error('不是有效的备份文件');
  return migrate(s);
}
