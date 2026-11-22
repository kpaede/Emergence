import {t as tr} from '../i18n';
/*! Native editor discovery adapted from Excerpt Outline Mindmap Editor.
https://github.com/kpaede/Excerpt-Outline-Mindmap-Editor
MIT License

Copyright (c) 2025 Kornelius Paede

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import {Component, Scope, type App, type Editor, type MarkdownFileInfo, type TFile} from 'obsidian';
import {Prec, type Extension} from '@codemirror/state';
import {EditorView, keymap, type KeyBinding} from '@codemirror/view';

// Obsidian has no public API for embedding its Markdown editor. Keep the
// private surface small and checked; never patch the shared editor prototype.
interface NativeEditor {
 cm: EditorView; editor: Editor; editorEl: HTMLElement; sourceMode: boolean;
 buildLocalExtensions(): Extension[];
 set(value: string, focus?: boolean): void;
 toggleSource(): void;
 load(): void;
 unload(): void;
 destroy(): void;
}
interface Owner extends MarkdownFileInfo {
 onMarkdownScroll(): void; syncScroll(): void; getMode(): string; isShown(): boolean;
 editMode?: NativeEditor; containerEl: HTMLElement;
}
type EditorConstructor = new (app: App, host: HTMLElement, owner: Owner) => NativeEditor;
interface Widget {editable: boolean; editMode?: object; showEditor(): void; load(): void; unload(): void}
interface EmbedApp {embedRegistry?: {embedByExtension?: {md?: (context: {app: App; containerEl: HTMLElement}, file: null, subpath: string) => Widget}}}
const constructors = new WeakMap<App, EditorConstructor>();
export interface EmbeddedMarkdownKeys {
 onEnter(view:EditorView,mod:boolean,shift:boolean):boolean;
 onBlur?():void;
 onEscape?():boolean;
 onDelete?():void;
 onChange?(view:EditorView):void;
 selectAll?:boolean;
 inline?:boolean;
}
function nativeEditorClass(app: App, doc: Document): EditorConstructor {
 const cached = constructors.get(app); if (cached) return cached;
 const create = (app as App & EmbedApp).embedRegistry?.embedByExtension?.md;
 if (!create) throw new Error(tr("mermaid.the_embedded_obsidian_markdown_editor_is_unavailable"));
 const ownerWindow=doc.win as Window & {createDiv:typeof createDiv};
 const widget = create({app, containerEl: ownerWindow.createDiv()}, null, '');
 try {
  widget.load();
  widget.editable = true; widget.showEditor();
  if (!widget.editMode) throw new Error(tr("mermaid.the_native_markdown_editor_could_not_be_loaded"));
  const prototype = Object.getPrototypeOf(Object.getPrototypeOf(widget.editMode)) as Partial<NativeEditor> & {constructor: EditorConstructor};
  if (typeof prototype.buildLocalExtensions !== 'function' || typeof prototype.set !== 'function' || typeof prototype.destroy !== 'function') throw new Error(tr("mermaid.the_native_markdown_editor_interface_has_changed"));
  constructors.set(app, prototype.constructor); return prototype.constructor;
 } finally {widget.unload();}
}

/** Isolated caption document, with the note file used only for link context. */
export class MermaidMarkdownEditor extends Component {
 readonly native: NativeEditor;
 private scope: Scope;
 private owner: Owner;
 private previous: MarkdownFileInfo | null = null;
 private activated = false;
 constructor(private app: App, host: HTMLElement, value: string, file: TFile | undefined, parentScope: Scope, submit: () => void, cancel: () => void, keys?:EmbeddedMarkdownKeys) {
  super(); this.previous = app.workspace.activeEditor; this.scope = new Scope(parentScope);
  this.scope.register(['Mod'], 'Enter', () => {if(keys)return true;submit(); return false;});
  if(keys?.onEscape)this.scope.register([], 'Escape', event=>event.isComposing?true:!keys.onEscape?.());
  this.owner = {app, file: file ?? null, hoverPopover: null, containerEl: host, onMarkdownScroll: () => {}, syncScroll: () => {}, getMode: () => 'source', isShown: () => host.isConnected && host.isShown()};
  const Base = nativeEditorClass(app, host.ownerDocument), activate = (): void => this.activate(), deactivate = (): void => this.deactivate();
  class CaptionEditor extends Base {
   buildLocalExtensions(): Extension[] {
    const bindings:KeyBinding[]=keys?[
     {key:'Enter',run:view=>keys.onEnter(view,false,false),shift:view=>keys.onEnter(view,false,true)},
     {key:'Mod-Enter',run:view=>keys.onEnter(view,true,false),shift:view=>keys.onEnter(view,true,true)},
    ]:[{key:'Mod-Enter',run:()=>{submit();return true;}}];
    if(keys?.onDelete)for(const key of ['Mod-Delete','Mod-Backspace'])bindings.push({key,run:()=>{keys.onDelete?.();return true;}});
    return [...super.buildLocalExtensions(), Prec.highest(keymap.of([...bindings,
     {key: 'Escape', run: () => {if(keys?.onEscape)return keys.onEscape();cancel(); return true;}},
    ])), EditorView.domEventHandlers({focus: activate, blur:()=>{deactivate();keys?.onBlur?.();}}),...(keys?.onChange?[EditorView.updateListener.of(update=>{if(update.docChanged)keys.onChange?.(update.view);})]:[])];
   }
  }
  this.native = new CaptionEditor(app, host, this.owner);
  this.register(() => {this.deactivate(); this.owner.hoverPopover?.unload(); this.native.unload(); this.native.destroy(); host.empty();});
  try {
   this.native.load();
   if (!this.native.cm?.state || typeof this.native.toggleSource !== 'function') throw new Error(tr("mermaid.the_native_markdown_editor_interface_has_changed"));
   this.owner.editor = this.native.editor; this.owner.editMode = this.native;
   this.native.editorEl.addClasses(['markdown-source-view', 'mod-cm6', keys?.inline?'em-inline-markdown-source':'em-mm-markdown-source']);
   if (this.native.sourceMode) this.native.toggleSource();
   this.native.set(value, false);
   if(keys?.selectAll)this.native.cm.dispatch({selection:{anchor:0,head:value.length}});
   this.native.cm.contentDOM.setAttribute('aria-label', tr("labels.markdown_label"));
  } catch (error) {this.load(); this.unload(); throw error;}
 }
 get value(): string {return this.native.cm.state.doc.toString();}
 set(value: string): void {this.native.set(value, false);}
 focus(): void {this.native.cm.focus(); this.activate();}
 private activate(): void {
  if (this.activated) {this.app.workspace.activeEditor = this.owner; return;} this.activated = true;
  if (this.app.workspace.activeEditor !== this.owner) this.previous = this.app.workspace.activeEditor;
  this.app.keymap.pushScope(this.scope); this.app.workspace.activeEditor = this.owner;
 }
 private deactivate(): void {
  if (!this.activated) return; this.activated = false;
  this.app.keymap.popScope(this.scope);
  if (this.app.workspace.activeEditor === this.owner) this.app.workspace.activeEditor = this.previous;
 }
}
