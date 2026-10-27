// 课程设计：关卡、识谱水平标准、拼单词词库、成就。
import { cardKey } from './music.js';

const T = (...ids) => ids.map((id) => cardKey('treble', id));
const B = (...ids) => ids.map((id) => cardKey('bass', id));

// 地标法：先学中央C、高音G、低音F 这些"地标"，再向两边扩展；高音、低音交替学，双手都不落下
export const ISLANDS = [
  { id: 'town', name: '中央C小镇', emoji: '🏡', color: '#FF922B', desc: '从中央C出发，认识双手的第一批音' },
  { id: 'isles', name: '五线谱群岛', emoji: '🏝️', color: '#20C997', desc: '把五条线、四个间全部占领' },
  { id: 'peaks', name: '加线高山', emoji: '⛰️', color: '#5C7CFA', desc: '爬上加线，认识更高更低的音' },
  { id: 'castle', name: '大谱表城堡', emoji: '🏰', color: '#BE4BDB', desc: '高低音混在一起，像真正弹琴一样识谱' },
];

export const STAGES = [
  { id: 'T1', island: 'town', clef: 'treble', title: '中央C一家', boss: '🐌 慢吞吞蜗牛', notes: T('C4', 'D4', 'E4'), tip: '中央C 在高音谱表下面，自己带一条短短的加线。' },
  { id: 'T2', island: 'town', clef: 'treble', title: '地标 G', boss: '🐸 跳跳蛙', notes: T('F4', 'G4'), tip: '高音谱号的小圈绕着第二线——这条线上就是 G！' },
  { id: 'B1', island: 'town', clef: 'bass', title: '左手往下走', boss: '🦔 刺猬团', notes: B('C4', 'B3', 'A3'), tip: '在低音谱表里，中央C 在上面，也带一条加线。' },
  { id: 'B2', island: 'town', clef: 'bass', title: '地标 F', boss: '🦉 猫头鹰', notes: B('G3', 'F3'), tip: '低音谱号的两个点夹住第四线——这条线上就是 F！' },
  { id: 'T3', island: 'isles', clef: 'treble', title: '第三间的 C', boss: '🦀 横行蟹', notes: T('A4', 'B4', 'C5'), tip: '高音谱表第三间是 C，它是第二个地标。' },
  { id: 'B3', island: 'isles', clef: 'bass', title: '第二间的 C', boss: '🐙 八爪鱼', notes: B('E3', 'D3', 'C3'), tip: '低音谱表第二间也是 C（比中央C 低一组）。' },
  { id: 'T4', island: 'isles', clef: 'treble', title: '登上第五线', boss: '🦈 鲨鱼船长', notes: T('D5', 'E5', 'F5'), tip: '第五线是 F。四个间连起来是 F A C E。' },
  { id: 'B4', island: 'isles', clef: 'bass', title: '潜到第一线', boss: '🐋 大鲸鱼', notes: B('B2', 'A2', 'G2'), tip: '低音谱表第一线是 G。四个间是 A C E G。' },
  { id: 'T5', island: 'peaks', clef: 'treble', title: '高处的加线', boss: '🦅 雄鹰', notes: T('G5', 'A5', 'B5', 'C6'), tip: '上加二线是高音C，第三个地标。' },
  { id: 'B5', island: 'peaks', clef: 'bass', title: '低处的加线', boss: '🐻 山洞熊', notes: B('F2', 'E2', 'D2', 'C2'), tip: '下加二线是低音C，从这里往上数就快了。' },
  { id: 'T6', island: 'peaks', clef: 'treble', title: '高音谱表往下', boss: '🐐 岩羊', notes: T('B3', 'A3'), tip: '中央C 再往下，还是用加线。' },
  { id: 'B6', island: 'peaks', clef: 'bass', title: '低音谱表往上', boss: '🦙 羊驼', notes: B('D4', 'E4'), tip: '中央C 再往上，低音谱表也能写。' },
  { id: 'G1', island: 'castle', clef: 'grand', title: '大谱表总决战', boss: '🐉 识谱巨龙', notes: [], tip: '高音谱表和低音谱表一起出现，先看是哪个谱号！' },
];

export const stageIndex = (id) => STAGES.findIndex((s) => s.id === id);
/** 第 i 关及之前学到的所有卡片 */
export function poolUpTo(i) {
  return STAGES.slice(0, i + 1).flatMap((s) => s.notes);
}
export const ALL_CARDS = poolUpTo(STAGES.length - 1);

