// 内置数据：科目/区域、默认任务、书库、BOSS、称号、节日、默认奖品

export const SUBJECTS = {
  en: { name: '英语', region: '魔法森林', icon: '🌲', color: '#FF6B9D' },
  math: { name: '数学', region: '数字城堡', icon: '🏰', color: '#4ECDC4' },
  cn: { name: '语文', region: '诗词山谷', icon: '⛰️', color: '#FFA94D' },
  other: { name: '其他', region: '神秘遗迹', icon: '🗿', color: '#9775FA' },
};

export const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// type: fixed = 固定星期（days 为 0..6，0=周一）；weekly = 每周 N 次（滑动窗口）；once = 指定日期
export const DEFAULT_TASKS = [
  { name: '语文早读', emoji: '📖', subject: 'cn', type: 'fixed', days: [0, 1, 2, 3, 4], slot: '早上', minutes: 15 },
  { name: '数学口算', emoji: '🧮', subject: 'math', type: 'fixed', days: [0, 1, 2, 3, 4, 5, 6], slot: '放学后', minutes: 10 },
  { name: 'RAZ 英语阅读', emoji: '📚', subject: 'en', type: 'weekly', target: 4, days: [0, 1, 2, 3, 4, 5, 6], slot: '晚上', minutes: 20 },
  { name: '英语磨耳朵', emoji: '🎧', subject: 'en', type: 'fixed', days: [0, 1, 2, 3, 4, 5, 6], slot: '睡前', minutes: 20, boss: true },
  { name: '背单词', emoji: '🔤', subject: 'en', type: 'weekly', target: 3, days: [0, 1, 2, 3, 4, 5, 6], slot: '晚上', minutes: 10 },
  { name: '学而思奥数', emoji: '🧠', subject: 'math', type: 'weekly', target: 2, days: [0, 1, 2, 3, 4, 5, 6], slot: '晚上', minutes: 30, boss: true },
  { name: '古筝练习', emoji: '🎼', subject: 'other', type: 'fixed', days: [0, 1, 2, 3, 4, 5], slot: '晚饭后', minutes: 30 },
  { name: '数学卷子订正', emoji: '✏️', subject: 'math', type: 'fixed', days: [6], slot: '下午', minutes: 30 },
];

export const RATINGS = {
  full: { stars: 1, label: '完整高质量完成', short: '⭐ 1 颗星', icon: '⭐' },
  effort: { stars: 0.5, label: '只做了一半 / 今日尽力了', short: '🌗 半颗星', icon: '🌗' },
  quality: { stars: 0.5, label: '完成了但质量不达标', short: '🌗 半颗星', icon: '🌓' },
  none: { stars: 0, label: '完全没有动手', short: '❌ 不给星', icon: '❌' },
};

// 书库：每本书 12 个剧情节点，每周解锁一章
export const BOOKS = [
  {
    id: 'oz', title: '绿野仙踪', grade: '中年级', emoji: '🌪️',
    chapters: ['龙卷风来临', '芒奇金人的欢迎', '黄砖路启程', '稻草人加入', '铁皮人加入', '胆小的狮子', '致命的罂粟花田', '抵达翡翠城', '奥兹的考验', '西方女巫', '揭开奥兹的秘密', '回到堪萨斯'],
  },
  {
    id: 'totto', title: '窗边的小豆豆', grade: '低年级', emoji: '🚃',
    chapters: ['电车教室', '新的学校', '"海的味道，山的味道"', '午饭时间', '散步课', '游泳池', '运动会', '露营之夜', '温泉旅行', '校长先生', '最好的朋友', '巴学园的钟声'],
  },
  {
    id: 'xiyou', title: '西游记', grade: '中年级', emoji: '🐒',
    chapters: ['石猴出世', '拜师学艺', '大闹天宫', '五行山下', '师徒相遇', '收服八戒', '流沙河收沙僧', '三打白骨精', '火焰山', '真假美猴王', '通天河', '取得真经'],
  },
  {
    id: 'prince', title: '小王子', grade: '中年级', emoji: '🌹',
    chapters: ['沙漠中的飞行员', '画一只羊', 'B612 小行星', '猴面包树', '玫瑰花', '国王的星球', '爱虚荣的人', '点灯人', '地理学家', '来到地球', '狐狸的秘密', '回家的路'],
  },
  {
    id: 'hp', title: '哈利·波特与魔法石', grade: '高年级', emoji: '⚡',
    chapters: ['大难不死的男孩', '猫头鹰来信', '对角巷', '九又四分之三站台', '分院帽', '魔药课', '万圣节的巨怪', '魁地奇比赛', '厄里斯魔镜', '禁林', '活板门', '魔法石'],
  },
  {
    id: 'sea', title: '海底两万里', grade: '高年级', emoji: '🐙',
    chapters: ['神秘的海怪', '登上鹦鹉螺号', '尼摩船长', '海底森林', '珊瑚王国', '采珠场', '阿拉伯隧道', '消失的大西洲', '南极冰原', '大章鱼', '海上风暴', '重返陆地'],
  },
];

