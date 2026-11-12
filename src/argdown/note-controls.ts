import {localizedCommand} from '../i18n/commands';
import {t as tr} from '../i18n';
import {Component, MarkdownRenderChild, editorInfoField, type Plugin, type TFile} from 'obsidian';
import {ViewPlugin, type EditorView} from '@codemirror/view';
import {DiagramControls,trackDiagramControls} from '../mermaid/note-controls';
import {noteText} from '../mermaid/binding';
import {argdownBlocks} from './blocks';
import {ArgdownDiagram} from './diagram';

type OpenArgdown = (file: TFile, index: number) => Promise<void>;
export function registerArgdown(plugin: Plugin, open: OpenArgdown, report: (error: unknown) => void,enabled:()=>boolean=()=>true): void {
 const app = plugin.app;
 for (const language of ['argdown', 'argdown-map']) plugin.registerMarkdownCodeBlockProcessor(language, (source, el, ctx) => {
  class ArgdownBlock extends MarkdownRenderChild {
   private alive = true;
   onload(): void {
    const preview = el.createDiv({cls: 'em-argdown-note em-ad-preview', attr: {'aria-label': tr("argdown.argdown_argument_map")}}), diagram = new ArgdownDiagram(preview);
    const resize = new ResizeObserver(() => diagram.resize()); resize.observe(preview); this.register(() => resize.disconnect());
    void import('./engine').then(async ({ArgdownEngine}) => {const engine = new ArgdownEngine(), model = engine.project(source), svg = await engine.svg(model); if (this.alive) diagram.set(svg, model);}).catch((error: unknown) => {if (this.alive) preview.setText(String(error));});
    this.addChild(trackDiagramControls(plugin,new DiagramControls(el, async root => {
     const file = app.vault.getFileByPath(ctx.sourcePath); if (!file) throw new Error(tr("argdown.the_source_file_no_longer_exists"));
     const section = ctx.getSectionInfo(root) ?? ctx.getSectionInfo(el); if (!section) throw new Error(tr("argdown.use_the_command_at_the_cursor"));
     const candidates = argdownBlocks(await noteText(app, file)).filter(block => block.line >= section.lineStart && block.line <= section.lineEnd);
     if (candidates.length !== 1) throw new Error(tr("argdown.the_argdown_map_cannot_be_uniquely_matched_use_the_command_at")); await open(file, candidates[0]!.index);
    }, report, '.em-argdown-note', ()=>tr("argdown.edit_in_argdown"),enabled)));
   }
   onunload(): void {this.alive = false;}
  }
  ctx.addChild(new ArgdownBlock(el));
 });
 plugin.registerEditorExtension(ViewPlugin.fromClass(class {
  private controls: Component;
  constructor(view: EditorView) {
   this.controls = trackDiagramControls(plugin,new DiagramControls(view.dom, async root => {
    const file = view.state.field(editorInfoField, false)?.file; if (!file) throw new Error(tr("argdown.no_note_is_open"));
    const position = view.posAtDOM(root), block = argdownBlocks(view.state.doc.toString()).find(b => position >= b.from && position <= b.to);
    if (!block) throw new Error(tr("argdown.place_the_cursor_inside_the_argdown_block_and_use_the_edit")); await open(file, block.index);
   }, report, '.em-argdown-note', ()=>tr("argdown.edit_in_argdown"),enabled)); this.controls.load();
  }
  destroy(): void {this.controls.unload();}
 }));
 localizedCommand(plugin,"argdown.edit_argdown_map_at_cursor",{id: 'edit-argdown-at-cursor', editorCheckCallback: (checking, editor, info) => {
  if (!enabled()||!info.file) return false; const position = editor.posToOffset(editor.getCursor()), block = argdownBlocks(editor.getValue()).find(b => position >= b.from && position <= b.to); if (!block) return false;
  if (!checking) void open(info.file, block.index).catch(report); return true;
 }});
 plugin.registerEvent(app.workspace.on('editor-menu', (menu, editor, info) => {
  if (!enabled()||!info.file) return; const file = info.file, position = editor.posToOffset(editor.getCursor()), block = argdownBlocks(editor.getValue()).find(b => position >= b.from && position <= b.to);
  if (block) menu.addItem(item => item.setTitle(tr("argdown.edit_in_argdown")).setIcon('pencil').onClick(() => {void open(file, block.index).catch(report);}));
 }));
}
