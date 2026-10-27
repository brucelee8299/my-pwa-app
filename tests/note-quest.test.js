import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stepOf, midiOf, freqOf, noteFromMidi, relOf, positionName, ledgerRels, jianpuOf, groupNameOf,
  keyboardDesc, nearestLandmark, landmarkHint, mnemonicOf, noteRange, describe,
} from '../note-quest/js/music.js';
import { STAGES, ALL_CARDS, LEVELS, WORDS, poolUpTo } from '../note-quest/js/curriculum.js';
import {
  newCard, recordAnswer, cardStats, masteryOf, pickNext, currentStage, bossReady, bossStars,
  evaluateLevel, streakOf, dailyPlan, addDays, dueCards,
} from '../note-quest/js/srs.js';
import { relFromY, noteY, staffSvg } from '../note-quest/js/staff.js';
import { createDefaultState } from '../note-quest/js/store.js';

const DAY = '2026-10-27';

test('音高：中央C、A4 = 440Hz、黑键', () => {
  assert.equal(stepOf('C4'), 0);
  assert.equal(stepOf('B3'), -1);
  assert.equal(midiOf('C4'), 60);
  assert.equal(Math.round(freqOf('A4')), 440);
  assert.equal(noteFromMidi(67), 'G4');
  assert.equal(noteFromMidi(61), null); // C#4 是黑键
  assert.deepEqual(noteRange('A3', 'D4'), ['A3', 'B3', 'C4', 'D4']);
});

test('五线谱位置：高音谱表与低音谱表', () => {
  // 高音谱表：线 E G B D F，间 F A C E
  assert.deepEqual(['E4', 'G4', 'B4', 'D5', 'F5'].map((n) => relOf('treble', n)), [0, 2, 4, 6, 8]);
  assert.deepEqual(['F4', 'A4', 'C5', 'E5'].map((n) => positionName(relOf('treble', n))), ['第一间', '第二间', '第三间', '第四间']);
  // 低音谱表：线 G B D F A
  assert.deepEqual(['G2', 'B2', 'D3', 'F3', 'A3'].map((n) => positionName(relOf('bass', n))), ['第一线', '第二线', '第三线', '第四线', '第五线']);
  assert.equal(positionName(relOf('treble', 'C4')), '下加一线');
  assert.equal(positionName(relOf('treble', 'D4')), '下一间');
  assert.equal(positionName(relOf('treble', 'B3')), '下加一间');
  assert.equal(positionName(relOf('treble', 'A3')), '下加二线');
  assert.equal(positionName(relOf('treble', 'G5')), '上一间');
  assert.equal(positionName(relOf('treble', 'A5')), '上加一线');
  assert.equal(positionName(relOf('treble', 'C6')), '上加二线');
  assert.equal(positionName(relOf('bass', 'C4')), '上加一线');
  assert.equal(positionName(relOf('bass', 'C2')), '下加二线');
});

test('加线数量', () => {
  assert.deepEqual(ledgerRels(relOf('treble', 'C4')), [-2]);
  assert.deepEqual(ledgerRels(relOf('treble', 'B3')), [-2]);
  assert.deepEqual(ledgerRels(relOf('treble', 'A3')), [-2, -4]);
  assert.deepEqual(ledgerRels(relOf('treble', 'B5')), [10]);
  assert.deepEqual(ledgerRels(relOf('treble', 'E5')), []);
});

test('简谱与分组名', () => {
  assert.deepEqual(jianpuOf('G4'), { num: '5', dots: 0 });
  assert.deepEqual(jianpuOf('C5'), { num: '1', dots: 1 });
  assert.deepEqual(jianpuOf('A3'), { num: '6', dots: -1 });
  assert.deepEqual(groupNameOf('C4'), { name: '小字一组', mark: 'c¹' });
  assert.deepEqual(groupNameOf('A3'), { name: '小字组', mark: 'a' });
  assert.deepEqual(groupNameOf('G2'), { name: '大字组', mark: 'G' });
});

