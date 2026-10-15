import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tasksForDate, isPerfectDay, bossState, weekPlan, weekStats, ticketsEarned, ticketBalance,
  starBalance, drawPrize, storyProgress, weekStart, addDays, weekdayIndex, titleFor, treeLeaves,
  pauseAt, weeklySegments,
} from '../js/logic.js';
import { holidayFor } from '../js/data.js';

const MON = '2026-10-05'; // 周一
const day = (i) => addDays(MON, i);

function makeState(tasks) {
  return {
    tasks, completions: {}, skips: {}, bossDefeats: {}, vault: [], reports: {},
    prizes: [], tierWeights: { common: 70, rare: 25, legendary: 5 }, tierColors: {},
    story: { bookId: 'oz', startWeek: MON, custom: { title: '', chapters: [] } }, seasons: [], settings: {},
  };
}
const check = (s, date, id, rating = 'full', minutes = null) => {
  s.completions[date] ??= {};
  s.completions[date][id] = { rating, minutes };
};
const ALL = [0, 1, 2, 3, 4, 5, 6];
const reading = { id: 'r', name: '阅读', subject: 'en', type: 'weekly', target: 4, days: ALL, minutes: 20 };
const calc = { id: 'c', name: '口算', subject: 'math', type: 'fixed', days: [0, 1, 2, 3, 4], minutes: 10 };

test('日期工具：周一为一周开始', () => {
  assert.equal(weekdayIndex(MON), 0);
  assert.equal(weekStart('2026-10-11'), MON);
  assert.equal(weekStart(MON), MON);
});

test('滑动窗口：漏做不显示欠债，只提示还差几次', () => {
  const s = makeState([reading]);
  const wed = tasksForDate(s, day(2)).find((x) => x.task.id === 'r');
  assert.equal(wed.remaining, 4); // 周一周二没做，周三仍只显示"还差 4 次"，不是"欠 2 篇"
  check(s, day(2), 'r');
  const wedAfter = tasksForDate(s, day(2)).find((x) => x.task.id === 'r');
  assert.equal(wedAfter.remaining, 3);
});

test('滑动窗口：本周做满后任务消失', () => {
  const s = makeState([reading]);
  [0, 1, 2, 3].forEach((i) => check(s, day(i), 'r'));
  assert.equal(tasksForDate(s, day(4)).length, 0);
  // 做完那天仍然能看到自己的打卡
  assert.equal(tasksForDate(s, day(3)).length, 1);
});

test('跳过今日：只有后面还有足够天数时才能顺延', () => {
  const s = makeState([reading]);
  assert.equal(tasksForDate(s, day(2))[0].canSkip, true); // 周三还差 4，周四到周日有 4 天
  assert.equal(tasksForDate(s, day(3))[0].canSkip, false); // 周四还差 4，后面只剩 3 天
  s.skips[day(2)] = { r: true };
  const x = tasksForDate(s, day(2))[0];
  assert.equal(x.status, 'skipped');
});

test('半颗星也算完成，❌ 不算', () => {
  const s = makeState([calc]);
  check(s, day(0), 'c', 'effort');
  assert.equal(isPerfectDay(s, day(0)), true);
  check(s, day(1), 'c', 'none');
  assert.equal(isPerfectDay(s, day(1)), false);
  assert.equal(starBalance(s), 0.5);
});

test('抽奖券：完美日 +1，打败 BOSS +2，抽奖消耗', () => {
  const s = makeState([calc]);
  check(s, day(0), 'c');
  check(s, day(1), 'c');
  s.bossDefeats[day(1)] = { loot: 'x' };
  assert.equal(ticketsEarned(s, day(6)), 4);
  s.vault.push({ cost: 10, redeemedAt: null });
  assert.equal(ticketBalance(s, day(6)), 3);
});

test('BOSS：标记任务优先，全部完成才能攻击', () => {
  const boss = { ...calc, id: 'b', name: '奥数', boss: true };
  const s = makeState([calc, boss]);
  let b = bossState(s, day(0));
  assert.equal(b.marked, true);
  assert.equal(b.targets.length, 1);
  assert.equal(b.canAttack, false);
  assert.equal(b.hp, 1);
  check(s, day(0), 'b');
  b = bossState(s, day(0));
  assert.equal(b.canAttack, true);
  assert.equal(b.hp, 0);
});

test('周视图：剩余次数排到今天及以后，过去没做的不显示', () => {
  const s = makeState([reading]);
  check(s, day(0), 'r');
  const plan = weekPlan(s, MON, day(3));
  assert.equal(plan[day(0)][0].kind, 'done');
  assert.equal(plan[day(1)].length, 0);
  assert.equal(plan[day(2)].length, 0);
  assert.deepEqual([3, 4, 5].map((i) => plan[day(i)][0]?.kind), ['planned', 'planned', 'planned']);
  assert.equal(plan[day(6)].length, 0);
});

test('周统计：完成率、星星分类、时长', () => {
  const s = makeState([calc, reading]);
  check(s, day(0), 'c', 'full', 12);
  check(s, day(1), 'c', 'quality', 8);
  check(s, day(2), 'c', 'none');
  check(s, day(0), 'r', 'effort', 20);
  const st = weekStats(s, MON);
  assert.equal(st.required, 5 + 4);
  assert.equal(st.done, 3);
  assert.equal(st.stars, 2);
  assert.deepEqual(st.counts, { full: 1, effort: 1, quality: 1, none: 1 });
  assert.equal(st.minutes, 40);
  assert.equal(treeLeaves(1), 20);
});

