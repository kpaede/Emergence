// @vitest-environment jsdom
import {afterEach, describe, expect, it} from 'vitest';
import {DisclosureState, trackDisclosure} from '../src/ui/disclosure-state';
import {assignmentReadiness} from '../src/llm/assignment-readiness';
import {defaults, migrateSettings} from '../src/config';
import {graph, profile} from './fixtures';

afterEach(() => document.body.replaceChildren());
const panel = () => {const root = document.createElement('div'); document.body.append(root); return root;};
const details = (key: string, open = false, label = '') => {const box = document.createElement('details'); box.dataset.emDisclosure = key; box.open = open; const summary = document.createElement('summary'); summary.textContent = label; box.append(summary); return box;};
describe('analysis interactions survive updates', () => {
 it('preserves an opened diagnostics section before its delayed toggle event has fired', () => {
  const root = panel(), state = new DisclosureState();
  root.replaceChildren(details('analysis-diagnostics', false, 'Prüfen'));
  root.querySelector('summary')!.click(); expect(root.querySelector('details')!.open).toBe(true);
  state.capture(root);
  root.replaceChildren(details('analysis-diagnostics', false, 'Prüfen'));
  state.restore(root); expect(root.querySelector('details')!.open).toBe(true);
 });
 it('keeps both open and closed choices even when section counts change', () => {
  const root = panel(), state = new DisclosureState();
  root.replaceChildren(details('fields', true, '11 Felder'), details('scope'));
  state.capture(root);
  root.replaceChildren(details('fields', false, '10 Felder'), details('scope', true));
  state.restore(root); expect([...root.querySelectorAll('details')].map(d => d.open)).toEqual([true, false]);
 });
 it('ignores toggle events arriving from replaced controls', () => {
  const root = panel(), box = document.createElement('details'); root.append(box); let remembered = true;
  trackDisclosure(box, open => {remembered = open;}); box.remove(); box.open = false; box.dispatchEvent(new Event('toggle'));
  expect(remembered).toBe(true);
  root.append(box); box.dispatchEvent(new Event('toggle')); expect(remembered).toBe(false);
 });
 it('explains a missing frontmatter field instead of silently disabling all actions', () => {
  const issues = assignmentReadiness('Quelle.md', [], graph(), defaults(), profile());
  expect(issues.map(i => i.kind)).toEqual(['fields']); expect(issues[0]?.message).toContain('Frontmatter');
 });
 it('distinguishes missing field descriptions from a complete setup', () => {
  expect(assignmentReadiness('Quelle.md', ['Überbau'], graph(), defaults(), profile())).toEqual([]);
  expect(assignmentReadiness('Quelle.md', ['Reibung'], graph(), defaults(), profile())).toContainEqual(expect.objectContaining({kind: 'descriptions'}));
 });
 it('keeps the selected fields after settings serialization and migrates older settings', () => {
  const settings = defaults(); settings.assignment.fieldsByNote['Quelle.md'] = ['Überbau', 'Reibung'];
  expect(migrateSettings(JSON.parse(JSON.stringify(settings))).assignment.fieldsByNote['Quelle.md']).toEqual(['Überbau', 'Reibung']);
  const older = {...settings, assignment: {allFolders: true, allowNewTargets: true, propertyFilter: 'none', properties: []}};
  expect(migrateSettings(older).assignment.fieldsByNote).toEqual({});
 });
});
