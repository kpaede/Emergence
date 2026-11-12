import {t as tr} from '../i18n';
import {MarkdownView, type App, type Editor, type TFile} from 'obsidian';
import {MapMode, type ChangeDesc} from '@codemirror/state';
import {mermaidBlocks, relocateBlock, replaceBlock, type MermaidBlock} from './blocks';

export function noteEditor(app: App, path: string): Editor | undefined {
 for (const leaf of app.workspace.getLeavesOfType('markdown')) if (leaf.view instanceof MarkdownView && leaf.view.file?.path === path) return leaf.view.editor;
 return undefined;
}
export async function noteText(app: App, file: TFile): Promise<string> {return noteEditor(app, file.path)?.getValue() ?? await app.vault.read(file);}
const tracked = new WeakMap<App, Set<MermaidBinding>>();
export function notifyMermaidEditorChange(app: App, file: TFile, before: string, after: string, changes: ChangeDesc): void {
 for (const binding of tracked.get(app) ?? []) if (binding.file === file) binding.trackChange(before, after, changes);
}
export class MermaidBinding {
 private writing = false;
 private queue: Promise<void> = Promise.resolve();
 private stopped = false;
 private failure?: Error; private externalSource?: string;
 constructor(readonly app: App, readonly file: TFile, private note: string, private block: MermaidBlock, private language?: RegExp) {const bindings = tracked.get(app) ?? new Set<MermaidBinding>(); bindings.add(this); tracked.set(app, bindings);}
 get index(): number {return this.block.index;}
 get source(): string {return this.block.source;}
 get failed(): boolean {return this.stopped;}
 get pending(): Promise<void> {return this.queue.then(() => {if (this.failure) throw this.failure;});}
 dispose(): void {tracked.get(this.app)?.delete(this);}
 trackChange(before: string, after: string, changes: ChangeDesc): void {
  if (this.writing || this.stopped || before !== this.note) return;
  const from = changes.mapPos(this.block.from, 1, MapMode.TrackDel), to = changes.mapPos(this.block.to, -1, MapMode.TrackDel);
  const block = from === null || to === null ? undefined : mermaidBlocks(after, this.language).find(b => b.from === from && b.to === to);
  if (!block || before.slice(this.block.from, this.block.contentFrom) !== after.slice(block.from, block.contentFrom)) {
   this.stopped = true; this.failure = new Error(tr("mermaid.the_open_diagram_block_was_replaced_or_removed_your_draft_is")); return;
  }
  if (block.source !== this.block.source) this.externalSource = block.source;
  this.note = after; this.block = block;
 }
 async refresh(): Promise<string | undefined> {
  if (this.failure) throw this.failure; if (this.writing) return undefined;
  const next = await noteText(this.app, this.file);
  if (next === this.note) {const source = this.externalSource; this.externalSource = undefined; return source;}
  try {this.block = relocateBlock(this.note, next, this.block, this.language); this.note = next; this.externalSource = undefined; return this.block.source;}
  catch (error) {this.stopped = true; this.failure = error instanceof Error ? error : new Error(String(error)); throw this.failure;}
 }
 save(source: string): Promise<void> {
  const action = async (): Promise<void> => {
   if (this.stopped) throw new Error(tr("mermaid.the_connection_to_the_note_was_interrupted_open_the_block_again"));
   if (this.externalSource !== undefined && this.externalSource !== source.replace(/\n$/u, '')) throw new Error(tr("mermaid.the_diagram_was_changed_in_the_note_at_the_same_time"));
   const current = await noteText(this.app, this.file), block = relocateBlock(this.note, current, this.block, this.language);
   if (block.source !== this.block.source) throw new Error(tr("mermaid.the_diagram_was_changed_in_the_note_at_the_same_time_2"));
   const next = replaceBlock(current, block, source, this.language); this.writing = true;
   try {
    const editor = noteEditor(this.app, this.file.path);
    if (editor) {
     if (editor.getValue() !== current) throw new Error(tr("mermaid.the_note_changed_while_saving"));
     editor.replaceRange(next.slice(block.contentFrom, next.length - (current.length - block.contentTo)), editor.offsetToPos(block.contentFrom), editor.offsetToPos(block.contentTo), 'emergence-mermaid');
    } else await this.app.vault.process(this.file, latest => {if (latest !== current) throw new Error(tr("mermaid.the_note_changed_while_saving")); return next;});
    const updated = mermaidBlocks(next, this.language).find(b => b.from === block.from); if (!updated) throw new Error(tr("mermaid.the_diagram_block_could_not_be_matched_after_saving"));
    this.note = next; this.block = updated;
   } finally {this.writing = false;}
  };
  const job = this.queue.then(action); this.queue = job.catch((error: unknown) => {this.stopped = true; this.failure = error instanceof Error ? error : new Error(String(error));}); return job;
 }
}
