// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {installDomHelpers} from './helpers/dom';
import {writerFixture, result, suggestion, edge} from './fixtures';
import {initialPanelState, type PanelContext} from '../src/ui/panel';
import type {EmergenceController} from '../src/controller';
import {renderIdeaFields} from '../src/ui/panels/idea-fields';
import {renderFieldIdeas} from '../src/ui/panels/field-ideas';
import {RelationsSynopsis} from '../src/ui/relations-synopsis';
import {parseFrontmatter} from '../src/review/frontmatter';
vi.mock('obsidian', async original => ({...await original<object>(), Modal: class {}}));

beforeEach(() => {
 installDomHelpers();
 vi.stubGlobal('ResizeObserver', class {observe(): void {} disconnect(): void {}});
 vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1); vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {for (const handle of document.querySelectorAll('.em-term-handle')) handle.dispatchEvent(new Event('dragend')); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals();});

function drag(node: Element, type: string, transfer = {setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '', dropEffect: ''}): Event {
 const event = new Event(type, {bubbles: true, cancelable: true}); Object.defineProperty(event, 'dataTransfer', {value: transfer}); node.dispatchEvent(event); return event;
}
async function ideasFixture() {
 const f = await writerFixture(); f.snapshot.nodes = f.snapshot.nodes.filter(n => n.id !== 'Ordner/Ziel.md');
 f.snapshot.rules.Reibung = {...f.snapshot.rules.Überbau!, label: 'Reibung', targetProperty: 'Reibung'};
 f.files.set('Quelle.md', f.files.get('Quelle.md')!.replace('Überbau:', 'Reibung:\nÜberbau:'));
 f.review.set(await result({associative: true, fields: ['Überbau', 'Reibung'], suggestions: [await suggestion({field: '', property: '', contract: 'breadcrumbs-v2', evidenceSource: 'title', evidence: 'Quelle'})]}));
 const host = document.createElement('div'); document.body.append(host);
 let work: Promise<unknown> = Promise.resolve();
 const applyIdea = vi.fn((id: string, field: string) => f.writer.applyIdea(id, field));
 const controller = {review: f.review, graph: {snapshot: f.snapshot}, profile: f.profile, writer: f.writer, activePath: 'Quelle.md', analysisFields: f.snapshot.fields,
  applyIdea, app: {}} as unknown as EmergenceController;
 const ctx: PanelContext = {host, controller, state: initialPanelState(), navigate: () => {}, repaint: () => {}, isCurrent: () => true, run: action => {
  work = Promise.resolve(action()); return work.then(() => {});
 }};
 renderIdeaFields(host, ctx); renderFieldIdeas(host, ctx);
 return {...f, host, ctx, controller, applyIdea, wait: () => work};
}

describe('unassigned terms and explicit field targets', () => {
 it('renders fields above a single pool and writes only after a real internal drag and drop', async () => {
  const f = await ideasFixture(), handle = f.host.querySelector('.em-term-handle')!, target = f.host.querySelector('[data-idea-field="Reibung"]')!;
  expect(f.host.querySelectorAll('.em-idea-group')).toHaveLength(0); expect(f.host.querySelectorAll('.em-idea-pool .em-idea-row')).toHaveLength(1);
  expect(f.stats().writes).toBe(0);
  expect(drag(target, 'drop').defaultPrevented).toBe(false); expect(f.applyIdea).not.toHaveBeenCalled();
  drag(handle, 'dragstart'); expect(drag(target, 'dragover').defaultPrevented).toBe(true); expect(target.classList.contains('em-term-drop-active')).toBe(true);
  drag(target, 'drop'); await f.wait(); drag(handle, 'dragend');
  expect(f.applyIdea).toHaveBeenCalledWith('s1', 'Reibung'); expect(parseFrontmatter(f.files.get('Quelle.md')!).data.Reibung).toEqual(['[[Ziel]]']);
 });
 it('supports selecting a term and then a field with buttons', async () => {
  const f = await ideasFixture(); f.host.querySelector<HTMLButtonElement>('.em-term-handle')!.click(); expect(f.ctx.state.analysis.selectedIdea).toBe('s1');
  f.host.empty(); renderIdeaFields(f.host, f.ctx); renderFieldIdeas(f.host, f.ctx);
  f.host.querySelector<HTMLButtonElement>('[data-idea-field="Überbau"]')!.click(); await f.wait();
  expect(f.applyIdea).toHaveBeenCalledWith('s1', 'Überbau'); expect(f.ctx.state.analysis.selectedIdea).toBeUndefined();
 });
 it('refuses a drop if the active note changes or the destination would duplicate a link', async () => {
  const f = await ideasFixture(), handle = f.host.querySelector('.em-term-handle')!, target = f.host.querySelector('[data-idea-field="Reibung"]')!;
  drag(handle, 'dragstart'); f.controller.activePath = 'Alt.md'; expect(drag(target, 'dragover').defaultPrevented).toBe(false); drag(target, 'drop');
  f.controller.activePath = 'Quelle.md'; f.snapshot.edges.push(edge('Quelle.md', 'Ziel.md', {field: 'Reibung'}));
  expect(drag(target, 'dragover').defaultPrevented).toBe(false); drag(target, 'drop'); drag(handle, 'dragend'); expect(f.stats().writes).toBe(0);
 });
});

