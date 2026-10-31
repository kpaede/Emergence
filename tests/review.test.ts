import {describe, expect, it} from 'vitest';
import {ReviewManager} from '../src/review/manager';
import {validateSuggestion} from '../src/review/validator';
import {planFrontmatter, parseFrontmatter} from '../src/review/frontmatter';
import {content, edge, graph, profile, result, suggestion, writerFixture} from './fixtures';

describe('strict review state machine', () => {
 it('starts every suggestion pending even with an injected acceptance', async () => {
  const review = new ReviewManager(); review.set(await result({suggestions: [await suggestion({status: 'accepted'})]})); expect(review.analysis?.suggestions[0]?.status).toBe('pending'); expect(() => review.accepted()).toThrow('Ungeprüfte');
 });
 it('rejected suggestions cannot be written', async () => {const f = await writerFixture(); f.review.rejectPending(); await expect(f.writer.preview()).rejects.toThrow('Keine akzeptierten'); expect(f.stats().writes).toBe(0);});
 it('edits reset acceptance and undergo local validation', async () => {
  const f = await writerFixture(); f.accept(); f.review.edit('s1', {target: 'Fehlt.md', targetKind: 'existing', field: 'Überbau', property: 'Überbau', value: '[[Fehlt]]'});
  expect(f.review.analysis?.suggestions[0]?.status).toBe('pending'); expect(() => f.accept()).toThrow('Validierungsfehler');
 });
 it.each(['partial', 'cancelled'] as const)('blocks %s analyses', async status => {
  const f = await writerFixture(); f.review.set(await result({status})); expect(() => f.accept()).toThrow('Teilweise'); await expect(f.writer.preview()).rejects.toThrow();
 });
 it('cannot mutate internal review by editing returned objects', async () => {const f = await writerFixture(); f.review.analysis!.suggestions[0]!.status = 'accepted'; expect(() => f.review.accepted()).toThrow();});
});
describe('independent relation validation', () => {
 it('blocks identical direct relationships', async () => {const g = graph(); g.edges.push(edge('Quelle.md', 'Ziel.md')); expect(validateSuggestion(await suggestion(), g, content, profile()).some(i => i.message.includes('Identische'))).toBe(true);});
 it('warns rather than rejects an indirect transitive path', async () => {const g = graph(); g.edges.push(edge('Quelle.md', 'Alt.md'), edge('Alt.md', 'Ziel.md')); const issues = validateSuggestion(await suggestion(), g, content, profile()); expect(issues.some(i => i.level === 'block')).toBe(false); expect(issues[0]?.path).toEqual(['Quelle.md', 'Alt.md', 'Ziel.md']);});
 it('blocks a configured acyclic hierarchy cycle', async () => {const g = graph(); g.edges.push(edge('Ziel.md', 'Quelle.md')); expect(validateSuggestion(await suggestion(), g, content, profile()).some(i => i.message.includes('Zyklus'))).toBe(true);});
 it('does not impose hierarchy rules on unknown semantics', async () => {const g = graph(); expect(g.rules.Reibung?.hierarchical).toBe(false);});
 it('permits symmetric relation cycles when not declared acyclic', async () => {const g = graph(); g.rules['Überbau']!.acyclic = false; g.rules['Überbau']!.symmetric = true; g.edges.push(edge('Ziel.md', 'Quelle.md')); expect(validateSuggestion(await suggestion(), g, content, profile()).some(i => i.level === 'block')).toBe(false);});
 it('blocks missing IDs, unsafe keys, partial graph and invented evidence', async () => {
  for (const patch of [{target: 'Ziel'}, {property: '__proto__'}, {evidence: 'erfunden'}]) expect(validateSuggestion(await suggestion(patch), graph(), content, profile()).some(i => i.level === 'block')).toBe(true);
  const g = graph(); g.partial = true; expect(validateSuggestion(await suggestion(), g, content, profile()).some(i => i.level === 'block')).toBe(true);
 });
 it('distinguishes absent existing targets from intentional unresolved wikilinks', async () => {
  const g = graph(); expect(validateSuggestion(await suggestion({target: 'Ontologie.md'}), g, content, profile()).some(i => i.level === 'block')).toBe(true);
  const issues = validateSuggestion(await suggestion({target: 'Ontologie.md', targetKind: 'unresolved'}), g, content, profile()); expect(issues.some(i => i.level === 'block')).toBe(false); expect(issues.some(i => i.message.includes('Keine Datei'))).toBe(true);
 });
});
describe('writer requires two distinct approvals and current snapshots', () => {
 it('preview and first approval never write, final explicit confirmation does', async () => {
  const f = await writerFixture(); await expect(f.writer.preview()).rejects.toThrow('Ungeprüfte'); f.accept(); const preview = await f.writer.preview(); expect(f.stats().writes).toBe(0);
  await expect(f.writer.apply(preview.token, false)).rejects.toThrow('Bestätigung'); expect(f.stats().writes).toBe(0);
  await f.writer.apply(preview.token, true); expect(f.stats()).toEqual({writes: 1, refreshes: 1, saved: 1});
  expect(parseFrontmatter(f.files.get('Quelle.md')!).data).toMatchObject({title: 'Original', nested: {list: ['a', 'b']}, Überbau: ['[[Alt]]', '[[Ziel]]']});
  expect(f.files.get('Quelle.md')!.endsWith('Photosynthese ist ein Prozess der Pflanzenphysiologie.\n')).toBe(true);
  await expect(f.writer.apply(preview.token, true)).rejects.toThrow('Freigabe');
 });
 it('cannot write with a forged token', async () => {const f = await writerFixture(); await expect(f.writer.apply('forged', true)).rejects.toThrow(); expect(f.stats().writes).toBe(0);});
 it('closing/invalidation discards final approval', async () => {const f = await writerFixture(); f.accept(); const p = await f.writer.preview(); f.writer.invalidate(); await expect(f.writer.apply(p.token, true)).rejects.toThrow();});
 it.each(['Quelle.md', 'Ziel.md'])('changed %s invalidates the final confirmation', async path => {const f = await writerFixture(); f.accept(); const p = await f.writer.preview(); f.files.set(path, 'geändert'); await expect(f.writer.apply(p.token, true)).rejects.toThrow('verändert'); expect(f.stats().writes).toBe(0);});
 it('changed source since analysis requires a fresh review', async () => {const f = await writerFixture(); f.accept(); f.files.set('Quelle.md', 'geändert'); await expect(f.writer.preview()).rejects.toThrow('Analyse verändert');});
 it('changing write table or review after preview blocks apply', async () => {
  const f = await writerFixture(); f.accept(); const p = await f.writer.preview(); f.settings.rules.x = {...f.snapshot.rules['Überbau']!, label: 'x'};
  await expect(f.writer.apply(p.token, true)).rejects.toThrow('Konfiguration');
 });
 it('checks the source atomically inside vault.process', async () => {
  const f = await writerFixture(); f.accept(); const p = await f.writer.preview();
  f.io.process = async (_path, update) => update(content + 'Race');
  await expect(f.writer.apply(p.token, true)).rejects.toThrow('unmittelbar'); expect(f.stats().writes).toBe(0);
 });
 it('adds an intentional unresolved wikilink without creating a target file', async () => {
  const f = await writerFixture(); f.review.edit('s1', {target: 'Ontologie.md', targetKind: 'unresolved', field: 'Überbau', property: 'Überbau', value: '[[Ontologie]]'}); f.accept(); const p = await f.writer.preview();
  await f.writer.apply(p.token, true); expect(f.files.has('Ontologie.md')).toBe(false); expect(f.files.get('Quelle.md')).toContain('[[Ontologie]]');
 });
 it('blocks an unresolved target that becomes resolvable after preview', async () => {
  const f = await writerFixture(); f.review.edit('s1', {target: 'Ontologie.md', targetKind: 'unresolved', field: 'Überbau', property: 'Überbau', value: '[[Ontologie]]'}); f.accept(); const p = await f.writer.preview(); f.files.set('Ontologie.md', 'Neu');
  await expect(f.writer.apply(p.token, true)).rejects.toThrow('inzwischen'); expect(f.stats().writes).toBe(0);
 });
 it('rejects a misleading wiki value and resolves same basenames by qualified path', async () => {
  const f = await writerFixture(); f.review.edit('s1', {target: 'Ordner/Ziel.md', targetKind: 'existing', field: 'Überbau', property: 'Überbau', value: '[[Ziel]]'}); f.accept(); await expect(f.writer.preview()).rejects.toThrow('Wiki-Link');
  f.review.edit('s1', {target: 'Ordner/Ziel.md', targetKind: 'existing', field: 'Überbau', property: 'Überbau', value: '[[Ordner/Ziel]]'}); f.accept(); expect((await f.writer.preview()).after).toContain('[[Ordner/Ziel]]');
 });
 it('undo requires a new confirmation and refuses conflicts', async () => {
  const f = await writerFixture(); f.accept(); const p = await f.writer.preview(); await f.writer.apply(p.token, true); const id = f.writer.journal[0]!.id; const undo = await f.writer.undoPreview(id);
  await expect(f.writer.undo(id, undo.before, false)).rejects.toThrow(); await f.writer.undo(id, undo.before, true); expect(f.files.get('Quelle.md')).toBe(content); expect(f.writer.journal[0]?.status).toBe('undone');
 });
 it('records a post-write refresh failure and retains a confirmed undo plan', async () => {
  const f = await writerFixture(); f.accept(); const p = await f.writer.preview(); f.io.refresh = async () => {throw new Error('refresh failed');};
  await expect(f.writer.apply(p.token, true)).rejects.toThrow('Datei wurde geschrieben');
  expect(f.stats().writes).toBe(1); expect(f.writer.journal[0]?.status).toBe('refresh-failed');
  expect((await f.writer.undoPreview(f.writer.journal[0]!.id)).after).toBe(content);
 });
 it('invalidates a final preview if the graph acquires a conflicting cycle', async () => {
  const f = await writerFixture(); f.snapshot.rules['Überbau']!.allowSelf = false;
  // A changed graph must invalidate a previously granted final preview.
  f.accept(); const p = await f.writer.preview(); f.snapshot.edges.push(edge('Ziel.md', 'Quelle.md'));
  await expect(f.writer.apply(p.token, true)).rejects.toThrow('Konfiguration'); expect(f.stats().writes).toBe(0);
 });
});
describe('conservative YAML preservation', () => {
 it('fills an empty Breadcrumbs property without changing other properties or the note body', async () => {
  const text = '---\nÜberbau:\nAndere: [a, b]\n---\n# Ontologie\nText';
  const s = await suggestion({status: 'accepted', target: 'Philosophie.md', targetKind: 'unresolved', value: '[[Philosophie]]'});
  const plan = planFrontmatter(text, [s], () => '[[Philosophie]]', () => undefined);
  expect(parseFrontmatter(plan.after).data).toEqual({Überbau: ['[[Philosophie]]'], Andere: ['a', 'b']});
  expect(parseFrontmatter(plan.after).parts.body).toBe('# Ontologie\nText');
 });
 it('validates a title-based assignment with its editable field description and still requires both approvals', async () => {
  const f = await writerFixture(); f.snapshot.rules['Überbau']!.class = 'unknown';
  f.review.set(await result({suggestions: [await suggestion({contract: 'breadcrumbs-v2', evidenceSource: 'title', evidence: 'Quelle', target: 'Philosophie.md', targetKind: 'unresolved', value: '[[Philosophie]]', reason: ''})]}));
  await expect(f.writer.preview()).rejects.toThrow('Ungeprüfte'); f.accept(); const plan = await f.writer.preview();
  await expect(f.writer.apply(plan.token, false)).rejects.toThrow('Bestätigung'); expect(f.stats().writes).toBe(0);
  await f.writer.apply(plan.token, true); expect(f.files.has('Philosophie.md')).toBe(false); expect(f.files.get('Quelle.md')).toContain('[[Philosophie]]');
 });
 it.each(['---\nx: [broken\n---\nText', '---\nx: 1\nx: 2\n---\nText', '---\nx: &a [1]\ny: *a\n---\nText'])('rejects unsafe YAML %s', text => {expect(() => parseFrontmatter(text)).toThrow();});
 it('does not mutate unrelated complex properties and exposes all normalization', async () => {
  const s = await suggestion({status: 'accepted'}); const p = planFrontmatter(content, [s], () => '[[Ziel]]', v => v === '[[Ziel]]' ? 'Ziel.md' : undefined);
  expect(p.beforeFrontmatter).toContain('list: [a, b]'); expect(parseFrontmatter(p.after).data.nested).toEqual({list: ['a', 'b']}); expect(p.changes).toHaveLength(1);
 });
});
