import {t as tr} from '../i18n';
import {Component, MarkdownView, Menu, Modal, Notice, setIcon, type App, type TFile} from 'obsidian';
import {iconButton,relabelIcon} from '../ui/panel';
import {fencedSource, mermaidBlocks} from './blocks';
import {MermaidBinding, noteText} from './binding';
import {MermaidCodeEditor} from './code-editor';
import {flowStart} from './starters';
import {MermaidHistory} from './history';
import {loadNativePele, sanitizeDiagram} from './native';
import {isFlow, isMind, type DiagramModel, type MountedDiagram, type Pele} from './types';
import {MermaidTextModal, MermaidColorModal} from './dialogs';
import {MermaidLibraryMenu, libraryTrigger} from './library-menu';
import type {MermaidLibrary} from './library';
import {keysAtPosition, selectionRanges} from './selection';
import {MermaidInteractions, type InteractionHost} from './interactions';
import {renderMermaidToolbar, type MermaidAction} from './toolbar';
import {appendSource, freshId, quoted} from './source';
import {assertGroupRewrite, moveToGroup, parents, rootSelection} from './groups';
import {changeFlowEdge, deleteFlowItems, editFlowNode, flowColor, flowEdgeColor, flowIds} from './flow-actions';
import {addMindChild, addMindSibling, deleteMindBranch, editMindNode, mindLabelMode, mindLines, moveMindBranch, reorderMindBranch} from './mindmap';
import {mindmapColors} from './mindmap-colors';
import {labelText, type LabelMode} from './labels';
import {edgeChoices, MermaidChoiceModal, shapeChoices} from './choices';
import {tryFormatFlow} from './flow-format';
import {flowDirection, hasOutsideConnection} from './direction';
import {flowNodeLink} from './links';

