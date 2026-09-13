import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, nextWeekday, thisWeekend, weekdayOf } from './calendar.js';

const today = '2026-08-25'; // Tuesday

test('reference today is a Tuesday', () => assert.equal(weekdayOf(today), 'Tuesday'));
test('tomorrow', () => assert.equal(addDays(today, 1), '2026-08-26'));
test('this weekend from a Tuesday', () => assert.deepEqual(thisWeekend(today), { from: '2026-08-29', to: '2026-08-30' }));
test('this weekend from a Saturday / Sunday', () => {
  assert.deepEqual(thisWeekend('2026-08-29'), { from: '2026-08-29', to: '2026-08-30' });
  assert.deepEqual(thisWeekend('2026-08-30'), { from: '2026-08-30', to: '2026-08-30' });
});
test('on Thursday / on Tuesday', () => {
  assert.equal(nextWeekday(today, 'Thursday'), '2026-08-27');
  assert.equal(nextWeekday(today, 'tuesday'), today);
  assert.equal(nextWeekday(today, 'Monday'), '2026-08-31');
});
test('month rollover', () => assert.equal(addDays('2026-08-31', 1), '2026-09-01'));
