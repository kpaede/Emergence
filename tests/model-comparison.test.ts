import {describe, expect, it} from 'vitest';
import {comparisonCases, scoreAssignments} from './model-comparison-fixture';
import {result, suggestion} from './fixtures';

const musical = () => comparisonCases().find(c => c.id === 'musical-sparse')!;
describe('model qualification scoring', () => {
 it('requires a useful positive result; rejecting everything is not success', async () => {
  expect(scoreAssignments(await result({suggestions: []}), musical()).passed).toBe(false);
  expect(scoreAssignments(await result({suggestions: [await suggestion({field: 'Überbau', target: 'Oper.md'})]}), musical()).passed).toBe(true);
 });
 it('does not let one correct parent conceal a wrong child direction', async () => {
  const scored = scoreAssignments(await result({suggestions: [await suggestion({field: 'Überbau', target: 'Oper.md'}), await suggestion({field: 'Unterbau', target: 'Belcanto.md'})]}), musical());
  expect(scored.requiredFound).toBe(true); expect(scored.passed).toBe(false); expect(scored.forbidden).toHaveLength(1);
 });
 it('does not count unreviewed extra claims as proven correct', async () => {
  const scored = scoreAssignments(await result({suggestions: [await suggestion({field: 'Überbau', target: 'Oper.md'}), await suggestion({field: 'Überbau', target: 'Ungeprüfte Behauptung.md'})]}), musical());
  expect(scored.forbidden).toEqual([]); expect(scored.additionalUnscored).toHaveLength(1); expect(scored.passed).toBe(false);
 });
});