// 按星期轮换的 BOSS（索引 0=周一）
export const BOSSES = [
  { name: '单元测试巨兽', emoji: '👹', loot: '🛡️ 知识盾牌' },
  { name: '知识守卫者', emoji: '🗿', loot: '📜 智慧卷轴' },
  { name: '粗心小恶魔', emoji: '😈', loot: '🔍 细心放大镜' },
  { name: '拖延史莱姆', emoji: '🟢', loot: '⏱️ 时间沙漏' },
  { name: '遗忘幽灵', emoji: '👻', loot: '💎 记忆水晶' },
  { name: '懒惰巨龙', emoji: '🐉', loot: '🔥 勇气火焰' },
  { name: '周考大魔王', emoji: '🦹', loot: '👑 胜利王冠' },
];

export const TITLES = [
  { min: 0, name: '冒险新手', icon: '🐣' },
  { min: 30, name: '见习探险家', icon: '🎒' },
  { min: 80, name: '勇敢旅行者', icon: '🧭' },
  { min: 150, name: '森林守护者', icon: '🌳' },
  { min: 250, name: '城堡骑士', icon: '🛡️' },
  { min: 400, name: '山谷智者', icon: '🦉' },
  { min: 600, name: '遗迹探秘者', icon: '🗺️' },
  { min: 900, name: '传说冒险王', icon: '👑' },
];

export const TIERS = {
  common: { name: '普通', color: '#74C0FC', weight: 70 },
  rare: { name: '稀有', color: '#B197FC', weight: 25 },
  legendary: { name: '传说', color: '#FFD43B', weight: 5 },
};

export const DEFAULT_PRIZES = [
  { name: '新笔一支', emoji: '🖊️', tier: 'common', cost: 10 },
  { name: '小首饰手串', emoji: '📿', tier: 'common', cost: 10 },
  { name: '多玩 30 分钟', emoji: '🎮', tier: 'common', cost: 20 },
  { name: '自选晚餐', emoji: '🍝', tier: 'common', cost: 40 },
  { name: '免一次课外作业', emoji: '🎫', tier: 'common', cost: 50 },
  { name: '心仪漫画一本', emoji: '📕', tier: 'common', cost: 60 },
  { name: '看一场电影', emoji: '🎬', tier: 'rare', cost: 120 },
  { name: '去游乐场', emoji: '🎡', tier: 'rare', cost: 200 },
  { name: '50 元现金', emoji: '💵', tier: 'rare', cost: 300 },
  { name: '100 元现金', emoji: '💰', tier: 'legendary', cost: 600 },
  { name: '外出旅行', emoji: '✈️', tier: 'legendary', cost: 800 },
  { name: 'AI 陪伴机器人', emoji: '🤖', tier: 'legendary', cost: 1500 },
];

// 节日限定皮肤（自动触发）。农历节日按公历日期列出。
const SPRING = { 2025: '01-29', 2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03', 2031: '01-23', 2032: '02-11' };
const MID_AUTUMN = { 2025: '10-06', 2026: '09-25', 2027: '09-15', 2028: '10-03', 2029: '09-22', 2030: '09-12', 2031: '10-01', 2032: '09-19' };

export const HOLIDAYS = {
  spring: { name: '春节', deco: '🏮', banner: '🧧 新春快乐！冒险岛挂起了红灯笼' },
  midautumn: { name: '中秋', deco: '🌕', banner: '🥮 中秋快乐！冒险岛升起了圆月亮' },
  national: { name: '国庆', deco: '🇨🇳', banner: '🎉 国庆快乐！冒险岛换上了节日新装' },
};

function within(dateStr, centerStr, before, after) {
  const d = Date.parse(dateStr + 'T00:00:00');
  const c = Date.parse(centerStr + 'T00:00:00');
  const diff = Math.round((d - c) / 86400000);
  return diff >= -before && diff <= after;
}

// 返回 'spring' | 'midautumn' | 'national' | null
export function holidayFor(dateStr) {
  const y = Number(dateStr.slice(0, 4));
  if (SPRING[y] && within(dateStr, `${y}-${SPRING[y]}`, 3, 7)) return 'spring';
  if (SPRING[y + 1] && within(dateStr, `${y + 1}-${SPRING[y + 1]}`, 3, 7)) return 'spring';
  if (MID_AUTUMN[y] && within(dateStr, `${y}-${MID_AUTUMN[y]}`, 2, 1)) return 'midautumn';
  const md = dateStr.slice(5);
  if (md >= '10-01' && md <= '10-07') return 'national';
  return null;
}
