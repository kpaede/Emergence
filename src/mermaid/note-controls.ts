import {localizedCommand} from '../i18n/commands';
import {t as tr} from '../i18n';
import {Component, MarkdownRenderChild, editorInfoField, setIcon, type App, type Plugin, type TFile} from 'obsidian';
import {ViewPlugin, type EditorView, type ViewUpdate} from '@codemirror/view';
import {mermaidBlocks} from './blocks';
import {noteText, notifyMermaidEditorChange} from './binding';

type OpenDiagram = (file: TFile, index: number) => Promise<void>;
const liveControls=new WeakMap<Plugin,Set<DiagramControls>>();
export function trackDiagramControls(plugin:Plugin,controls:DiagramControls):DiagramControls{let set=liveControls.get(plugin);if(!set){set=new Set();liveControls.set(plugin,set);}set.add(controls);controls.register(()=>set.delete(controls));return controls;}
export function refreshDiagramControls(plugin:Plugin):void{for(const controls of liveControls.get(plugin)??[])controls.refresh();}
/** Add an adjacent UI control, leaving Obsidian's SVG and source-edit button intact. */
export class DiagramControls extends Component {
 private controls = new Map<HTMLElement, HTMLButtonElement>();
 private rescan:()=>void=()=>{};
 constructor(private scopeEl: HTMLElement, private open: (root: HTMLElement) => Promise<void>, private report: (error: unknown) => void, private selector = '.mermaid', private label:string|(()=>string) = ()=>tr("mermaid.edit_in_mermaid"),private enabled:()=>boolean=()=>true) {super();}
 refresh():void{for(const button of this.controls.values()){button.hidden=!this.enabled();button.disabled=!this.enabled();}this.rescan();}
 onload(): void {
  const win = this.scopeEl.ownerDocument.defaultView ?? window; let frame: number | undefined;
  const scan = (): void => {
   for (const [root, button] of this.controls) if (!this.scopeEl.contains(root) || !root.contains(button)) {resize.unobserve(root); button.remove(); root.removeClass('em-mm-note-diagram'); this.controls.delete(root);}
   if(!this.enabled()){for(const button of this.controls.values()){button.hidden=true;button.disabled=true;}return;}
   for(const button of this.controls.values()){button.hidden=false;button.disabled=false;}
   const diagrams = [...this.scopeEl.querySelectorAll<HTMLElement>(this.selector)]; if (this.scopeEl.matches(this.selector)) diagrams.unshift(this.scopeEl);
   for (const diagram of diagrams) {
    if (diagram.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
    const enclosing = diagram.closest<HTMLElement>('.cm-embed-block') ?? diagram.closest<HTMLElement>('.cm-preview-code-block') ?? diagram.closest<HTMLElement>('.el-pre');
    const candidate = enclosing ?? (diagram.parentElement === this.scopeEl ? this.scopeEl : diagram), root = this.scopeEl.contains(candidate) ? candidate : this.scopeEl;
    if (this.controls.has(root) || root.querySelector('.em-mm-open')) continue;
    const label=typeof this.label==='function'?this.label():this.label;
    root.addClass('em-mm-note-diagram'); const button = root.createEl('button', {cls: 'em-mm-open clickable-icon', attr: {type: 'button', 'aria-label': label, title: label,'data-em-diagram-kind':this.selector.includes('argdown')?'argdown':'mermaid'}}); setIcon(button, 'pencil'); resize.observe(root);
    button.onclick = event => {event.stopPropagation(); event.preventDefault();if(this.enabled())void this.open(root).catch(this.report);}; this.controls.set(root, button);
   }
   for (const [root, button] of this.controls) {
    const bounds = root.getBoundingClientRect(); let occupied = 6, bottom = 6;
    const nativeRoot = root.closest<HTMLElement>('.cm-embed-block,.cm-preview-code-block,.el-pre') ?? root;
    for (const native of nativeRoot.querySelectorAll<HTMLElement>('button,[role="button"],.clickable-icon,.embed-action,.copy-code-button,.mermaid-edit-button')) {
     if (native === button || button.contains(native)) continue;
     const r = native.getBoundingClientRect(); if (r.width && r.height && r.top < bounds.top + 60 && r.bottom > bounds.top) {occupied = Math.max(occupied, bounds.right - r.left + 6); bottom = Math.max(bottom, r.bottom - bounds.top + 6);}
     else if (native.matches('.edit-block-button')) occupied = Math.max(occupied, 38);
    }
    const top = occupied + button.offsetWidth + 6 > bounds.width ? bottom : 6;
    const right = top === 6 ? occupied : 6;
    if (button.style.right !== right + 'px') button.style.setProperty('right', right + 'px');
    if (button.style.top !== top + 'px') button.style.setProperty('top', top + 'px');
   }
  };
  const schedule = (): void => {frame ??= win.requestAnimationFrame(() => {frame = undefined; scan();});};
  this.rescan=schedule;
  const observer = new MutationObserver(records => {if (records.some(record => !(record.target.instanceOf(Element) && record.target.closest('.em-mm-open')))) schedule();}); observer.observe(this.scopeEl, {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden']});
  const resize = new ResizeObserver(schedule); resize.observe(this.scopeEl);
  this.registerDomEvent(this.scopeEl, 'pointerover', schedule); this.registerDomEvent(this.scopeEl, 'focusin', schedule); this.registerDomEvent(this.scopeEl, 'scroll', schedule, {capture: true, passive: true});
  this.register(() => {if (frame !== undefined) win.cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect(); for (const [root, button] of this.controls) {button.onclick = null; button.remove(); root.removeClass('em-mm-note-diagram');} this.controls.clear();});
  scan();
 }
}
export function registerMermaidNoteControls(plugin: Plugin, open: OpenDiagram, report: (error: unknown) => void,enabled:()=>boolean=()=>true): void {
 const app: App = plugin.app;
 plugin.registerMarkdownPostProcessor((el, ctx) => {
  if (!el.matches('.el-pre,.mermaid') && !el.querySelector('.mermaid,.el-pre,pre > code.language-mermaid')) return;
  class ControlsChild extends MarkdownRenderChild {
   onload(): void {this.addChild(trackDiagramControls(plugin,new DiagramControls(el, async root => {
    const file = app.vault.getFileByPath(ctx.sourcePath); if (!file) throw new Error(tr("argdown.the_source_file_no_longer_exists"));
    const section = ctx.getSectionInfo(root); if (!section) throw new Error(tr("mermaid.the_mermaid_block_could_not_be_matched_use_the_command_at"));
    const candidates = mermaidBlocks(await noteText(app, file)).filter(b => b.line >= section.lineStart && b.line <= section.lineEnd);
    let block = candidates.length === 1 ? candidates[0] : undefined;
    if (!block) {const roots = [...el.querySelectorAll<HTMLElement>('.em-mm-note-diagram')]; const index = roots.indexOf(root); if (roots.length === candidates.length && index >= 0) block = candidates[index];}
    if (!block) throw new Error(tr("mermaid.the_mermaid_block_cannot_be_uniquely_matched_use_the_command_at"));
    await open(file, block.index);
   }, report,'.mermaid',()=>tr('mermaid.edit_in_mermaid'),enabled)));}
  }
  ctx.addChild(new ControlsChild(el));
 });
 plugin.registerEditorExtension(ViewPlugin.fromClass(class {
  private controls: DiagramControls;
  constructor(view: EditorView) {
   this.controls = trackDiagramControls(plugin,new DiagramControls(view.dom, async root => {
    const info = view.state.field(editorInfoField, false), file = info?.file; if (!file) throw new Error(tr("mermaid.no_markdown_note_is_open"));
    const position = view.posAtDOM(root), block = mermaidBlocks(view.state.doc.toString()).find(b => position >= b.from && position <= b.to);
    if (!block) throw new Error(tr("mermaid.place_the_cursor_inside_the_mermaid_block_and_use_the_edit"));
    await open(file, block.index);
   }, report,'.mermaid',()=>tr('mermaid.edit_in_mermaid'),enabled)); this.controls.load();
  }
  update(update: ViewUpdate): void {const file = update.state.field(editorInfoField, false)?.file; if (update.docChanged && file) notifyMermaidEditorChange(app, file, update.startState.doc.toString(), update.state.doc.toString(), update.changes);}
  destroy(): void {this.controls.unload();}
 }));
 localizedCommand(plugin,"mermaid.edit_mermaid_diagram_at_cursor",{id: 'edit-mermaid-at-cursor', editorCheckCallback: (checking, editor, info) => {
  if (!enabled()||!info.file) return false; const offset = editor.posToOffset(editor.getCursor()), block = mermaidBlocks(editor.getValue()).find(b => offset >= b.from && offset <= b.to); if (!block) return false;
  if (!checking) void open(info.file, block.index).catch(report); return true;
 }});
 plugin.registerEvent(app.workspace.on('editor-menu', (menu, editor, info) => {
  if (!enabled()||!info.file) return; const file = info.file, offset = editor.posToOffset(editor.getCursor()), block = mermaidBlocks(editor.getValue()).find(b => offset >= b.from && offset <= b.to);
  if (block) menu.addItem(item => item.setTitle(tr("mermaid.edit_in_mermaid")).setIcon('pencil').onClick(() => {void open(file, block.index).catch(report);}));
 }));
}
