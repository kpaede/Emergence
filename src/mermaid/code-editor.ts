import {t as tr} from '../i18n';
import {Compartment,EditorState} from '@codemirror/state';
import {defaultKeymap, indentWithTab} from '@codemirror/commands';
import {Decoration, drawSelection, EditorView, keymap, lineNumbers, ViewPlugin, type DecorationSet, type ViewUpdate} from '@codemirror/view';
import type {SourceRange} from './types';
import {highlightMermaidRanges} from './highlighting';


export interface CodeToken {from: number; to: number; className: string}
export interface DiagramCodeOptions {label: string; tokens(source: string): CodeToken[]; syncSelection?: boolean}
export class MermaidCodeEditor {
 readonly view: EditorView;
 private attributes=new Compartment();
 private replacing = false;
 private alive = true;
 private selectionVersion = 0;
 private highlighted: SourceRange[] = [];
 constructor(host: HTMLElement, source: string, change: (source: string) => void, select: (position: number) => void, undo: () => void, redo: () => void, readOnly = false, private options?: DiagramCodeOptions) {
  const decorate = (view: EditorView): DecorationSet => this.decorate(view);
  const notify = (state: EditorState): void => {const position = state.selection.main.head, version = ++this.selectionVersion; queueMicrotask(() => {if (this.alive && version === this.selectionVersion) select(position);});};
  const onUpdate = (update: ViewUpdate): void => {
   if (this.replacing) return; if (update.docChanged) change(update.state.doc.toString());
   if (update.selectionSet) notify(update.state);
  };
  const decorations = ViewPlugin.fromClass(class {
   decorations: DecorationSet;
   constructor(view: EditorView) {this.decorations = decorate(view);}
   update(update: ViewUpdate): void {if (update.docChanged || update.viewportChanged || update.transactions.length) this.decorations = decorate(update.view);}
  }, {decorations: plugin => plugin.decorations});
  this.view = new EditorView({parent: host, state: EditorState.create({doc: source, extensions: [lineNumbers({domEventHandlers: options?.syncSelection ? {mousedown: (view, line, event) => {if (!('button' in event) || event.button !== 0) return false; event.preventDefault(); view.dispatch({selection: {anchor: line.from}}); notify(view.state); view.focus(); return true;}} : undefined}), drawSelection(), EditorView.lineWrapping, decorations, EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly),
   this.attributes.of(EditorView.contentAttributes.of({'aria-label': options?.label ?? tr("labels.mermaid_source"), spellcheck: 'false'})),
   keymap.of([{key: 'Mod-z', run: () => {undo(); return true;}}, {key: 'Mod-Shift-z', run: () => {redo(); return true;}}, {key: 'Mod-y', run: () => {redo(); return true;}},
    indentWithTab, ...defaultKeymap]),
   EditorView.domEventHandlers({click: (_event, view) => {if (options?.syncSelection) notify(view.state); return false;}}),
   EditorView.updateListener.of(onUpdate),
  ]})});
 }
 private decorate(view: EditorView): DecorationSet {
  const source = view.state.doc.toString(), ranges = [];
  for (const token of (this.options?.tokens(source) ?? highlightMermaidRanges(source))) ranges.push(Decoration.mark({class: token.className + ' em-mm-token-' + token.className.slice(4)}).range(token.from, token.to));
  const lines = new Set<number>();
  for (const range of this.highlighted) if (range.from <= source.length) {const end = this.options?.syncSelection ? Math.min(source.length, Math.max(range.from, range.to - 1)) : range.from; for (let line = view.state.doc.lineAt(range.from);;) {lines.add(line.from); if (line.to >= end || line.to >= source.length) break; line = view.state.doc.lineAt(line.to + 1);}}
  for (const from of lines) ranges.push(Decoration.line({class: 'em-mm-code-selected'}).range(from));
  return Decoration.set(ranges, true);
 }
 setSource(source: string): void {
  if (this.view.state.doc.toString() === source) return;
  this.replacing = true;
  try {this.view.dispatch({changes: {from: 0, to: this.view.state.doc.length, insert: source}});} finally {this.replacing = false;}
 }
 setLabel(label:string):void{this.view.dispatch({effects:this.attributes.reconfigure(EditorView.contentAttributes.of({'aria-label':label,spellcheck:'false'}))});}
 highlight(ranges: SourceRange[], reveal = false): void {
  this.highlighted = ranges; this.replacing = true;
  try {this.view.dispatch({...reveal && ranges[0] && this.options?.syncSelection ? {selection: {anchor: Math.min(ranges[0].from, this.view.state.doc.length)}} : {}, effects: reveal && ranges[0] ? EditorView.scrollIntoView(Math.min(ranges[0].from, this.view.state.doc.length), {y: 'nearest'}) : []});} finally {this.replacing = false;}
 }
 destroy(): void {this.alive = false; this.view.destroy();}
}