test('键盘位置描述', () => {
  assert.equal(keyboardDesc('C4').where, '就是中央C');
  assert.equal(keyboardDesc('G4').where, '中央C往右数第 4 个白键');
  assert.equal(keyboardDesc('A3').where, '中央C往左数第 2 个白键');
  assert.equal(keyboardDesc('F3').spot, '三个黑键的左边');
});

test('地标提示：从最近的地标数过去', () => {
  assert.equal(nearestLandmark('treble', 'A4').id, 'G4');
  assert.equal(nearestLandmark('bass', 'E3').id, 'F3');
  assert.equal(landmarkHint('treble', 'B4'), '从地标 C（第三间）往下数 1 格：C → B');
  assert.equal(landmarkHint('treble', 'E4'), '从地标 G（第二线）往下数 2 格：G → F → E');
  assert.match(landmarkHint('treble', 'G4'), /本身就是地标音/);
  assert.match(mnemonicOf('treble', 'A4'), /FACE/);
  assert.equal(mnemonicOf('treble', 'C4'), '');
  const d = describe('bass', 'F3');
  assert.equal(d.position, '低音谱表第四线');
  assert.match(d.landmark, /F 谱号/);
});

test('课程：卡片不重复，覆盖 C2–C6', () => {
  assert.equal(new Set(ALL_CARDS).size, ALL_CARDS.length);
  assert.equal(ALL_CARDS.length, 34);
  assert.deepEqual(poolUpTo(1), ['treble:C4', 'treble:D4', 'treble:E4', 'treble:F4', 'treble:G4']);
  assert.equal(STAGES.at(-1).notes.length, 0); // 总决战不加新音
  assert.equal(LEVELS.at(-1).stages, STAGES.length);
  for (const w of WORDS) assert.match(w.w, /^[A-G]+$/);
});

test('记忆盒子：答对且快才升级，一天只升一次；答错降两级', () => {
  const c = newCard(DAY);
  recordAnswer(c, true, 1200, DAY);
  assert.equal(c.box, 1);
  assert.equal(c.due, addDays(DAY, 1));
  recordAnswer(c, true, 900, DAY); // 同一天再答对：只是练习
  assert.equal(c.box, 1);
  const d2 = addDays(DAY, 1);
  recordAnswer(c, true, 4000, d2); // 答对但太慢：不升级
  assert.equal(c.box, 1);
  const d3 = addDays(d2, 1);
  recordAnswer(c, true, 1000, d3);
  assert.equal(c.box, 2);
  c.box = 5;
  recordAnswer(c, false, 0, addDays(d3, 30));
  assert.equal(c.box, 3);
  assert.equal(c.due, addDays(d3, 30));
  recordAnswer(c, true, 800, addDays(d3, 30)); // 答错当天不再升级
  assert.equal(c.box, 3);
});

test('卡片统计与掌握度', () => {
  const c = newCard(DAY);
  for (const ms of [1000, 1200, 1400]) c.r.push(ms);
  c.r.push(-1);
  const st = cardStats(c);
  assert.equal(st.acc, 0.75);
  assert.equal(st.ms, 1200);
  assert.equal(masteryOf(c), 1);
  c.box = 5;
  c.r = Array(10).fill(1000);
  assert.equal(masteryOf(c), 4);
  c.r.push(-1); c.r.push(-1);
  assert.equal(masteryOf(c), 3); // 最近正确率掉到 90% 以下就不算精通
  assert.ok(c.r.length <= 12);
});

test('出题：不会连续出同一个音，偏向薄弱的音', () => {
  const pool = ['treble:C4', 'treble:D4', 'treble:E4'];
  const cards = { 'treble:C4': { ...newCard(DAY), box: 6, due: '2099-01-01' }, 'treble:D4': { ...newCard(DAY), box: 6, due: '2099-01-01' }, 'treble:E4': newCard(DAY) };
  let e = 0;
  for (let i = 0; i < 400; i++) {
    const k = pickNext(pool, cards, { today: DAY, recent: ['treble:C4'] });
    assert.notEqual(k, 'treble:C4');
    if (k === 'treble:E4') e++;
  }
  assert.ok(e > 300, `新卡应占多数，实际 ${e}`);
});

