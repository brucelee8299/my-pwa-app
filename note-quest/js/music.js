// 乐理模型：音符 ↔ 五线谱位置 ↔ 钢琴键 ↔ 唱名/简谱。纯函数，便于测试。
// 音符用科学音高记法表示，例如 'C4' = 中央C，'G4' = 高音谱号第二线的 G。

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const SOLFEGE = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];
export const JIANPU = ['1', '2', '3', '4', '5', '6', '7'];
// 七个音的颜色（彩虹色）：答对后才给音符上色，帮助形成"颜色记忆"
export const NOTE_COLORS = ['#F03E3E', '#F76707', '#F59F00', '#37B24D', '#1C7ED6', '#7048E8', '#D6336C'];
const SEMITONES = [0, 2, 4, 5, 7, 9, 11];

export const CLEFS = {
  treble: { name: '高音谱号', alias: 'G 谱号', staff: '高音谱表', bottom: 2, hand: '右手', icon: '𝄞' }, // 最下线 E4
  bass: { name: '低音谱号', alias: 'F 谱号', staff: '低音谱表', bottom: -10, hand: '左手', icon: '𝄢' }, // 最下线 G2
};

export function parseNote(id) {
  const m = /^([A-G])(\d)$/.exec(id);
  if (!m) throw new Error(`无效音符：${id}`);
  return { letter: LETTERS.indexOf(m[1]), octave: Number(m[2]) };
}
export const diatonic = (id) => { const { letter, octave } = parseNote(id); return octave * 7 + letter; };
export const noteFromDiatonic = (d) => `${LETTERS[((d % 7) + 7) % 7]}${Math.floor(d / 7)}`;
export const letterOf = (id) => id[0];
export const letterIndex = (id) => LETTERS.indexOf(id[0]);
/** 相对中央C的音级数（C4 = 0，D4 = 1，B3 = -1） */
export const stepOf = (id) => diatonic(id) - 28;
export const midiOf = (id) => { const { letter, octave } = parseNote(id); return 12 * (octave + 1) + SEMITONES[letter]; };
export const freqOf = (id) => 440 * 2 ** ((midiOf(id) - 69) / 12);
export function noteFromMidi(m) {
  const pc = ((m % 12) + 12) % 12;
  const i = SEMITONES.indexOf(pc);
  return i < 0 ? null : `${LETTERS[i]}${Math.floor(m / 12) - 1}`; // 黑键返回 null
}
/** 从 a 到 b 的所有自然音（含两端） */
export function noteRange(a, b) {
  const out = [];
  for (let d = diatonic(a); d <= diatonic(b); d++) out.push(noteFromDiatonic(d));
  return out;
}

export const solfegeOf = (id) => SOLFEGE[letterIndex(id)];
export const colorOf = (id) => NOTE_COLORS[letterIndex(id)];
/** 简谱（首调 C 大调 = 固定唱名）：数字 + 高低音点数，正数为上方加点 */
export function jianpuOf(id) {
  const { letter, octave } = parseNote(id);
  return { num: JIANPU[letter], dots: octave - 4 };
}
/** 中国教材常用的分组名：C4 = 小字一组 c¹ */
export function groupNameOf(id) {
  const { octave } = parseNote(id);
  const l = letterOf(id);
  const sup = ['', '¹', '²', '³', '⁴'];
  if (octave >= 4) return { name: `小字${'一二三四五'[octave - 4]}组`, mark: `${l.toLowerCase()}${sup[octave - 3]}` };
  if (octave === 3) return { name: '小字组', mark: l.toLowerCase() };
  if (octave === 2) return { name: '大字组', mark: l };
  return { name: `大字${'一二'[1 - octave] || ''}组`, mark: `${l}${['₂', '₁'][octave] || ''}` };
}

// ---------- 五线谱位置 ----------
/** 相对最下线的位置：0 = 第一线，1 = 第一间，8 = 第五线；负数在下方，>8 在上方 */
export const relOf = (clef, id) => stepOf(id) - CLEFS[clef].bottom;
export const isLine = (rel) => rel % 2 === 0;

const CN = ['一', '二', '三', '四', '五', '六'];
export function positionName(rel) {
  if (rel >= 0 && rel <= 8) return isLine(rel) ? `第${CN[rel / 2]}线` : `第${CN[(rel - 1) / 2]}间`;
  if (rel === -1) return '下一间';
  if (rel === 9) return '上一间';
  if (rel < 0) {
    const n = Math.floor(-rel / 2); // -2→1, -3→1, -4→2
    return isLine(rel) ? `下加${CN[n - 1]}线` : `下加${CN[n - 1]}间`;
  }
  const n = Math.floor((rel - 8) / 2); // 10→1, 11→1, 12→2
  return isLine(rel) ? `上加${CN[n - 1]}线` : `上加${CN[n - 1]}间`;
}
/** 需要画的加线（rel 值） */
export function ledgerRels(rel) {
  const out = [];
  for (let r = -2; r >= rel; r -= 2) out.push(r);
  for (let r = 10; r <= rel; r += 2) out.push(r);
  return out;
}