describe('graph term editing', () => {
 it('retains SVG endpoints for wrapped direct terms in the lateral and lower groups', async () => {
  const f = await writerFixture(); f.snapshot.fields.push('Ähnlichkeit', 'Unterbau');
  f.snapshot.edges = [edge('Quelle.md', 'Ziel.md', {field: 'Ähnlichkeit'}), edge('Quelle.md', 'Alt.md', {field: 'Unterbau'})];
  const host = document.createElement('div'); document.body.append(host);
  const synopsis = new RelationsSynopsis(host, () => f.settings, () => {}, {activate: () => {}, inspect: () => {}}, () => {}, undefined, {ready: () => true, move: () => {}});
  synopsis.render(f.snapshot, 'Quelle.md');
  const diagram = host.querySelector<HTMLElement>('.em-syn-diagram')!;
  Object.defineProperty(diagram, 'clientWidth', {configurable: true, value: 280});
  Object.defineProperty(Range.prototype, 'getClientRects', {configurable: true, value: () => [new DOMRect(10, 20, 40, 14)]});
  synopsis.geometry!.draw();
  expect(synopsis.geometry!.last.endpoints).toEqual(expect.arrayContaining([expect.objectContaining({kind: 'similar', note: 'Ziel.md'}), expect.objectContaining({kind: 'narrower', note: 'Alt.md'})]));
  synopsis.destroy();
 });
 it('leaves ordinary links navigable while dragging only the handle', async () => {
  const f = await writerFixture(); f.snapshot.edges = [edge('Quelle.md', 'Alt.md')];
  f.snapshot.fields.push('Unterbau', 'Ähnlichkeit', 'Beispiel');
  const host = document.createElement('div'); document.body.append(host); const move = vi.fn(), add = vi.fn(), activate = vi.fn();
  const synopsis = new RelationsSynopsis(host, () => f.settings, () => {}, {activate, inspect: () => {}}, add, undefined, {ready: () => true, move});
  synopsis.render(f.snapshot, 'Quelle.md');
  const plus = host.querySelector('[data-syn-add="broader"]')!; expect(plus.parentElement?.classList.contains('em-syn-title')).toBe(true);
  const link = host.querySelector<HTMLAnchorElement>('.em-syn-broader a')!, term = link.parentElement!;
  expect(term.querySelector('.em-term-handle')).toBeTruthy(); expect(link.draggable).toBe(false); link.click(); expect(activate).toHaveBeenCalledOnce();
  expect(host.querySelector('.em-syn-term-add')).toBeNull();
  for (const relation of ['broader', 'narrower', 'similar', 'friction', 'examples']) host.querySelector<HTMLButtonElement>(`[data-syn-add="${relation}"]`)!.click();
  expect(add.mock.calls).toEqual(['broader', 'narrower', 'similar', 'friction', 'examples'].map(relation => [relation, 'Quelle.md']));
  expect(host.querySelector('a[title], a[aria-label], .em-term-handle[title], .em-term-handle[aria-label], .em-syn-title button[aria-label]')).toBeNull();
  const handleLabel = term.querySelector('.em-term-handle')!.getAttribute('aria-labelledby')!;
  expect(document.getElementById(handleLabel)?.textContent).toContain('Begriff verschieben: Alt');
  const handle = term.querySelector('.em-term-handle')!, destination = host.querySelector('.em-syn-friction')!;
  expect(destination.querySelectorAll('a')).toHaveLength(0); drag(handle, 'dragstart'); expect(drag(destination, 'dragover').defaultPrevented).toBe(true); drag(destination, 'drop'); drag(handle, 'dragend');
  expect(move).toHaveBeenCalledWith('Quelle.md', 'Quelle.md', 'Alt.md', ['Überbau'], 'Reibung'); synopsis.destroy();
 });
});
