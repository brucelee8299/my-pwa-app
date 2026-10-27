// 五线谱 SVG 绘制。坐标：线距 10，一个音级 = 5；y 向下为正。
import { G_CLEF, F_CLEF } from './glyphs.js';
import { relOf, ledgerRels } from './music.js';

export const CLEF_W = 36;
const LAYOUTS = {
  treble: { bottom: { treble: 0 }, yMin: -88, yMax: 52, label: 44 },
  bass: { bottom: { bass: 0 }, yMin: -88, yMax: 52, label: 44 },
  grand: { bottom: { treble: 0, bass: 100 }, yMin: -88, yMax: 152, label: 146 },
};
export const layoutOf = (view) => LAYOUTS[view];
export const noteY = (view, clef, id) => LAYOUTS[view].bottom[clef] - relOf(clef, id) * 5;

function staffLines(bottom, width) {
  let s = '';
  for (let i = 0; i < 5; i++) s += `<line class="sl" x1="0" x2="${width}" y1="${bottom - i * 10}" y2="${bottom - i * 10}"/>`;
  return s;
}
function clefGlyph(clef, bottom) {
  const g = clef === 'treble' ? G_CLEF : F_CLEF;
  return `<path class="clef" transform="translate(${clef === 'treble' ? 2 : 1} ${bottom})" d="${g.d}"/>`;
}

/** 单个音符（符头 + 符干 + 加线），x 为符头中心 */
export function noteGroup(view, { clef, id, x = 0, cls = '', color = '', stem = true, attrs = '' }) {
  const bottom = LAYOUTS[view].bottom[clef];
  const rel = relOf(clef, id);
  const y = bottom - rel * 5;
  const fill = color ? ` style="fill:${color};stroke:${color}"` : '';
  const ledgers = ledgerRels(rel).map((r) => `<line class="ledger" x1="${x - 10}" x2="${x + 10}" y1="${bottom - r * 5}" y2="${bottom - r * 5}"/>`).join('');
  let st = '';
  if (stem) {
    st = rel >= 4
      ? `<line class="stem" x1="${x - 5.6}" x2="${x - 5.6}" y1="${y + 1}" y2="${y + 33}"${fill}/>`
      : `<line class="stem" x1="${x + 5.6}" x2="${x + 5.6}" y1="${y - 1}" y2="${y - 33}"${fill}/>`;
  }
  return `<g class="note ${cls}" data-key="${clef}:${id}" ${attrs}>${ledgers}${st}<ellipse class="head" cx="${x}" cy="${y}" rx="6.3" ry="4.6" transform="rotate(-20 ${x} ${y})"${fill}/></g>`;
}

/**
 * 画一张谱：view = treble / bass / grand；notes = [{ clef, id, x, cls, color }]
 * labels = [{ x, text, color }] 画在谱表下方
 */
export function staffSvg({ view, notes = [], width = 120, labels = [], cls = '', extra = '', aria = '五线谱' }) {
  const L = LAYOUTS[view];
  const clefs = Object.keys(L.bottom);
  let body = '';
  for (const c of clefs) body += staffLines(L.bottom[c], width) + clefGlyph(c, L.bottom[c]);
  if (view === 'grand') {
    body += `<line class="sl bar" x1="0.6" x2="0.6" y1="-40" y2="100"/><path class="brace" d="M-3 -40 Q-9 -20 -5 10 Q-3 25 -9 30 Q-3 35 -5 50 Q-9 80 -3 100"/>`;
  } else {
    body += `<line class="sl bar" x1="0.6" x2="0.6" y1="-40" y2="0"/>`;
  }
  body += `<line class="sl bar" x1="${width - 0.6}" x2="${width - 0.6}" y1="-40" y2="${view === 'grand' ? 100 : 0}"/>`;
  body += notes.map((n) => noteGroup(view, n)).join('');
  body += labels.map((l) => `<text class="nlabel" x="${l.x}" y="${L.label}" text-anchor="middle"${l.color ? ` style="fill:${l.color}"` : ''}>${l.text}</text>`).join('');
  const x0 = view === 'grand' ? -12 : -4;
  return `<svg class="staff ${cls}" viewBox="${x0} ${L.yMin} ${width - x0 + 2} ${L.yMax - L.yMin}" role="img" aria-label="${aria}" xmlns="http://www.w3.org/2000/svg">${body}${extra}</svg>`;
}

/** 根据点击位置的 y 坐标推算是哪个谱表、第几个位置（用于"摆音符"） */
export function relFromY(view, y) {
  const L = LAYOUTS[view];
  let best = null;
  for (const [clef, bottom] of Object.entries(L.bottom)) {
    const rel = Math.round((bottom - y) / 5);
    const dist = Math.abs(bottom - 20 - y);
    if (!best || dist < best.dist) best = { clef, rel, dist };
  }
  return { clef: best.clef, rel: best.rel };
}