// ---------- 钢琴键位置 ----------
const KEY_SPOT = [
  '两个黑键的左边', '两个黑键的中间', '两个黑键的右边',
  '三个黑键的左边', '三个黑键里第 1、2 个的中间', '三个黑键里第 2、3 个的中间', '三个黑键的右边',
];
export function keyboardDesc(id) {
  const n = stepOf(id);
  const where = n === 0 ? '就是中央C' : `中央C${n > 0 ? '往右' : '往左'}数第 ${Math.abs(n)} 个白键`;
  return { spot: KEY_SPOT[letterIndex(id)], where };
}

// ---------- 地标音 ----------
// 先牢记几个"地标"，其他音从最近的地标往上/往下数，比从第一线一个个数快得多
export const LANDMARKS = {
  C2: '低音C：低音谱表的下加二线',
  C3: '低音谱表第二间的 C',
  F3: '低音谱号又叫 F 谱号，两个点夹住的第四线就是 F',
  C4: '中央C：两个谱表正中间，带一条短加线',
  G4: '高音谱号又叫 G 谱号，它的小圈绕着第二线，这条线就是 G',
  C5: '高音谱表第三间的 C',
  C6: '高音C：高音谱表的上加二线',
};
export const LANDMARK_RANGE = { treble: ['A3', 'C6'], bass: ['C2', 'E4'] };

export function nearestLandmark(clef, id) {
  const s = stepOf(id);
  const [lo, hi] = LANDMARK_RANGE[clef].map(stepOf);
  let best = null;
  for (const lm of Object.keys(LANDMARKS)) {
    const ls = stepOf(lm);
    if (ls < lo || ls > hi) continue;
    const d = Math.abs(ls - s);
    // 距离相同时优先谱号本身的地标（G 或 F）
    const pri = (clef === 'treble' && lm === 'G4') || (clef === 'bass' && lm === 'F3') ? -0.5 : 0;
    if (!best || d + pri < best.score) best = { id: lm, dist: ls - s, score: d + pri };
  }
  return best;
}

/** 认错时给出的"怎么数"提示 */
export function landmarkHint(clef, id) {
  const lm = nearestLandmark(clef, id);
  const pos = positionName(relOf(clef, lm.id));
  if (lm.dist === 0) return `${letterOf(id)} 本身就是地标音：${LANDMARKS[id]}`;
  const a = diatonic(lm.id);
  const b = diatonic(id);
  const dir = b > a ? 1 : -1;
  const path = [];
  for (let d = a; d !== b + dir; d += dir) path.push(LETTERS[((d % 7) + 7) % 7]);
  return `从地标 ${letterOf(lm.id)}（${pos}）往${dir > 0 ? '上' : '下'}数 ${Math.abs(b - a)} 格：${path.join(' → ')}`;
}

const MNEMONIC = {
  treble: { line: 'E G B D F', lineTip: '高音谱表五条线：E G B D F（Every Good Boy Does Fine 好孩子都很棒）', space: 'F A C E', spaceTip: '高音谱表四个间：F A C E，连起来就是英文单词 FACE（脸）' },
  bass: { line: 'G B D F A', lineTip: '低音谱表五条线：G B D F A（Good Boys Do Fine Always 好孩子总是很棒）', space: 'A C E G', spaceTip: '低音谱表四个间：A C E G（All Cows Eat Grass 奶牛都吃草）' },
};
export function mnemonicOf(clef, id) {
  const rel = relOf(clef, id);
  if (rel < 0 || rel > 8) return '';
  return isLine(rel) ? MNEMONIC[clef].lineTip : MNEMONIC[clef].spaceTip;
}

/** 一个音符的完整"音形意"信息 */
export function describe(clef, id) {
  const rel = relOf(clef, id);
  const jp = jianpuOf(id);
  return {
    id, clef, rel,
    letter: letterOf(id),
    solfege: solfegeOf(id),
    jianpu: jp,
    color: colorOf(id),
    group: groupNameOf(id),
    position: `${CLEFS[clef].staff}${positionName(rel)}`,
    key: keyboardDesc(id),
    hint: landmarkHint(clef, id),
    mnemonic: mnemonicOf(clef, id),
    landmark: LANDMARKS[id] && nearestLandmark(clef, id)?.id === id ? LANDMARKS[id] : '',
  };
}

export const cardKey = (clef, id) => `${clef}:${id}`;
export function splitKey(key) {
  const [clef, id] = key.split(':');
  return { clef, id };
}
