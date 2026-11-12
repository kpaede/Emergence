import {describe, expect, it} from 'vitest';
import {MermaidLibrary} from '../src/mermaid/library';
import {noteLinkName} from '../src/mermaid/links';

describe('Personal Mermaid library', () => {
 it('starts with all 58 Pele examples and filters damaged persisted entries', () => {
  const library = new MermaidLibrary({hidden: ['pele-0', 'missing', 'pele-0'], custom: [null, {id: 'custom-one', name: ' Test ', source: 'flowchart TD\nA'}, {id: 'custom-one', name: 'Duplicate', source: 'flowchart TD\nB'}]}, async () => {});
  expect(library.list()).toHaveLength(60); expect(library.snapshot().hidden).toEqual(['pele-0']); expect(library.list()[0]?.name).toBe('Test');
 });
 it('persists only hidden preset IDs and custom diagrams, not all shipped examples', async () => {
  let saved: unknown; const library = new MermaidLibrary(undefined, async () => {saved = library.snapshot();});
  const preset = library.list()[0]!; await library.remove(preset.id); await library.add('My diagram', 'flowchart LR\n A --> B');
  expect(saved).toEqual({favorites: ['starter-mindmap'], hidden: [preset.id], custom: [expect.objectContaining({name: 'My diagram', source: 'flowchart LR\n A --> B'})]});
  expect(new MermaidLibrary(saved, async () => {}).list()).toEqual(library.list());
 });
 it('restores a deleted custom diagram including its source', async () => {
  const library = new MermaidLibrary(undefined, async () => {}); await library.add('Custom', 'mindmap\nroot'); const item = library.list()[0]!;
  await library.remove(item.id); expect(library.list().some(e => e.id === item.id)).toBe(false); await library.undo(); expect(library.list()[0]).toEqual(item); expect(library.canUndo).toBe(false);
 });
 it('rolls back failed writes and can continue after the error', async () => {
  let fail = true; const library = new MermaidLibrary(undefined, async () => {if (fail) throw new Error('Disk error');});
  const before = library.snapshot(); await expect(library.add('Test', 'flowchart TD\nA')).rejects.toThrow('Disk error'); expect(library.snapshot()).toEqual(before);
  fail = false; await library.add('Success', 'flowchart TD\nB'); expect(library.list()[0]?.name).toBe('Success');
 });
 it('serializes concurrent add, delete and rename operations', async () => {
  const snapshots: unknown[] = [], library = new MermaidLibrary(undefined, async () => {snapshots.push(library.snapshot()); await Promise.resolve();});
  const preset = library.list()[0]!; await Promise.all([library.add('One', 'flowchart TD\nA'), library.add('Two', 'flowchart TD\nB'), library.remove(preset.id)]);
  expect(library.list().slice(0, 2).map(e => e.name)).toEqual(['One', 'Two']); expect(library.list()).toHaveLength(61); expect(snapshots).toHaveLength(3);
  const id = library.list()[0]!.id; await library.rename(id, 'Renamed'); expect(library.list()[0]?.name).toBe('Renamed');
 });
 it('does not expose mutable library state', async () => {
  const library = new MermaidLibrary(undefined, async () => {}); await library.add('Mine', 'flowchart TD\nA');
  library.list()[0]!.source = 'changed'; library.snapshot().custom[0]!.name = 'changed'; expect(library.list()[0]).toMatchObject({name: 'Mine', source: 'flowchart TD\nA'});
 });
 it('migrates favorites without restoring explicitly cleared choices', async () => {
  const migrated = new MermaidLibrary({hidden: [], custom: []}, async () => {});
  expect(migrated.snapshot().favorites).toEqual(['starter-flowchart', 'starter-mindmap']);
  await migrated.favorite('starter-flowchart'); await migrated.favorite('starter-mindmap');
  expect(new MermaidLibrary(migrated.snapshot(), async () => {}).snapshot().favorites).toEqual([]);
 });
 it('restores favorite status on delete undo and rolls back failed favorite writes', async () => {
  let fail = false; const library = new MermaidLibrary(undefined, async () => {if (fail) throw new Error('Disk error');});
  await library.remove('starter-flowchart'); expect(library.isFavorite('starter-flowchart')).toBe(false);
  await library.undo(); expect(library.isFavorite('starter-flowchart')).toBe(true);
  await library.add('Mine', 'flowchart TD\nA'); const item = library.list()[0]!; await library.favorite(item.id);
  await library.rename(item.id, 'Renamed'); expect(library.isFavorite(item.id)).toBe(true);
  fail = true; await expect(library.favorite(item.id)).rejects.toThrow('Disk error'); expect(library.isFavorite(item.id)).toBe(true);
 });
 it('rejects damaged favorite references', () => {const library = new MermaidLibrary({hidden: ['starter-flowchart'], custom: [null, {id: 'custom-broken'}], favorites: ['custom-broken', 'missing', 'starter-flowchart', 'starter-mindmap', 'starter-mindmap']}, async () => {}); expect(library.snapshot().favorites).toEqual(['starter-mindmap']);});
 it('rejects empty names and diagrams', async () => {const library = new MermaidLibrary(undefined, async () => {}); await expect(library.add(' ', 'flowchart TD')).rejects.toThrow(); await expect(library.add('Name', ' ')).rejects.toThrow();});
});
describe('Native note link targets', () => {
 it('accepts a full Wiki-Link but uses its target as the native node label', () => {expect(noteLinkName(' [[Ordner/Notiz#Abschnitt|Alias]] ')).toBe('Ordner/Notiz#Abschnitt'); expect(noteLinkName(' Notiz ')).toBe('Notiz');});
});