// ---------- 识谱水平标准 ----------
// 参考：真实乐谱里简单乐曲大约每秒 1~2 个音；单个音的辨认降到 1.5 秒以内，
// 识谱就不再是弹琴的瓶颈，开始能"边看边弹"。正确率要求逐级提高，最后要做到像认汉字一样不用想。
export const LEVELS = [
  {
    id: 1, icon: '🌱', name: '入门', acc: 0.9, ms: 5000, stages: 4,
    range: '中央C 附近：高音 C4–G4、低音 F3–C4（双手五指位置）',
    desc: '能认出启蒙教材里最常见的中央C 位置，每个音 5 秒内、正确率 90%。',
  },
  {
    id: 2, icon: '🌿', name: '基础', acc: 0.9, ms: 3000, stages: 8,
    range: '五线四间全部：高音 E4–F5、低音 G2–A3，以及中央C 一带',
    desc: '谱表上的所有线和间都认识，每个音 3 秒内、正确率 90%。',
  },
  {
    id: 3, icon: '🌳', name: '熟练', acc: 0.95, ms: 2000, stages: 12,
    range: '加上下加一、二线：低音C（C2）到高音C（C6）共 29 个音',
    desc: '包括加线在内都认识，并能在键盘上找对八度，每个音 2 秒内、正确率 95%。',
  },
  {
    id: 4, icon: '🏆', name: '流畅', acc: 0.98, ms: 1500, stages: 13,
    range: '大谱表高低音混合',
    desc: '一眼就知道——平均 1.5 秒内、正确率 98%。达到这个程度，识谱不再拖慢弹琴。',
  },
];

// ---------- 音符拼单词 ----------
export const WORDS = [
  { w: 'EGG', cn: '鸡蛋', e: '🥚' }, { w: 'FEED', cn: '喂养', e: '🍼' }, { w: 'BAG', cn: '包', e: '👜' },
  { w: 'BED', cn: '床', e: '🛏️' }, { w: 'BEE', cn: '蜜蜂', e: '🐝' }, { w: 'CAB', cn: '出租车', e: '🚕' },
  { w: 'CAFE', cn: '咖啡馆', e: '☕' }, { w: 'CAGE', cn: '笼子', e: '🐦' }, { w: 'DAD', cn: '爸爸', e: '👨' },
  { w: 'FACE', cn: '脸', e: '😊' }, { w: 'AGE', cn: '年龄', e: '🎂' }, { w: 'ACE', cn: '王牌', e: '🃏' },
  { w: 'BEAD', cn: '珠子', e: '📿' }, { w: 'BADGE', cn: '徽章', e: '📛' }, { w: 'CABBAGE', cn: '卷心菜', e: '🥬' },
  { w: 'BAGGAGE', cn: '行李', e: '🧳' }, { w: 'BEEF', cn: '牛肉', e: '🥩' }, { w: 'ADD', cn: '加', e: '➕' },
  { w: 'DECADE', cn: '十年', e: '📅' }, { w: 'FADED', cn: '褪色的', e: '👖' },
];

// ---------- 游戏厅 ----------
export const GAMES = [
  { id: 'speed', name: '60 秒快闪', emoji: '⚡', desc: '一分钟能认出多少个音？挑战最高分！' },
  { id: 'rain', name: '音符小火车', emoji: '🚂', desc: '音符一个个开过来，在它进站前认出它' },
  { id: 'word', name: '音符拼单词', emoji: '🔤', desc: '把五线谱上的音连起来，拼出英文单词' },
  { id: 'place', name: '摆音符', emoji: '🎯', desc: '反过来：听到音、看到键，把音符摆到谱上' },
];

// ---------- 成就 ----------
export const BADGES = [
  { id: 'first', icon: '🎵', name: '第一个音', test: (s) => s.totalOk >= 1 },
  { id: 'hundred', icon: '💯', name: '认对 100 次', test: (s) => s.totalOk >= 100 },
  { id: 'thousand', icon: '🎖️', name: '认对 1000 次', test: (s) => s.totalOk >= 1000 },
  { id: 'streak3', icon: '🔥', name: '连续 3 天', test: (s) => s.bestStreak >= 3 },
  { id: 'streak7', icon: '🌟', name: '连续 7 天', test: (s) => s.bestStreak >= 7 },
  { id: 'streak30', icon: '👑', name: '连续 30 天', test: (s) => s.bestStreak >= 30 },
  { id: 'town', icon: '🏡', name: '走出小镇', test: (s) => s.passed >= 4 },
  { id: 'isles', icon: '🏝️', name: '群岛霸主', test: (s) => s.passed >= 8 },
  { id: 'peaks', icon: '⛰️', name: '登顶加线山', test: (s) => s.passed >= 12 },
  { id: 'castle', icon: '🐉', name: '屠龙勇士', test: (s) => s.passed >= 13 },
  { id: 'speed30', icon: '⚡', name: '闪电手：60 秒 30 个', test: (s) => (s.best.speed || 0) >= 30 },
  { id: 'master10', icon: '🦅', name: '精通 10 个音', test: (s) => s.mastered >= 10 },
];