export class MermaidPanel extends Component implements InteractionHost {
 readonly root: HTMLElement; readonly stage: HTMLElement; readonly preview: HTMLElement; readonly overlay: HTMLElement; readonly toolbar: HTMLElement;
 readonly selected = new Set<string>(); model?: DiagramModel; pele?: Pele;
 source = flowStart();
 private editor: MermaidCodeEditor; private diagram?: MountedDiagram; private history = new MermaidHistory(this.source);
 private binding?: MermaidBinding; private renderTimer?: number; private saveTimer?: number; private refreshTimer?: number; private sessionGeneration = 0;
 private error: HTMLElement; private status: HTMLElement; private hint: HTMLElement; private directionButton: HTMLButtonElement; private undoButton: HTMLButtonElement; private redoButton: HTMLButtonElement;
 private insertButton: HTMLButtonElement; private interactions: MermaidInteractions; private fullscreen?: Modal; private dialogs = new Set<Modal>(); private disposed = false; private active = false; private loading?: Promise<void>;
 private libraryMenu: MermaidLibraryMenu; private directionMenu?: Menu;
 private relabel:()=>void=()=>{};
 private enabled=true;
 constructor(readonly app: App, host: HTMLElement, private currentFile: () => TFile | undefined, library: MermaidLibrary) {
  super(); this.root = host.createDiv({cls: 'em-mermaid'});
  const top = this.root.createDiv({cls: 'em-mm-top'}), tools = top.createDiv({cls: 'em-mm-tools'});
  const create = libraryTrigger(tools);
  this.libraryMenu = this.addChild(new MermaidLibraryMenu(this.root, create, library, {open: source => this.newDraft(source), insert: source => this.insert(source), source: () => this.source, preview: source => {if (!this.pele) throw new Error(tr("labels.pele_is_still_loading")); return Promise.resolve(this.pele.render(source).svg);}, validate: source => {if (!this.pele) throw new Error(tr("labels.pele_is_still_loading")); this.pele.parse(source); this.pele.render(source);}}));
  create.onclick = () => this.libraryMenu.toggle();
  this.undoButton = iconButton(tools, 'undo-2', tr("argdown.undo_ctrl_cmd_z"), () => this.undo()); this.redoButton = iconButton(tools, 'redo-2', tr("labels.redo_ctrl_cmd_shift_z"), () => this.redo());
  const maximize=iconButton(tools, 'maximize', tr("mermaid.open_mermaid_full_screen"), () => this.toggleFullscreen());
  this.status = top.createDiv({cls: 'em-mm-status', attr: {role: 'status'}});
  const context = top.createDiv({cls: 'em-mm-context'});
  this.insertButton = context.createEl('button', {text: tr("argdown.insert_into_note"), cls: 'mod-cta'}); this.insertButton.onclick = () => {void this.run(() => this.insert());};
  const split = this.root.createDiv({cls: 'em-mm-split'}), code = split.createDiv({cls: 'em-mm-code'}), divider = split.createDiv({cls: 'em-mm-divider', attr: {role: 'separator', tabindex: '0', 'aria-label': tr("mermaid.size_of_source_and_diagram"), 'aria-valuemin': '20', 'aria-valuemax': '80', 'aria-valuenow': '36'}});
  this.stage = split.createDiv({cls: 'em-mm-stage'}); this.preview = this.stage.createDiv({cls: 'em-mm-preview', attr: {tabindex: '0', 'aria-label': tr("mermaid.mermaid_diagram")}});
  this.overlay = this.stage.createDiv({cls: 'em-mm-overlay'}); this.toolbar = this.overlay.createDiv({cls: 'em-mm-toolbar', attr: {role: 'toolbar', 'aria-label': tr("mermaid.edit_diagram_selection")}}); this.toolbar.hidden = true;
  const diagramTools = this.stage.createDiv({cls: 'em-mm-diagram-tools'});
  this.directionButton = iconButton(diagramTools, 'arrow-down-up', tr("mermaid.main_graph_direction"), () => {}); this.directionButton.onclick = event => this.openDirection(undefined, event);
  this.error = this.root.createDiv({cls: 'em-mm-error em-error', attr: {role: 'status'}});
  this.hint = this.root.createDiv({cls: 'em-mm-hint'});
  this.editor = new MermaidCodeEditor(code, this.source, source => this.setSource(source, true), position => {
   if (!this.model) return; this.select(keysAtPosition(this.source, this.model, position), false, false);
  }, () => this.undo(), () => this.redo());
  this.interactions = this.addChild(new MermaidInteractions(this));
  let ratio = 36;
  const setRatio = (value: number): void => {ratio = Math.max(20, Math.min(80, value)); split.style.setProperty('--em-mm-split', ratio + '%'); divider.setAttribute('aria-valuenow', String(Math.round(ratio))); this.diagram?.refresh();};
  divider.onpointerdown = event => {event.preventDefault(); divider.setPointerCapture(event.pointerId);};
  divider.onpointermove = event => {if (!divider.hasPointerCapture(event.pointerId)) return; const rect = split.getBoundingClientRect(); setRatio(this.root.clientWidth >= 720 ? (event.clientX - rect.left) / rect.width * 100 : (event.clientY - rect.top) / rect.height * 100);};
  divider.onkeydown = event => {if (event.key.startsWith('Arrow')) {event.preventDefault(); setRatio(ratio + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -5 : 5));}};
  this.register(() => {this.directionMenu?.hide(); this.editor.destroy(); this.diagram?.destroy(); this.fullscreen?.close(); for (const dialog of this.dialogs) dialog.close(); this.root.remove();});
  this.updateStatus();
  this.relabel=()=>{
   relabelIcon(this.undoButton,tr('argdown.undo_ctrl_cmd_z'));relabelIcon(this.redoButton,tr('labels.redo_ctrl_cmd_shift_z'));relabelIcon(maximize,tr('mermaid.open_mermaid_full_screen'));relabelIcon(this.directionButton,tr('mermaid.main_graph_direction'));
   this.insertButton.setText(tr('argdown.insert_into_note'));divider.setAttribute('aria-label',tr('mermaid.size_of_source_and_diagram'));this.preview.setAttribute('aria-label',tr('mermaid.mermaid_diagram'));this.toolbar.setAttribute('aria-label',tr('mermaid.edit_diagram_selection'));this.editor.setLabel(tr('labels.mermaid_source'));
  };
 }
 refreshLanguage():void{this.directionMenu?.hide();this.relabel();this.libraryMenu.refreshLanguage();this.updateStatus();this.paint();}
 setEnabled(value:boolean):void{this.enabled=value;if(!value){this.directionMenu?.hide();this.libraryMenu.hide();this.fullscreen?.close();}}
 onload(): void {
  const win = this.root.ownerDocument.defaultView ?? window;
  const resize = new ResizeObserver(() => {this.interactions.paint();}); resize.observe(this.stage); this.register(() => resize.disconnect());
  const transforms = new MutationObserver(() => this.interactions.paint()); transforms.observe(this.preview, {subtree: true, attributes: true, attributeFilter: ['transform', 'style', 'viewBox']}); this.register(() => transforms.disconnect());
  this.registerDomEvent(this.preview, 'scroll', () => this.interactions.paint());
  this.registerDomEvent(this.preview, 'wheel', () => {win.requestAnimationFrame(() => this.interactions.paint());}, {passive: true});
  this.registerDomEvent(this.root, 'keydown', event => {
   const target = event.target as Node;
   if (this.editor.view.dom.contains(target) || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
   const diagram = this.preview.contains(target) || this.overlay.contains(target);
   if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {event.preventDefault(); event.stopImmediatePropagation(); if (event.shiftKey) this.redo(); else this.undo();}
   if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {event.preventDefault(); event.stopImmediatePropagation(); this.redo();}
   if (diagram && (event.key === 'Delete' || event.key === 'Backspace')) {event.preventDefault(); event.stopImmediatePropagation(); if (this.selected.size) this.action('delete');}
   if (this.preview.contains(target) && event.key === 'Enter' && this.selected.size === 1) {event.preventDefault(); event.stopImmediatePropagation(); this.editText();}
  }, {capture: true});
  const schedule = (): void => {if (this.refreshTimer) win.clearTimeout(this.refreshTimer); this.refreshTimer = win.setTimeout(() => {this.refreshTimer = undefined; void this.run(async () => {await this.refreshExternal(); await this.context();});}, 220);};
  this.registerEvent(this.app.workspace.on('editor-change', schedule)); this.registerEvent(this.app.vault.on('modify', file => {if (file === this.binding?.file) schedule();}));
  this.registerEvent(this.app.vault.on('rename', () => {if (this.active) void this.context();}));
  this.register(() => {this.disposed = true; if (this.renderTimer) win.clearTimeout(this.renderTimer); if (this.refreshTimer) win.clearTimeout(this.refreshTimer); void this.flush().catch(error => new Notice(String(error))).finally(() => this.binding?.dispose());});
 }
 async activate(): Promise<void> {
  if(!this.enabled)return;
  this.active = true;
  this.loading ??= (async () => {this.pele = await loadNativePele(); if (!this.disposed) {this.render(); await this.context();}})().catch((error: unknown) => {this.loading = undefined; this.error.setText(String(error));});
  await this.loading; this.diagram?.refresh();
 }
 context(): Promise<void> {
  if (this.active && !this.disposed) {this.insertButton.parentElement!.hidden = !!this.binding; this.insertButton.disabled = !this.currentFile(); this.updateStatus();}
  return Promise.resolve();
 }
 private updateStatus(): void {
  this.status.setText(this.binding ? this.binding.file.basename + tr("labels.diagram") + (this.binding.index + 1) : tr("argdown.draft_not_inserted_yet"));
  this.undoButton.disabled = !this.history.canUndo; this.redoButton.disabled = !this.history.canRedo;
 }
 async openBlock(file: TFile, index: number): Promise<void> {
  const generation = ++this.sessionGeneration; await this.flush(); const note = await noteText(this.app, file); if (generation !== this.sessionGeneration || this.disposed) return;
  const block = mermaidBlocks(note)[index]; if (!block) throw new Error(tr("mermaid.the_diagram_no_longer_exists"));
  this.binding?.dispose(); this.binding = new MermaidBinding(this.app, file, note, block); this.source = block.source; this.history = new MermaidHistory(this.source); this.selected.clear(); this.editor.setSource(this.source); await this.activate(); this.render(); await this.context();
 }
 async newDraft(source: string): Promise<void> {
  const generation = ++this.sessionGeneration; await this.flush(); if (generation !== this.sessionGeneration || this.disposed) return;
  this.binding?.dispose(); this.binding = undefined; this.source = source; this.history = new MermaidHistory(source); this.selected.clear(); this.editor.setSource(source); await this.activate(); this.render(); await this.context();
 }
 async insert(source = this.source): Promise<void> {
  const file = this.currentFile(); if (!file) throw new Error(tr("argdown.open_a_markdown_note_first")); await this.flush();
  const editor = this.app.workspace.getLeavesOfType('markdown').map(l => l.view).find((view): view is MarkdownView => view instanceof MarkdownView && view.file?.path === file.path)?.editor;
  if (!editor) throw new Error(tr("argdown.open_the_target_note_in_the_editor"));
  const position = editor.getCursor('to'), offset = editor.posToOffset(position), text = editor.getValue(), before = offset > 0 && text[offset - 1] !== '\n' ? '\n\n' : '\n';
  editor.replaceRange(before + fencedSource(source) + '\n', position);
  const block = mermaidBlocks(editor.getValue()).find(b => b.from >= offset && b.from <= offset + before.length); if (!block) throw new Error(tr("mermaid.the_inserted_diagram_could_not_be_matched"));
  await this.openBlock(file, block.index);
 }
 private setSource(source: string, typing = false, record = true): void {
  this.source = source; if (record) this.history.push(source, typing); this.editor.setSource(source); this.updateStatus();
  const win = this.root.ownerDocument.defaultView ?? window;
  if (this.renderTimer) win.clearTimeout(this.renderTimer); this.renderTimer = win.setTimeout(() => {this.renderTimer = undefined; this.render();}, typing ? 90 : 0);
  if (this.binding) {if (this.saveTimer) win.clearTimeout(this.saveTimer); this.saveTimer = win.setTimeout(() => {this.saveTimer = undefined; void this.run(() => this.binding?.save(this.source));}, 160);}
 }
 async flush(): Promise<void> {
  await this.libraryMenu.library.flush().catch(() => {});
  if (this.saveTimer) {window.clearTimeout(this.saveTimer); this.saveTimer = undefined; await this.binding?.save(this.source);} await this.binding?.pending;
 }
 private async refreshExternal(): Promise<void> {
  const binding = this.binding; if (!binding || this.saveTimer) return; await binding.pending; if (binding !== this.binding) return; const source = await binding.refresh(); if (binding !== this.binding) return;
  if (source !== undefined && source !== this.source) {this.source = source; this.history.push(source); this.editor.setSource(source); this.render(); this.updateStatus();}
 }
 private render(): void {
  if (!this.pele || this.disposed) return;
  try {this.model = this.pele.parse(this.source); this.error.empty();} catch (error) {this.model = undefined; this.error.setText(String(error));}
  if (!this.diagram) this.diagram = this.pele.mount(this.preview, this.source, {sanitize: sanitizeDiagram, onRender: () => this.paint(), onError: error => this.error.setText(String(error))});
  else this.diagram.update(this.source);
  this.paint();
 }
 private paint(): void {
  if (this.disposed) return;
  if (this.model) {renderMermaidToolbar(this.toolbar, this.model, this.selected, (command, value) => this.action(command, value)); this.editor.highlight(selectionRanges(this.source, this.model, this.selected));}
  else {this.toolbar.hidden = true; this.selected.clear(); this.editor.highlight([]);}
  this.interactions.paint();
  this.directionButton.hidden = !this.model || !isFlow(this.model);
  this.hint.setText(this.model && isMind(this.model) ? [...this.selected].some(k => k.startsWith('m:')) ? tr("mermaid.delete_removes_the_selected_branch_and_its_subbranches") : tr("mermaid.last_child_siblings_before_after_via_toolbar_layout_pele") : tr("mermaid.click_select_double_click_text_delete_remove_drag_connect"));
  const group = this.model && isFlow(this.model) && this.selected.size === 1 ? this.model.subgraphs.find(g => this.selected.has('g:' + g.id)) : undefined;
  if (group?.dir && this.model && isFlow(this.model) && hasOutsideConnection(this.model, group.id)) this.hint.setText(tr("mermaid.external_connections_pele_uses_the_parent_direction_here_the_local_direction"));
 }
 select(keys: string[], additive = false, reveal = true): void {
  if (!additive) this.selected.clear(); for (const key of keys) {if (additive && this.selected.has(key)) this.selected.delete(key); else this.selected.add(key);}
  this.paint(); if (this.model) this.editor.highlight(selectionRanges(this.source, this.model, this.selected), reveal);
 }
 undo(): void {const source = this.history.undo(); if (source !== undefined) this.setSource(source, false, false);}
 redo(): void {const source = this.history.redo(); if (source !== undefined) this.setSource(source, false, false);}
 private commit(candidate: string): void {if (!this.pele) return; const model = this.pele.parse(candidate); if (isFlow(model)) candidate = tryFormatFlow(candidate, model, this.pele); this.pele.render(candidate); this.setSource(candidate);}
 editText(): void {const key = [...this.selected][0]; if (key?.startsWith('m:')) return; this.action(key?.startsWith('e:') ? 'edge-label' : 'rename');}
 openLink(target: string): void {if (target) void this.run(() => this.app.workspace.openLinkText(target, this.binding?.file.path ?? this.currentFile()?.path ?? '', true));}
 connect(origin: string, target?: string, group?: string): void {
  void this.run(() => {
   const model = this.pele?.parse(this.source); if (!model) return;
   if (isFlow(model)) {
    if (origin === target && model.subgraphs.some(g => g.id === origin)) throw new Error(tr("mermaid.a_subgraph_cannot_be_connected_to_itself"));
    const id = target ?? freshId(flowIds(model));
    let candidate = appendSource(this.source, (target ? '' : id + '[' + tr('messages.newNode') + ']\n') + origin + ' --> ' + id);
    const parent = group ?? parents(model).get(origin), parsed = this.pele!.parse(candidate);
    if (!target && parent && isFlow(parsed)) candidate = moveToGroup(candidate, parsed, [id], parent);
    this.commit(candidate);
   } else if (isMind(model)) {this.commit(target ? moveMindBranch(this.source, model, target, origin) : addMindChild(this.source, model, origin));}
  });
 }
 move(keys: string[], target: string): void {void this.run(() => {
  if (this.model && isFlow(this.model)) this.moveGroup(keys.filter(k => !k.startsWith('e:')).map(k => k.slice(2)), target);
  else if (this.model && isMind(this.model) && keys.length === 1) this.commit(moveMindBranch(this.source, this.model, keys[0]!.slice(2), target));
 });}
 private moveGroup(ids: string[], target: string, create?: {id: string; title: string; parent?: string}, dissolve?: string): void {
  if (!this.pele) return; this.model = this.pele.parse(this.source); if (!isFlow(this.model)) return;
  const expected = parents(this.model), roots = rootSelection(this.model, ids), destination = create?.id ?? target;
  if (create?.parent) expected.set(create.id, create.parent);
  for (const id of roots) {if (destination) expected.set(id, destination); else expected.delete(id);}
  if (dissolve) {const p = expected.get(dissolve); expected.delete(dissolve); for (const [id, parent] of expected) if (parent === dissolve) {if (p) expected.set(id, p); else expected.delete(id);}}
  const candidate = moveToGroup(this.source, this.model, ids, target, create, dissolve); assertGroupRewrite(this.pele, this.model, candidate, expected); this.commit(candidate);
 }
 action(command: MermaidAction, value?: string): void {
  void this.run(() => this.perform(command, value));
 }
 private perform(command: MermaidAction, value?: string): void {
  const pele = this.pele, keys = [...this.selected], first = keys[0], id = first?.slice(2); if (!pele || !id) return;
  const model = pele.parse(this.source), baseline = this.source; this.model = model;
  const unchanged = (): void => {if (this.source !== baseline) throw new Error(tr("mermaid.the_diagram_has_changed_open_the_selection_again"));};
  const prompt = (title: string, text: string, submit: (value: string, mode: LabelMode) => void, format?: LabelMode): void => {this.openDialog(new MermaidTextModal(this.app, title, text, (next, mode) => {void this.run(() => {unchanged(); submit(next, mode);});}, format, this.binding?.file ?? this.currentFile()));};
  if (command === 'shape-picker' || command === 'edge-picker') {
   this.openDialog(new MermaidChoiceModal(this.app, command === 'shape-picker' ? tr("mermaid.choose_shape") : tr("mermaid.choose_connection"), pele, command === 'shape-picker' ? shapeChoices(isMind(model)) : edgeChoices(), next => {void this.run(() => {unchanged(); this.perform(command === 'shape-picker' ? 'shape' : 'edge-type', next);});})); return;
  }
  if (command === 'direction-picker') {this.openDirection(id); return;}
  if (isFlow(model) && command.startsWith('link-')) {
   if (command === 'link-remove') this.commit(flowNodeLink(this.source, model, pele, id, 'remove'));
   else if (command === 'link-note') prompt(tr("labels.link_note_note_name_becomes_node_text"), labelText(model.nodes.get(id)?.text ?? id), name => this.commit(flowNodeLink(this.source, model, pele, id, 'note', name)));
   else prompt(tr("labels.link_web_address"), model.nodes.get(id)?.link ?? 'https://', url => this.commit(flowNodeLink(this.source, model, pele, id, 'url', url)));
   return;
  }
  if (command === 'rename') {
   if (isFlow(model)) {
    const group = model.subgraphs.find(g => g.id === id);
    if (group) prompt(tr("labels.name_subgraph"), labelText(group.title), (title, mode) => {const copy = {...model, subgraphs: model.subgraphs.map(g => g.id === id ? {...g, title, labelType: mode === 'markdown' ? 'markdown' : 'string'} : g)}; const candidate = moveToGroup(this.source, copy, [], ''); assertGroupRewrite(pele, model, candidate); this.commit(candidate);}, group.labelType === 'markdown' ? 'markdown' : 'text');
    else {const node = model.nodes.get(id); if (!node) throw new Error(tr("mermaid.select_a_node")); prompt(tr("mermaid.edit_node_text"), labelText(node.text ?? id), (text, mode) => this.commit(editFlowNode(this.source, id, text, undefined, mode)), node.labelType === 'markdown' ? 'markdown' : 'text');}
   } else if (isMind(model)) {const line = mindLines(this.source, model).find(l => l.node.nodeId === id); if (!line) return;
    prompt(tr("mermaid.edit_node_text"), labelText(line.node.descr), (text, mode) => {this.commitMindEdit(editMindNode(this.source, model, id, text, undefined, mode), model);}, mindLabelMode(this.source, line));
   }
  } else if (command === 'shape') {
   let candidate = this.source; for (const key of keys.filter(k => k.startsWith('n:'))) candidate = isFlow(model) ? editFlowNode(candidate, key.slice(2), undefined, value) : isMind(model) ? editMindNode(candidate, model, key.slice(2), undefined, Number(value)) : candidate;
   if (isMind(model)) this.commitMindEdit(candidate, model); else this.commit(candidate);
  } else if (isMind(model) && command === 'mind-child') this.commit(addMindChild(this.source, model, id));
  else if (isMind(model) && (command === 'mind-before' || command === 'mind-after')) this.commit(addMindSibling(this.source, model, id, command === 'mind-before' ? 'before' : 'after'));
  else if (isMind(model) && (command === 'mind-up' || command === 'mind-down')) this.commit(reorderMindBranch(this.source, model, id, command === 'mind-up' ? -1 : 1));
  else if (command === 'group-new' && isFlow(model)) prompt(tr("labels.name_new_subgraph"), 'Subgraph', title => {
   const ids = keys.filter(k => !k.startsWith('e:')).map(k => k.slice(2)), parent = parents(model), enclosing = parent.get(ids[0]!);
   this.moveGroup(ids, '', {id: freshId(flowIds(model), 'gruppe'), title, parent: ids.every(id => parent.get(id) === enclosing) ? enclosing : undefined});
  });
  else if (command === 'group-move' && isFlow(model)) this.moveGroup(keys.filter(k => !k.startsWith('e:')).map(k => k.slice(2)), value ?? '');
  else if (command === 'group-dissolve' && isFlow(model)) {
   if (model.edges.some(e => e.start === id || e.end === id)) throw new Error(tr("mermaid.this_subgraph_has_its_own_connections_redirect_them_in_the_source"));
   this.moveGroup([], '', undefined, id); this.selected.clear();
  } else if (command === 'color' && isMind(model)) this.openDialog(new MermaidColorModal(this.app, color => {void this.run(() => {
   unchanged();
   const slots = new Set(model.nodes.filter(n => keys.includes('n:' + n.nodeId) && !n.isRoot).map(n => 'cScale' + ((n.section ?? 0) % 8 + 1))); this.commit(mindmapColors(this.source, [...slots], color));
  });}));
  else if (command === 'color' && isFlow(model)) this.openDialog(new MermaidColorModal(this.app, color => {void this.run(() => {
   unchanged(); const property = value ?? 'fill';
   const candidate = flowColor(this.source, keys.filter(k => !k.startsWith('e:')).map(k => k.slice(2)), property, color);
   this.commit(flowEdgeColor(candidate, model, model.edges.flatMap((e, i) => keys.includes('e:' + e.id) ? [i] : []), property, color));
  });}));
  else if ((command === 'edge-label' || command === 'edge-type') && isFlow(model)) {
   const index = model.edges.findIndex(e => e.id === id), edge = model.edges[index]; if (!edge) return;
   if (command === 'edge-label') prompt(tr("labels.label_connection"), labelText(edge.text), (text, mode) => this.commit(changeFlowEdge(this.source, model, pele, index, {text, labelType: mode === 'markdown' ? 'markdown' : 'string'})), edge.labelType === 'markdown' ? 'markdown' : 'text');
   else this.commit(changeFlowEdge(this.source, model, pele, index, value === 'dotted' || value === 'thick' ? {stroke: value, type: 'arrow_point'} : {type: value, stroke: 'normal'}));
  } else if (command === 'delete') {
   if (isFlow(model)) {
    if (keys.length === 1 && first?.startsWith('g:')) {this.perform('group-dissolve'); return;}
    if (keys.some(k => k.startsWith('g:'))) throw new Error(tr("mermaid.select_and_dissolve_each_subgraph_separately_with_delete"));
    this.commit(deleteFlowItems(this.source, model, pele, new Set(keys.filter(k => k.startsWith('n:')).map(k => k.slice(2))), new Set(model.edges.flatMap((e, i) => keys.includes('e:' + e.id) ? [i] : []))));
   }
   else if (isMind(model)) {let candidate = this.source; const lines = mindLines(this.source, model); for (const line of lines.filter(l => keys.includes('n:' + l.node.nodeId) || keys.includes('m:' + l.node.nodeId)).reverse()) {const parsed = pele.parse(candidate); if (isMind(parsed) && parsed.nodes.some(n => n.nodeId === line.node.nodeId)) candidate = deleteMindBranch(candidate, parsed, line.node.nodeId);} this.commit(candidate);}
   this.selected.clear();
  } else if (command === 'duplicate') {
   if (isFlow(model)) {const node = model.nodes.get(id); if (node) {const copy = freshId(flowIds(model)); let candidate = appendSource(this.source, `${copy}[${quoted(node.text ?? id)}]`); if (node.type) candidate = editFlowNode(candidate, copy, undefined, ({square: 'rect', round: 'rounded'} as Record<string, string>)[node.type] ?? node.type); if (node.styles.length) candidate = appendSource(candidate, `style ${copy} ${node.styles.join(',')}`); if (node.classes.length) candidate = appendSource(candidate, `class ${copy} ${node.classes.join(',')}`); const parent = parents(model).get(id), parsed = pele.parse(candidate); if (parent && isFlow(parsed)) candidate = moveToGroup(candidate, parsed, [copy], parent); this.commit(candidate);}}
   else if (isMind(model)) {const line = mindLines(this.source, model).find(l => l.node.nodeId === id); if (!line || line.node.isRoot) throw new Error(tr("mermaid.the_mindmap_root_cannot_be_duplicated")); const copy = this.source.slice(line.from, line.end), used = model.nodes.map(n => n.nodeId); let duplicate = copy; for (const child of mindLines(this.source, model).filter(l => l.from >= line.from && l.from < line.end).reverse()) {const newid = freshId(used); used.push(newid); const rel = child.from - line.from + child.indent.length; duplicate = duplicate.slice(0, rel) + newid + duplicate.slice(rel + child.node.nodeId.length);} this.commit(this.source.slice(0, line.end).trimEnd() + '\n' + duplicate.trimEnd() + '\n' + this.source.slice(line.end));}
  }
 }
 private commitMindEdit(candidate: string, before: import('./types').MindModel): void {
  if (!this.pele) return; const after = this.pele.parse(candidate);
  if (!isMind(after) || after.nodes.length !== before.nodes.length || new Set(after.nodes.map(n => n.nodeId)).size !== after.nodes.length || JSON.stringify(after.nodes.map(n => n.children.map(c => c.id))) !== JSON.stringify(before.nodes.map(n => n.children.map(c => c.id)))) throw new Error(tr("mermaid.this_label_would_change_the_tree_structure_or_node_ids_use"));
  const selected = before.nodes.flatMap((node, index) => this.selected.has('n:' + node.nodeId) ? ['n:' + after.nodes[index]!.nodeId] : []);
  this.commit(candidate); this.render(); this.select(selected);
 }
 private openDirection(group?: string, event?: MouseEvent): void {
  if (!this.pele) return; const model = this.pele.parse(this.source); if (!isFlow(model)) return;
  const baseline = this.source, selected = group ? model.subgraphs.find(g => g.id === group)?.dir : (model as unknown as {direction?: string}).direction;
  this.directionMenu?.hide(); const menu = this.directionMenu = new Menu(), apply = (value: string): void => {void this.run(() => {if (this.source !== baseline) throw new Error(tr("mermaid.the_diagram_has_changed_select_it_again")); this.commit(flowDirection(this.source, model, value, group));});};
  if (group && hasOutsideConnection(model, group)) {menu.addItem(item => item.setTitle(tr("mermaid.external_connections_pele_uses_the_parent_direction")).setDisabled(true)); menu.addSeparator();}
  if (group) menu.addItem(item => item.setTitle(tr("mermaid.inherit_from_parent_graph")).setIcon('corner-up-left').setChecked(!selected).onClick(() => apply('')));
  for (const [value, label, icon] of [['TD', tr("labels.top_bottom"), 'arrow-down'], ['BT', tr("labels.bottom_top"), 'arrow-up'], ['LR', tr("labels.left_right"), 'arrow-right'], ['RL', tr("labels.right_left"), 'arrow-left']]) menu.addItem(item => item.setTitle(label! + ' (' + value + ')').setIcon(icon!).setChecked((selected === 'TB' ? 'TD' : selected) === value).onClick(() => apply(value!)));
  if (event) menu.showAtMouseEvent(event); else {const rect = this.toolbar.getBoundingClientRect(); menu.showAtPosition({x: rect.left, y: rect.bottom});}
 }
 private toggleFullscreen(): void {
  if (this.fullscreen) {this.fullscreen.close(); return;}
  const parent = this.root.parentElement!, next = this.root.nextSibling;
  const mount = (modal: Modal): void => {modal.setTitle(tr("mermaid.mermaid")); modal.modalEl.addClass('em-mm-fullscreen'); modal.contentEl.append(this.root); this.diagram?.refresh();};
  const restore = (): void => {if (!this.disposed) {parent.insertBefore(this.root, next?.parentNode === parent ? next : null); this.diagram?.refresh();} this.fullscreen = undefined;};
  class Fullscreen extends Modal {
   onOpen(): void {mount(this);}
   onClose(): void {restore();}
  }
  this.fullscreen = new Fullscreen(this.app); this.fullscreen.open();
 }
 private openDialog(modal: Modal): void {const close = modal.onClose.bind(modal); modal.onClose = () => {this.dialogs.delete(modal); close();}; this.dialogs.add(modal); modal.open();}
 async run(action: () => unknown): Promise<void> {try {await action();} catch (error) {if (!this.disposed) {if (this.binding?.failed) {this.binding.dispose(); this.binding = undefined; void this.context();} this.error.setText(error instanceof Error ? error.message : String(error));}}}
}