test('关卡与 BOSS', () => {
  const s = createDefaultState();
  assert.equal(currentStage(s), 0);
  assert.equal(bossReady(s, 0), false);
  for (const k of STAGES[0].notes) s.cards[k] = { ...newCard(DAY), ok: 3 };
  assert.equal(bossReady(s, 0), true);
  s.stages.T1 = { stars: 1 };
  assert.equal(currentStage(s), 1);
  assert.equal(bossStars({ total: 20, wrong: 3, avgMs: 900 }), 0);
  assert.equal(bossStars({ total: 22, wrong: 2, avgMs: 3200 }), 1);
  assert.equal(bossStars({ total: 21, wrong: 1, avgMs: 2000 }), 2);
  assert.equal(bossStars({ total: 20, wrong: 0, avgMs: 1400 }), 3);
});

test('水平评估：要求过关 + 覆盖 + 正确率 + 速度', () => {
  const s = createDefaultState();
  const L1 = LEVELS[0];
  assert.equal(evaluateLevel(s, L1).pass, false);
  for (const st of STAGES.slice(0, 4)) s.stages[st.id] = { stars: 1 };
  for (const k of poolUpTo(3)) s.cards[k] = { ...newCard(DAY), r: [2000, 2500, 3000, 2200] };
  assert.equal(evaluateLevel(s, L1).pass, true);
  s.cards['bass:F3'].r = [-1, -1, 2000, -1];
  const ev = evaluateLevel(s, L1);
  assert.equal(ev.pass, false);
  assert.deepEqual(ev.weak, ['bass:F3']);
});

test('连续打卡', () => {
  const s = createDefaultState();
  s.days[addDays(DAY, -2)] = { ms: 0, done: true };
  s.days[addDays(DAY, -1)] = { ms: 6 * 60000 };
  assert.equal(streakOf(s, DAY), 2); // 今天还没练，不打断
  s.days[DAY] = { ms: 60000 };
  assert.equal(streakOf(s, DAY), 2);
  s.days[DAY].done = true;
  assert.equal(streakOf(s, DAY), 3);
});

test('每日计划：新手先学新音再打 BOSS；复习不好就不学新音', () => {
  const s = createDefaultState();
  let plan = dailyPlan(s, DAY);
  assert.deepEqual(plan.map((p) => p.type), ['learn', 'boss']);
  assert.deepEqual(plan[0].notes, STAGES[0].notes);
  // 学过第一关但正确率很差：先复习、弱项特训，不学新音
  for (const k of STAGES[0].notes) s.cards[k] = { ...newCard(DAY), ok: 3, r: [-1, -1, -1] };
  s.stages.T1 = { stars: 1 };
  plan = dailyPlan(s, addDays(DAY, 1));
  assert.deepEqual(plan.map((p) => p.type), ['review', 'weak', 'game']);
  assert.equal(dueCards(s, addDays(DAY, 1)).length, 3);
  // 正确率恢复：学第二关新音
  for (const k of STAGES[0].notes) s.cards[k].r = [1000, 1000, 1000];
  plan = dailyPlan(s, addDays(DAY, 1));
  assert.deepEqual(plan.map((p) => p.type), ['review', 'learn', 'boss']);
  assert.equal(plan.reduce((a, p) => a + (p.seconds || 0), 0), 330);
});

test('五线谱绘制与点击定位', () => {
  assert.equal(noteY('treble', 'treble', 'E4'), 0);
  assert.equal(noteY('grand', 'bass', 'G2'), 100);
  assert.deepEqual(relFromY('grand', noteY('grand', 'bass', 'F3')), { clef: 'bass', rel: 6 });
  assert.deepEqual(relFromY('grand', noteY('grand', 'treble', 'C5')), { clef: 'treble', rel: 5 });
  const svg = staffSvg({ view: 'treble', notes: [{ clef: 'treble', id: 'A3', x: 70 }] });
  assert.equal((svg.match(/class="ledger"/g) || []).length, 2);
});