test('盲盒：按档位概率抽取', () => {
  const s = makeState([]);
  s.prizes = [
    { id: 'a', name: 'A', tier: 'common', cost: 10 },
    { id: 'b', name: 'B', tier: 'legendary', cost: 1500 },
  ];
  assert.equal(drawPrize(s, () => 0.1).id, 'a');
  assert.equal(drawPrize(s, () => 0.99).id, 'b');
  s.prizes = [];
  assert.equal(drawPrize(s), null);
});

test('剧情：每周解锁一章，完成率 80% 通关', () => {
  const s = makeState([calc]);
  [0, 1, 2, 3].forEach((i) => check(s, day(i), 'c'));
  const sp = storyProgress(s, addDays(MON, 8));
  assert.equal(sp.current, 1);
  assert.equal(sp.chapters[0].state, 'cleared');
  assert.equal(sp.chapters[1].state, 'current');
  assert.equal(sp.chapters[2].state, 'locked');
});

test('称号与节日', () => {
  assert.equal(titleFor(0).name, '冒险新手');
  assert.equal(titleFor(900).name, '传说冒险王');
  assert.equal(holidayFor('2026-10-03'), 'national');
  assert.equal(holidayFor('2026-09-25'), 'midautumn');
  assert.equal(holidayFor('2027-02-08'), 'spring');
  assert.equal(holidayFor('2026-02-14'), 'spring');
  assert.equal(holidayFor('2026-10-10'), null);
});

test('抽奖券获得后，新增任务不会收回', () => {
  const s = makeState([calc]);
  check(s, day(0), 'c');
  s.ticketDays = { [day(0)]: true };
  s.tasks.push({ ...calc, id: 'new', createdAt: day(0) });
  assert.equal(isPerfectDay(s, day(0)), false);
  assert.equal(ticketsEarned(s, day(6)), 1);
});

test('奖品库里"不要了"的奖品不退抽奖券、不扣星星', () => {
  const s = makeState([calc]);
  check(s, day(0), 'c');
  check(s, day(1), 'c');
  s.vault.push({ id: 'v1', cost: 10, redeemedAt: null });
  assert.equal(ticketBalance(s, day(6)), 1);
  s.vault[0].discardedAt = Date.now();
  assert.equal(ticketBalance(s, day(6)), 1);
  assert.equal(starBalance(s), 2);
});

test('暂停：暂停期间不显示、不影响完美日和完成率', () => {
  const s = makeState([calc, { ...reading, pauses: [{ from: day(1), to: null }] }]);
  check(s, day(1), 'c');
  assert.deepEqual(tasksForDate(s, day(1)).map((x) => x.task.id), ['c']);
  assert.equal(isPerfectDay(s, day(1)), true);
  assert.equal(pauseAt(s.tasks[1], day(5)).from, day(1));
  // 周一那段没做，被暂停打断：不算欠债
  const st = weekStats(s, MON);
  assert.equal(st.perTask.find((x) => x.task.id === 'r'), undefined);
});

test('暂停前做过的次数照常计入', () => {
  const s = makeState([{ ...reading, pauses: [{ from: day(2), to: null }] }]);
  check(s, day(0), 'r');
  const st = weekStats(s, MON);
  assert.equal(st.required, 1);
  assert.equal(st.done, 1);
  assert.equal(st.rate, 1);
});

test('自动恢复：周四恢复按剩余天数折算（4 次 → 3 次），且不计暂停前的次数', () => {
  const s = makeState([{ ...reading, pauses: [{ from: addDays(MON, -3), to: day(3) }] }]);
  assert.equal(tasksForDate(s, day(2)).length, 0); // 周三还在暂停
  const thu = tasksForDate(s, day(3))[0];
  assert.equal(thu.remaining, 3);
  assert.equal(thu.canSkip, true); // 剩 4 天要 3 次，可以顺延一天
  const plan = weekPlan(s, MON, day(3));
  assert.equal([3, 4, 5, 6].filter((i) => plan[day(i)].length).length, 3);
  assert.equal(weekStats(s, MON).required, 3);
});

test('周一恢复就是完整的新一周', () => {
  const s = makeState([{ ...reading, pauses: [{ from: addDays(MON, -10), to: MON }] }]);
  const segs = weeklySegments(s.tasks[0], MON);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].target, 4);
});

test('同一周内暂停又恢复：两段分开计次', () => {
  const s = makeState([{ ...reading, pauses: [{ from: day(2), to: day(4) }] }]);
  check(s, day(0), 'r');
  const segs = weeklySegments(s.tasks[0], MON);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].endedByPause, true);
  assert.equal(segs[1].target, 2); // 周五到周日 3 天：ceil(4×3/7) = 2
});

test('周中新建的每周任务也按剩余天数折算', () => {
  const s = makeState([{ ...reading, createdAt: day(6) }]);
  assert.equal(tasksForDate(s, day(6))[0].remaining, 1);
});

test('固定任务暂停后对应日子不出现', () => {
  const s = makeState([{ ...calc, pauses: [{ from: day(0), to: day(2) }] }]);
  const plan = weekPlan(s, MON, day(0));
  assert.equal(plan[day(0)].length + plan[day(1)].length, 0);
  assert.equal(plan[day(2)].length, 1);
  assert.equal(weekStats(s, MON).required, 3);
});
