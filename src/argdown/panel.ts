import {t as tr} from '../i18n';
import {Component, sanitizeHTMLToDom, MarkdownView, Menu, Modal, type App, type TFile} from 'obsidian';
import {showDiagramMenu} from '../diagrams/menu';
import {iconButton,relabelIcon} from '../ui/panel';
import {MermaidBinding, noteText} from '../mermaid/binding';
import {MermaidCodeEditor} from '../mermaid/code-editor';
import {MermaidHistory} from '../mermaid/history';
import {MermaidLibraryMenu, libraryTrigger} from '../mermaid/library-menu';
import type {MermaidLibrary} from '../mermaid/library';
import {MermaidTextModal} from '../mermaid/dialogs';
import {ARGDOWN_LANGUAGE, argdownStart, argdownBlocks, argdownFence} from './blocks';
import type {ArgdownEngine} from './engine';
import {isGroup, nodeKey, keysAt, sourceRanges, type ArgdownModel} from './model';
import {addNode, changeRelation, reverseRelation, connectNodes, deleteNodes, deleteRelation, graphDirection, moveToSection, nodeColor, editSection, createSection} from './actions';
import {closeSection, moveSection} from './sections';
import {argdownNodeIds, themeArgdownNodes} from './theme';
import {argdownColor} from './color';
import {addConnectedNode} from './connected-node';
import {tryFormatArgdown} from './source-layout';
import {ArgdownDiagram} from './diagram';
import {changePresentation} from './presentation';
import {ArgdownPresentationModal} from './presentation-modal';
import {readReconstruction, writeReconstruction} from './reconstruction';
import {ArgdownNavigation} from './navigation';
import {derivationScope, replaceDerivationSource, scopedRanges} from './derivation-scope';
import type {SourceSpan} from './model';
import {globalDerivation, derivationOverride, setAllDerivations, derivationMode, setArgumentDerivation, type StatementRole} from './derivation';
import {logicalTarget, logicalEdge, logicalStatementColor, editLogicalText, addLogicalObjection, addLogicalPremise, addLogicalConclusion, removeLogical} from './logical-editor';
import {ArgdownConnectionMenu} from './connection-menu';
import {kindOf, relationOptions, strictMode, type DragRelation} from './relations';
import {ArgdownInteractions} from './interactions';
import {ArgdownNodeModal} from './node-modal';
import {readNodeDraft, editNodeDraft} from './node-edit';
import {argdownLabelSource} from './label-source';
import {ArgdownColorModal} from './color-modal';
import {effectiveGraphDirection} from './direction';

export class ArgdownPanel extends Component {
 readonly root: HTMLElement; readonly stage: HTMLElement; readonly preview: HTMLElement; readonly overlay: HTMLElement; readonly toolbar: HTMLElement; readonly diagram: ArgdownDiagram;
 readonly selected = new Set<string>(); source = argdownStart(); model?: ArgdownModel;
 private engine?: ArgdownEngine; private loading?: Promise<void>; private editor: MermaidCodeEditor; private history = new MermaidHistory(this.source); private binding?: MermaidBinding;
 private error: HTMLElement; private status: HTMLElement; private insertButton: HTMLButtonElement; private undoButton: HTMLButtonElement; private redoButton: HTMLButtonElement;
 private renderTimer?: number; private saveTimer?: number; private externalTimer?: number; private generation = 0; private session = 0; private disposed = false; private active = false;
 private fullscreen?: Modal; private dialogs = new Set<Modal>(); private menu?: Menu; private libraryMenu: MermaidLibraryMenu; private interactions: ArgdownInteractions;
 private connectionMenu: ArgdownConnectionMenu; private navigation: ArgdownNavigation; private focus?: string; private codeScope?: SourceSpan; private overviewSelection: string[] = []; private hovered?: string; private pendingLogical?: StatementRole; private selectionOrigin: 'code' | 'diagram' = 'diagram'; private codePosition = 0;
 private relabel:()=>void=()=>{};
 private enabled=true;
 constructor(readonly app: App, host: HTMLElement, private currentFile: () => TFile | undefined, library: MermaidLibrary) {
  super(); this.root = host.createDiv({cls: 'em-mermaid em-argdown'});
  const top = this.root.createDiv({cls: 'em-mm-top'}), tools = top.createDiv({cls: 'em-mm-tools'}), create = libraryTrigger(tools);
  this.libraryMenu = this.addChild(new MermaidLibraryMenu(this.root, create, library, {open: source => this.newDraft(source), insert: source => this.insert(source), source: () => this.source, preview: async source => {if (!this.engine) throw new Error(tr("labels.loading_argdown")); const model = this.engine.project(source), fragment = sanitizeHTMLToDom(await this.engine.svg(model)); themeArgdownNodes(fragment, model, argdownNodeIds(model)); return new XMLSerializer().serializeToString(fragment);}, validate: source => {if (!this.engine) throw new Error(tr("labels.loading_argdown")); this.engine.parse(source);}})); create.onclick = () => this.libraryMenu.toggle();
  this.undoButton = iconButton(tools, 'undo-2', tr("argdown.undo_ctrl_cmd_z"), () => this.undo()); this.redoButton = iconButton(tools, 'redo-2', tr("labels.redo_ctrl_cmd_shift_z"), () => this.redo());
  const maximize=iconButton(tools, 'maximize', tr("argdown.open_argdown_full_screen"), () => this.toggleFullscreen());
  this.status = top.createDiv({cls: 'em-mm-status', attr: {role: 'status'}});
  const context = top.createDiv({cls: 'em-mm-context'}); this.insertButton = context.createEl('button', {text: tr("argdown.insert_into_note"), cls: 'mod-cta'}); this.insertButton.onclick = () => {void this.run(() => this.insert());};
  this.navigation = this.addChild(new ArgdownNavigation(this.root, {back: () => this.showOverview(), visible: value => {if (this.focus) this.setVisible(this.focus, value);}, all: value => this.commit(model => setAllDerivations(this.engine!, model.source, value))}));
  const split = this.root.createDiv({cls: 'em-mm-split'}), code = split.createDiv({cls: 'em-mm-code'}), divider = split.createDiv({cls: 'em-mm-divider', attr: {role: 'separator', tabindex: '0', 'aria-label': tr("argdown.size_of_source_and_argument_map"), 'aria-valuemin': '20', 'aria-valuemax': '80', 'aria-valuenow': '36'}});
  this.stage = split.createDiv({cls: 'em-mm-stage'}); this.preview = this.stage.createDiv({cls: 'em-ad-preview', attr: {tabindex: '0', 'aria-label': tr("argdown.argdown_argument_map")}}); this.diagram = new ArgdownDiagram(this.preview);
  this.overlay = this.stage.createDiv({cls: 'em-mm-overlay'}); this.toolbar = this.overlay.createDiv({cls: 'em-mm-toolbar', attr: {role: 'toolbar', 'aria-label': tr("argdown.edit_argument_map")}}); this.toolbar.hidden = true;
  this.registerDomEvent(this.toolbar, 'click', () => this.activateTools(), {capture: true});
  const diagramTools = this.stage.createDiv({cls: 'em-ad-diagram-tools'});
  const createNode = diagramTools.createEl('button', {text: tr("argdown.add_element"), attr: {'aria-label': tr("argdown.add_unconnected_element"), title: tr("argdown.add_a_statement_or_argument_without_a_relation")}}); createNode.onclick = event => {this.menu?.hide(); const menu = this.menu = new Menu(); menu.addItem(item => item.setTitle(tr("argdown.add_argument")).setIcon('square').onClick(() => this.add('argument'))); menu.addItem(item => item.setTitle(tr("argdown.add_statement")).setIcon('message-square').onClick(() => this.add('statement'))); showDiagramMenu(menu, event, createNode);};
  const settings = iconButton(diagramTools, 'settings-2', tr("argdown.argument_map_appearance"), () => {const source = this.source; this.openDialog(new ArgdownPresentationModal(this.app, source, changes => Promise.resolve().then(() => {if (this.source !== source) throw new Error(tr("argdown.the_map_has_changed_open_it_again")); let candidate = changePresentation(this.engine!, source, changes); const visibility = changes.find(change => change.path.join('.') === 'model.explodeArguments'); if (visibility) candidate = setAllDerivations(this.engine!, candidate, visibility.value === true); this.setSource(candidate);}), this.engine?.parse(source)));});
  const direction = iconButton(diagramTools, 'arrow-down-up', tr("argdown.argument_map_direction"), () => {}); direction.onclick = event => this.direction(event);
  const section = iconButton(diagramTools, 'group', tr("argdown.create_group"), () => this.prompt(tr("argdown.new_group"), tr("argdown.group_2"), title => this.commit(model => createSection(this.engine!, model, new Set([...this.selected].filter(k => !k.startsWith('e:') && !k.startsWith('g:'))), title))));
  for (const control of [createNode, settings, direction, section]) control.dataset.overviewOnly = 'true';
  iconButton(diagramTools, 'scan', tr("argdown.fit_map"), () => {this.diagram.fit(); this.interactions.paint();});
  iconButton(diagramTools, 'zoom-in', tr("argdown.zoom_in"), () => {this.diagram.zoom(1.25); this.interactions.paint();}); iconButton(diagramTools, 'zoom-out', tr("argdown.zoom_out"), () => {this.diagram.zoom(0.8); this.interactions.paint();});
  this.error = this.root.createDiv({cls: 'em-mm-error em-error', attr: {role: 'status'}});
  this.root.createDiv({text: tr("argdown.hover_tools_click_select_shift_multiple_selection_double_click_edit"), cls: 'em-mm-hint'});
  this.editor = new MermaidCodeEditor(code, this.source, source => this.changeCode(source), position => this.selectFromCode(position), () => this.undo(), () => this.redo(), false, {label: tr("argdown.argdown_source"), syncSelection: true, tokens: source => this.engine?.tokens(source) ?? []});
  this.connectionMenu = this.addChild(new ArgdownConnectionMenu(this.stage));
  this.interactions = this.addChild(new ArgdownInteractions(this));
  let ratio = 36;
  const setRatio = (value: number): void => {ratio = Math.max(20, Math.min(80, value)); split.style.setProperty('--em-mm-split', ratio + '%'); divider.setAttribute('aria-valuenow', String(Math.round(ratio)));};
  divider.onpointerdown = event => {event.preventDefault(); divider.setPointerCapture(event.pointerId);}; divider.onpointermove = event => {if (divider.hasPointerCapture(event.pointerId)) {const r = split.getBoundingClientRect(); setRatio(this.root.clientWidth >= 720 ? (event.clientX - r.left) / r.width * 100 : (event.clientY - r.top) / r.height * 100);}};
  divider.onkeydown = event => {if (event.key.startsWith('Arrow')) {event.preventDefault(); setRatio(ratio + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -5 : 5));}};
  this.register(() => {this.menu?.hide(); this.editor.destroy(); this.fullscreen?.close(); for (const dialog of this.dialogs) dialog.close(); this.root.remove();}); this.context();
  this.relabel=()=>{
   relabelIcon(this.undoButton,tr('argdown.undo_ctrl_cmd_z'));relabelIcon(this.redoButton,tr('labels.redo_ctrl_cmd_shift_z'));relabelIcon(maximize,tr('argdown.open_argdown_full_screen'));this.insertButton.setText(tr('argdown.insert_into_note'));
   createNode.setText(tr('argdown.add_element'));createNode.setAttribute('aria-label',tr('argdown.add_unconnected_element'));createNode.title=tr('argdown.add_a_statement_or_argument_without_a_relation');relabelIcon(settings,tr('argdown.argument_map_appearance'));relabelIcon(direction,tr('argdown.argument_map_direction'));relabelIcon(section,tr('argdown.create_group'));
   const zoom=diagramTools.querySelectorAll<HTMLButtonElement>('button');for(const [index,key]of [[4,'argdown.fit_map'],[5,'argdown.zoom_in'],[6,'argdown.zoom_out']] as const)if(zoom[index])relabelIcon(zoom[index],tr(key));
   divider.setAttribute('aria-label',tr('argdown.size_of_source_and_argument_map'));this.preview.setAttribute('aria-label',tr('argdown.argdown_argument_map'));this.toolbar.setAttribute('aria-label',tr('argdown.edit_argument_map'));this.root.querySelector('.em-mm-hint')?.setText(tr('argdown.hover_tools_click_select_shift_multiple_selection_double_click_edit'));this.editor.setLabel(tr('argdown.argdown_source'));
  };
 }
 refreshLanguage():void{this.menu?.hide();this.connectionMenu.hide();this.relabel();this.libraryMenu.refreshLanguage();this.context();this.updateNavigation();this.paint();}
 setEnabled(value:boolean):void{this.enabled=value;if(!value){this.menu?.hide();this.connectionMenu.hide();this.libraryMenu.hide();this.fullscreen?.close();}}
 onload(): void {
  this.registerDomEvent(this.root, 'keydown', event => {
   if (this.editor.view.dom.contains(event.target as Node) || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
   if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {event.preventDefault(); event.stopImmediatePropagation(); if (event.shiftKey || event.key.toLowerCase() === 'y') this.redo(); else this.undo();}
   if ((this.preview.contains(event.target as Node) || this.overlay.contains(event.target as Node)) && ['Delete', 'Backspace'].includes(event.key)) {event.preventDefault(); event.stopImmediatePropagation(); this.remove();}
  }, {capture: true});
  const schedule = (): void => {if (this.externalTimer) window.clearTimeout(this.externalTimer); this.externalTimer = window.setTimeout(() => {this.externalTimer = undefined; void this.run(() => this.refreshExternal());}, 180);};
  this.registerEvent(this.app.workspace.on('editor-change', schedule)); this.registerEvent(this.app.vault.on('modify', file => {if (file === this.binding?.file) schedule();}));
  this.register(() => {this.disposed = true; this.generation++; if (this.renderTimer) window.clearTimeout(this.renderTimer); if (this.externalTimer) window.clearTimeout(this.externalTimer); void this.flush().catch(() => {}).finally(() => this.binding?.dispose());});
 }
 async activate(): Promise<void> {
  if(!this.enabled)return;
  this.active = true; this.loading ??= import('./engine').then(({ArgdownEngine}) => {if (!this.disposed) {this.engine = new ArgdownEngine(); this.editor.highlight([]); return this.render();} return undefined;}).catch((error: unknown) => {this.loading = undefined; this.error.setText(String(error));});
  await this.loading; this.context(); this.interactions.paint();
 }
 context(): void {this.status.setText(this.binding ? tr("argdown.map", {value1: this.binding.file.basename, value2: (this.binding.index + 1)}) : tr("argdown.draft_not_inserted_yet")); this.insertButton.parentElement!.hidden = !!this.binding; this.insertButton.disabled = !this.currentFile(); this.undoButton.disabled = !this.history.canUndo; this.redoButton.disabled = !this.history.canRedo;}
 async openBlock(file: TFile, index: number): Promise<void> {
  const session = ++this.session; await this.flush(); const note = await noteText(this.app, file), block = argdownBlocks(note)[index]; if (session !== this.session || this.disposed) return; if (!block) throw new Error(tr("argdown.the_argdown_map_no_longer_exists"));
  this.binding?.dispose(); this.binding = new MermaidBinding(this.app, file, note, block, ARGDOWN_LANGUAGE); await this.reset(block.source);
 }
 async newDraft(source = argdownStart()): Promise<void> {const session = ++this.session; await this.flush(); if (session !== this.session || this.disposed) return; this.binding?.dispose(); this.binding = undefined; await this.reset(source);}
 private async reset(source: string): Promise<void> {this.selectionOrigin = 'diagram'; this.codePosition = 0; this.interactions.reset(); this.menu?.hide(); this.connectionMenu.hide(); this.focus = undefined; this.codeScope = undefined; this.hovered = undefined; this.source = source; this.history = new MermaidHistory(source); this.selected.clear(); this.syncCode(); await this.activate(); await this.render(); this.context();}
 async insert(source = this.source): Promise<void> {
  const file = this.currentFile(); if (!file) throw new Error(tr("argdown.open_a_markdown_note_first")); await this.flush();
  const editor = this.app.workspace.getLeavesOfType('markdown').map(l => l.view).find((view): view is MarkdownView => view instanceof MarkdownView && view.file?.path === file.path)?.editor; if (!editor) throw new Error(tr("argdown.open_the_target_note_in_the_editor"));
  const position = editor.getCursor('to'), offset = editor.posToOffset(position), before = offset && editor.getValue()[offset - 1] !== '\n' ? '\n\n' : '\n'; editor.replaceRange(before + argdownFence(source) + '\n', position);
  const block = argdownBlocks(editor.getValue()).find(b => b.from >= offset && b.from <= offset + before.length); if (!block) throw new Error(tr("argdown.the_inserted_map_could_not_be_matched")); await this.openBlock(file, block.index);
 }
 private setSource(source: string, typing = false, record = true): void {
  this.menu?.hide(); this.connectionMenu.hide(); if (!typing && record && this.engine && source !== this.source) source = tryFormatArgdown(this.engine, source); this.source = source; if (record) this.history.push(source, typing); this.syncCode(); this.context();
  if (this.renderTimer) window.clearTimeout(this.renderTimer); this.renderTimer = window.setTimeout(() => {this.renderTimer = undefined; void this.run(() => this.render());}, typing ? 180 : 0);
  if (this.binding) {if (this.saveTimer) window.clearTimeout(this.saveTimer); this.saveTimer = window.setTimeout(() => {this.saveTimer = undefined; void this.run(() => this.binding?.save(this.source));}, 160);}
 }
 async flush(): Promise<void> {await this.libraryMenu.library.flush().catch(() => {}); if (this.saveTimer) {window.clearTimeout(this.saveTimer); this.saveTimer = undefined; await this.binding?.save(this.source);} await this.binding?.pending;}
 async refreshExternal(): Promise<void> {const binding = this.binding; if (!binding || this.saveTimer) return; await binding.pending; const source = await binding.refresh(); if (binding === this.binding && source !== undefined && source !== this.source) {this.source = source; this.history.push(source); this.syncCode(); await this.render(); this.context();}}
 private async render(): Promise<void> {
  if (!this.engine || this.disposed) return; const generation = ++this.generation, source = this.source;
  try {const parsed = this.engine.parse(source); if (this.focus && !parsed.response.arguments?.[this.focus]?.pcs.length) {this.focus = undefined; this.codeScope = undefined;} const model = this.engine.project(source, this.focus), svg = await this.engine.svg(model); if (generation !== this.generation || source !== this.source || this.disposed) return;
   this.model = model; this.syncCode(); this.diagram.set(svg, model); this.error.empty(); this.updateNavigation(model.response.emergenceDerivation!.base);
   for (const [key, role] of model.response.emergenceDerivation?.inferences ?? []) {const el = this.diagram.element(key); if (el) {const text = tr("argdown.inference_to_statement", {value1: role.argument, value2: (role.conclusion + 1)}); el.setAttribute('aria-label', text); const title = el.querySelector('title'); if (title) title.textContent = text;}}
   if (this.pendingLogical) {const role = this.pendingLogical, key = [...(model.response.emergenceDerivation?.statements ?? [])].find(([,roles]) => roles.some(item => item.argument === role.argument && item.index === role.index))?.[0]; this.selected.clear(); if (key) this.selected.add(key); this.pendingLogical = undefined;}
   for (const key of this.selected) if (!this.diagram.element(key)) this.selected.delete(key);
   if (this.selectionOrigin === 'code') this.selectFromCode(this.codePosition); else this.paint();
  } catch (error) {if (generation === this.generation && !this.disposed) {this.model = undefined; this.updateNavigation(); this.error.setText(String(error)); this.selected.clear(); this.toolbar.hidden = true; this.editor.highlight([]); this.interactions.paint();}}
 }
 select(keys: string[], additive = false, reveal = true, origin: 'code' | 'diagram' = 'diagram'): void {this.selectionOrigin = origin;if (!additive) this.selected.clear(); for (const key of keys) {if (additive && this.selected.has(key)) this.selected.delete(key); else this.selected.add(key);} this.paint(); if (this.model) this.editor.highlight(scopedRanges(sourceRanges(this.model, this.selected), this.codeScope), reveal);}
 private selectFromCode(position: number): void {
  this.selectionOrigin = 'code'; this.codePosition = position; if (this.model?.source !== this.source) return;
  const keys = keysAt(this.model, position + (this.codeScope?.from ?? 0)); this.select(keys, false, false, 'code'); if (keys[0]) this.diagram.reveal(keys[0]); this.interactions.paint();
 }
 hover(key?: string): void {if (this.hovered === key) return; this.hovered = key; this.paint();}
 toolKeys(): ReadonlySet<string> {return this.hovered ? this.selected.has(this.hovered) ? this.selected : new Set([this.hovered]) : new Set();}
 activateTools(): void {this.selectionOrigin = 'diagram'; if (this.hovered && !this.selected.has(this.hovered)) {this.selected.clear(); this.selected.add(this.hovered);}}
 private paint(): void {
  this.toolbar.empty(); const tools = this.toolKeys(), first = [...tools][0], model = this.model;
  if (first && model) {
   const logical = logicalTarget(model, first), logicalKeys = [...tools].map(key => logicalTarget(model, key));
   if (!this.focus && (logical || first.startsWith('d:'))) {this.derivationTools(logical?.argument ?? first.slice(2));}
   else if (logical && logicalKeys.every(Boolean)) {
    if (tools.size === 1) {
     iconButton(this.toolbar, 'palette', tr("argdown.choose_color"), () => this.logicalColor(logical));
     iconButton(this.toolbar, 'pencil', logical.inference ? tr("argdown.edit_inference_rule") : tr("argdown.edit_statement"), () => this.edit());
     const reference = iconButton(this.toolbar, 'link', logical.inference ? tr("argdown.use_existing_statement_as_conclusion") : tr("argdown.use_existing_statement"), () => {}); reference.onclick = event => this.logicalReference(event, logical, reference);

    } else this.toolbar.createSpan({text: tr("argdown.selected", {value1: tools.size}), cls: 'em-mm-selection-count'});
    if (logicalKeys.every(item => item?.argument === logical.argument && !item.inference)) iconButton(this.toolbar, 'git-merge', tr("argdown.infer_from_selected_statements"), () => this.logicalConclusion());
    if (!this.focus) this.derivationTools(logical.argument);
   } else if (first.startsWith('e:') && logicalEdge(model, first)) {
    const edge = logicalEdge(model, first)!; this.toolbar.createSpan({text: edge.premise === undefined ? tr("argdown.conclusion_of_inferential_step") : tr("argdown.premise_of_inferential_step"), cls: 'em-mm-selection-count'}); if (!this.focus) this.derivationTools(edge.argument);
   } else {
    if (tools.size > 1) {this.toolbar.createSpan({text: tr("argdown.selected", {value1: tools.size}), cls: 'em-mm-selection-count'}); if ([...tools].every(key => /^(s|a):/u.test(key))) iconButton(this.toolbar, 'palette', tr("argdown.choose_color"), () => this.color());}
    else if (first.startsWith('e:')) this.edgeTools(model, first);
    else if (!first.startsWith('g:')) {iconButton(this.toolbar, 'pencil', first.startsWith('a:') ? tr("argdown.edit_argument") : tr("argdown.edit_statement"), () => this.edit()); iconButton(this.toolbar, 'palette', tr("argdown.choose_color"), () => this.color()); if (first.startsWith('a:')) this.derivationTools(first.slice(2));}
    else {iconButton(this.toolbar, 'pencil', tr("argdown.rename_group"), () => this.edit()); iconButton(this.toolbar, 'palette', tr("argdown.choose_color"), () => this.color());}
    if ([...tools].every(key => !key.startsWith('e:'))) {const section = iconButton(this.toolbar, 'group', tr("argdown.choose_or_create_group"), () => {}); section.onclick = event => this.sectionMenu(event);}
   }
   const groupedEdge = first.startsWith('e:') && model.edges.some(edge => 'e:' + JSON.stringify([nodeKey(edge.from), nodeKey(edge.to), edge.relationType]) === first && (isGroup(edge.from) || isGroup(edge.to)));
   if (!groupedEdge && !first.startsWith('d:') && (this.focus || !logical && !logicalEdge(model, first))) iconButton(this.toolbar, 'trash-2', tr("labels.remove_selection"), () => this.remove());
  }
  if (model) this.editor.highlight(scopedRanges(sourceRanges(model, this.selected), this.codeScope)); this.interactions.paint();
 }
 private edgeTools(model: ArgdownModel, key: string): void {
  const edge = model.edges.find(edge => 'e:' + JSON.stringify([nodeKey(edge.from), nodeKey(edge.to), edge.relationType]) === key); if (!edge) return;
  const groups = [edge.from, edge.to].filter(isGroup);
  if (groups.length) {for (const group of groups) iconButton(this.toolbar, 'chevrons-up-down', tr("argdown.expand_group", {value1: (group.title ?? '')}), () => this.commit(m => closeSection(this.engine!, m, nodeKey(group), false))); return;}
  const kind = String(edge.relationType), reverse = relationOptions(kindOf(edge.to), kindOf(edge.from), strictMode(model));
  for (const option of relationOptions(kindOf(edge.from), kindOf(edge.to), strictMode(model))) {
   const button = iconButton(this.toolbar, option.icon, option.label, () => this.commit(() => changeRelation(this.engine!, model, key, option.kind)));
   if (option.kind === 'undercut') {button.setText('_>'); button.addClass('em-ad-undercut-icon');}
  }
  if (!['contradictory', 'contrary'].includes(kind) && reverse.some(option => option.kind === kind || option.kind === 'support' && kind === 'entails' || option.kind === 'attack' && kind === 'contrary')) iconButton(this.toolbar, 'arrow-left-right', tr("argdown.reverse_arrow", {value1: (edge.to.title ?? ''), value2: (edge.from.title ?? '')}), () => this.commit(() => reverseRelation(this.engine!, model, key)));
  const owner = [edge.from, edge.to].find(node => String(node.type) === 'argument-map-node' && model.response.arguments?.[node.title ?? '']?.pcs.length);
  if (owner) iconButton(this.toolbar, 'list-ordered', tr("argdown.edit_reconstruction"), () => this.reconstruct(nodeKey(owner)));
 }
 private commit(change: (model: ArgdownModel) => string): void {this.selectionOrigin = 'diagram'; void this.run(() => {if (!this.engine) return; const model = this.engine.parse(this.source), candidate = change(model); this.engine.parse(candidate); if ([...this.selected].some(key => key.startsWith('g:'))) this.selected.clear(); this.setSource(candidate);});}
 add(kind: 'statement' | 'argument'): void {this.commit(model => {const result = addNode(this.source, model, kind); this.selected.clear(); this.selected.add(result.key); return result.source;});}
 connect(from: string, to?: string, section?: string, point?: {x: number; y: number}, kind: DragRelation = 'support'): void {void this.run(() => {
  const engine = this.engine; if (!engine) return; const baseline = this.source, model = engine.parse(baseline);
  const logical = this.model?.source === baseline ? logicalTarget(this.model, from) : undefined;
  if (logical && !this.focus) {this.reconstruct('a:' + logical.argument); return;}
  if (logical && kind === 'support') {const added = addLogicalPremise(engine, this.model!, logical, to); this.pendingLogical = added.focus; this.setSource(added.source); return;}
  if (logical && (kind === 'attack' || kind === 'undercut')) {this.logicalObjection(logical, to, kind, point); return;}

  if (kind === 'undercut' && !from.startsWith('a:')) throw new Error(tr("argdown.an_undercut_targets_an_argument_s_inference_select_an_argument"));
  if (to) {this.connectionMenu.hide(); const candidate = connectNodes(engine, model, to, from, kind); this.setSource(candidate); return;}
  const bounds = this.diagram.element(from)?.getBoundingClientRect() ?? this.toolbar.getBoundingClientRect();
  const destination = point ? section : model.nodes.find(node => isGroup(node) && node.children?.some(child => nodeKey(child) === from));
  const scope = typeof destination === 'string' ? destination : destination ? nodeKey(destination) : undefined;
  this.connectionMenu.open({model, origin: from, kind, point: point ?? {x: bounds.left, y: bounds.bottom + 28}, apply: choice => Promise.resolve().then(() => {
   if (this.source !== baseline) throw new Error(tr("argdown.the_map_has_changed_select_it_again"));
   const added = addConnectedNode(engine, model, from, kind, choice.nodeKind, scope); this.selected.clear(); this.selected.add(added.key); this.setSource(added.source);
  })});
 });}
 move(keys: Set<string>, section: string): void {if (this.model && [...keys].some(key => logicalTarget(this.model!, key))) {this.error.setText(tr("argdown.collapse_the_reconstruction_to_move_the_entire_argument_into_a_group")); return;} this.commit(model => keys.size === 1 && [...keys][0]!.startsWith('g:') ? moveSection(this.engine!, model, [...keys][0]!, section) : moveToSection(this.engine!, model, keys, section));}
 edit(): void {
  const key = [...this.selected][0], baseline = this.source; if (!key || !this.model) return;
  if (key.startsWith('e:')) {this.error.setText(tr("argdown.edit_argdown_relations_by_type_they_have_no_free_form_labels")); return;}
  if (key.startsWith('g:')) {const node = this.model.nodes.find(n => nodeKey(n) === key); this.prompt(tr("argdown.rename_group"), node?.title ?? '', value => this.commit(model => editSection(this.engine!, model, key, value))); return;}
  const logical = logicalTarget(this.model, key);
  if (!this.focus && (logical || key.startsWith('d:'))) {this.reconstruct('a:' + (logical?.argument ?? key.slice(2))); return;}
  const base = this.engine!.parse(baseline);
  if (logical?.inference) {const step = readReconstruction(base, 'a:' + logical.argument).steps[logical.index]!;
   this.openDialog(new MermaidTextModal(this.app, tr("argdown.edit_inference_rule"), step.rule, value => {if (this.source !== baseline) {this.error.setText(tr("argdown.the_map_has_changed_open_it_again")); return;} this.commit(model => editLogicalText(this.engine!, model, logical, value));}, undefined, undefined, tr("argdown.the_inference_rule_belongs_to_this_inferential_step_connect_its_premises"))); return;
  }
  const editKey = logical ? 's:' + base.response.arguments![logical.argument]!.pcs[logical.index]!.title : key, file = this.binding?.file ?? this.currentFile();
  this.openDialog(new ArgdownNodeModal(this.app, editKey.startsWith('a:') ? 'argument' : 'statement', readNodeDraft(base, editKey), draft => {
   if (this.source !== baseline) throw new Error(tr("argdown.the_map_has_changed_open_it_again"));
   const text = argdownLabelSource(draft.text, {vault: this.app.vault.getName(), sourcePath: file?.path, resolve: path => this.app.metadataCache.getFirstLinkpathDest(path, file?.path ?? '')?.path});
   const result = editNodeDraft(this.engine!, base, editKey, {...draft, text});
   if (logical) this.pendingLogical = {argument: logical.argument, index: logical.index};
   this.selected.clear(); this.selected.add(result.key); this.hovered = undefined; this.selectionOrigin = 'diagram'; this.setSource(result.source);
  }, file));
 }

 reconstruct(key: string): void {void this.run(async () => {
  if (!this.engine) return; const model = this.engine.parse(this.source), title = logicalTarget(this.model ?? model, key)?.argument ?? key.slice(2);
  if (!model.response.arguments?.[title]) throw new Error(tr("argdown.the_argument_no_longer_exists"));
  if (!this.focus) this.overviewSelection = [...this.selected]; this.selectionOrigin = 'diagram'; this.focus = title; this.selected.clear(); this.hovered = undefined; this.interactions.reset(); this.menu?.hide();
  if (!model.response.arguments[title].pcs.length) {const reconstruction = readReconstruction(model, 'a:' + title); for (const step of reconstruction.steps) {step.title = ''; step.visible = '';} this.setSource(writeReconstruction(this.engine, model, 'a:' + title, reconstruction.steps));}
  this.pendingLogical = {argument: title, index: 0}; this.updateNavigation(model); this.syncCode(); await this.render(); this.diagram.fit(); this.interactions.paint();
 });}
 showOverview(): void {this.selectionOrigin = 'diagram'; this.hovered = undefined; this.focus = undefined; this.codeScope = undefined; this.interactions.reset(); this.connectionMenu.hide(); this.menu?.hide(); this.selected.clear(); for (const key of this.overviewSelection) this.selected.add(key); this.syncCode(); this.updateNavigation(this.model?.response.emergenceDerivation?.base); void this.run(async () => {await this.render(); this.diagram.fit(); this.interactions.paint();});}
 private setVisible(title: string, visible: boolean): void {this.commit(model => setArgumentDerivation(this.engine!, model, title, visible));}
 private derivationTools(title: string): void {
  const base = this.model?.response.emergenceDerivation?.base; if (!base) return;
  const visible = derivationOverride(base, title) ?? globalDerivation(base);
  iconButton(this.toolbar, 'log-in', tr("argdown.edit_reconstruction"), () => this.reconstruct('a:' + title));
  if (base.response.arguments?.[title]?.pcs.length) {const button = iconButton(this.toolbar, visible ? 'eye-off' : 'eye', visible ? tr("argdown.hide_reconstruction_in_main_map") : tr("argdown.show_reconstruction_in_main_map"), () => {this.selected.clear(); this.selected.add(visible ? 'a:' + title : 'd:' + title); this.setVisible(title, !visible);}); button.setAttribute('aria-pressed', String(visible));}
 }
 connectionTarget(key: string): string {return key.startsWith('d:') ? 'a:' + key.slice(2) : key;}
 canConnect(key: string): boolean {return !!this.focus || !this.model || !logicalTarget(this.model, key);}
 private updateNavigation(base?: ArgdownModel): void {
  this.navigation.update({focus: this.focus, visible: this.focus && base ? derivationOverride(base, this.focus) ?? globalDerivation(base) : false, mode: base ? derivationMode(base) : 'none', hasDerivations: Object.values(base?.response.arguments ?? {}).some(argument => argument.pcs.length), valid: !!base});
  for (const control of this.stage.querySelectorAll<HTMLElement>('[data-overview-only]')) control.hidden = !!this.focus;
  this.preview.setAttribute('aria-label', this.focus ? tr("argdown.reconstruction", {value1: this.focus}) : tr("labels.argdown_main_map"));
 }
 private syncCode(): void {
  if (this.focus && this.engine) {try {const base = this.engine.parse(this.source), scope = derivationScope(base, this.focus); if (scope) this.codeScope = scope;} catch {/* Keep the scoped editor usable while the user types incomplete syntax. */}}
  this.editor.setSource(this.codeScope && this.focus ? this.source.slice(this.codeScope.from, this.codeScope.to) : this.source);
 }
 private changeCode(code: string): void {
  if (this.focus && this.codeScope) {const scope = this.codeScope, source = replaceDerivationSource(this.source, scope, code); this.codeScope = {...scope, to: scope.from + code.length}; this.setSource(source, true);}
  else this.setSource(code, true);
 }
 private logicalConclusion(): void {const model = this.model; if (!model) return; void this.run(() => {const targets = [...this.selected].map(key => logicalTarget(model, key)).filter((target): target is NonNullable<typeof target> => !!target); const added = addLogicalConclusion(this.engine!, model, targets); this.pendingLogical = added.focus; this.setSource(added.source);});}
 private logicalColor(target: NonNullable<ReturnType<typeof logicalTarget>>): void {
  const baseline = this.source, type = target.inference ? 'argument' : 'statement';
  this.openDialog(new ArgdownColorModal(this.app, target.inference ? tr("argdown.fill_color_of_this_argument_s_inferential_steps") : tr("argdown.statement_border_color"), target.inference ? tr("argdown.font_color_of_all_arguments") : tr("argdown.font_color_of_all_statements"), (part, color) => {
   if (this.source !== baseline) return; this.commit(model => part === 'font' ? changePresentation(this.engine!, model.source, [{path: ['color', type + 'FontColor'], value: color ? argdownColor(color) : undefined}]) : target.inference ? nodeColor(this.engine!, model, 'a:' + target.argument, color ? argdownColor(color) : undefined) : logicalStatementColor(this.engine!, model, target, color ? argdownColor(color) : undefined));
  }));
 }
 private logicalReference(event: MouseEvent, target: NonNullable<ReturnType<typeof logicalTarget>>, anchor: HTMLElement, show = true): void {
  const display = this.model; if (!display) return; const base = display.response.emergenceDerivation!.base, baseline = this.source;
  const titles = new Set((base.response.tokens ?? []).flatMap(token => 'title' in token && typeof token.title === 'string' && /StatementDefinition|StatementReference/u.test(token.tokenType.name) ? [token.title] : []));
  this.menu?.hide(); const menu = this.menu = new Menu();
  if (!titles.size) menu.addItem(item => item.setTitle(tr("argdown.no_named_statements_available")).setDisabled(true));
  for (const title of titles) menu.addItem(item => item.setTitle(title).setIcon('message-square').onClick(() => {if (this.source !== baseline) return; this.commit(model => {const steps = readReconstruction(model, 'a:' + target.argument).steps, step = steps[target.index]!; if (step.title === title) return model.source; step.title = title; step.text = ''; step.reference = true; return writeReconstruction(this.engine!, model, 'a:' + target.argument, steps);});}));
  if (show) showDiagramMenu(menu, event, anchor);
 }
 private logicalObjection(target: NonNullable<ReturnType<typeof logicalTarget>>, existing: string | undefined, kind: 'attack' | 'undercut', point?: {x: number; y: number}): void {
  const display = this.model!, baseline = this.source, origin = [...this.selected][0]!, engine = this.engine!;
  const apply = (key: string, source: string): void => {if (this.source !== baseline) throw new Error(tr("argdown.the_map_has_changed"));
   const candidate = addLogicalObjection(engine, display, target, key, kind, source); this.pendingLogical = {argument: target.argument, index: target.index}; this.hovered = undefined; this.setSource(candidate);
  };
  if (existing) {apply(existing, baseline); return;}
  const bounds = this.diagram.element(origin)?.getBoundingClientRect() ?? this.toolbar.getBoundingClientRect();
  this.connectionMenu.open({model: display, origin, kind, point: point ?? {x: bounds.left, y: bounds.bottom + 28}, apply: choice => Promise.resolve().then(() => {const added = addNode(baseline, engine.parse(baseline), choice.nodeKind); apply(added.key, added.source);})});
 }
 private prompt(title: string, value: string, submit: (value: string) => void): void {const baseline = this.source; this.openDialog(new MermaidTextModal(this.app, title, value, next => {if (this.source === baseline) submit(next); else this.error.setText(tr("argdown.the_map_has_changed_select_it_again"));}));}
 private sectionMenu(event: MouseEvent, show = true): void {
  const model = this.model; if (!model) return; this.menu?.hide(); const menu = this.menu = new Menu(), keys = new Set(this.selected), baseline = this.source;
  const apply = (change: (model: ArgdownModel) => string): void => {if (this.source === baseline) this.commit(change);};
  menu.addItem(item => item.setTitle(tr("argdown.create_new_group")).setIcon('group').onClick(() => this.prompt(tr("argdown.new_group"), tr("argdown.group_2"), title => apply(m => createSection(this.engine!, m, new Set([...keys].filter(k => !k.startsWith('g:'))), title, [...keys].find(k => k.startsWith('g:')))))));
  if (![...keys].some(k => k.startsWith('g:'))) for (const group of model.nodes.filter(isGroup)) menu.addItem(item => item.setTitle(tr("argdown.move_into", {value1: (group.title ?? tr("argdown.group_2"))})).onClick(() => apply(m => moveToSection(this.engine!, m, keys, nodeKey(group)))));
  if (keys.size === 1 && [...keys][0]!.startsWith('g:')) {
   const key = [...keys][0]!, group = model.nodes.find(node => nodeKey(node) === key);
   if (group && isGroup(group)) {
    menu.addItem(item => item.setTitle(group.isClosed ? tr("argdown.expand_group_2") : tr("argdown.collapse_group")).setIcon(group.isClosed ? 'chevrons-up-down' : 'chevrons-down-up').onClick(() => apply(m => closeSection(this.engine!, m, key, !group.isClosed))));
    for (const target of model.nodes.filter(isGroup).filter(node => nodeKey(node) !== key)) menu.addItem(item => item.setTitle(tr("argdown.move_group_into", {value1: (target.title ?? '')})).onClick(() => apply(m => moveSection(this.engine!, m, key, nodeKey(target)))));
    if (group.section?.parent) menu.addItem(item => item.setTitle(tr("argdown.move_group_to_top_level")).onClick(() => apply(m => moveSection(this.engine!, m, key))));
   }
   menu.addItem(item => item.setTitle(tr("argdown.dissolve_group")).setIcon('ungroup').onClick(() => apply(m => editSection(this.engine!, m, key))));
  }
  if (show) showDiagramMenu(menu, event, this.toolbar.querySelector<HTMLElement>("[aria-label=" + JSON.stringify(tr("argdown.choose_or_create_group")) + "]") ?? this.toolbar);
 }
 private color(): void {
  const keys = [...this.selected].filter(key => /^(s|a|g):/u.test(key)), baseline = this.source; if (!keys.length) return;
  const types = [...new Set(keys.map(key => key.startsWith('s:') ? 'statement' : key.startsWith('a:') ? 'argument' : 'group'))], type = types.length === 1 ? types[0] : undefined;
  this.openDialog(new ArgdownColorModal(this.app, type === 'statement' ? tr("argdown.statement_border_color_2") : type === 'argument' ? tr("argdown.argument_fill_color") : type === 'group' ? tr("argdown.group_fill_color") : tr("labels.element_colors"), type === 'statement' ? tr("argdown.font_color_of_all_statements") : type === 'argument' ? tr("argdown.font_color_of_all_arguments") : type === 'group' ? tr("argdown.font_color_of_all_groups") : tr("argdown.font_color_of_all_selected_element_types"), (part, color) => {
   if (this.source !== baseline) return; this.commit(model => {if (part === 'font') return changePresentation(this.engine!, model.source, types.map(value => ({path: ['color', value + 'FontColor'], value: color ? argdownColor(color) : undefined})));
    let current = model; for (const key of keys) current = this.engine!.parse(nodeColor(this.engine!, current, key, color ? argdownColor(color) : undefined)); return current.source;
   });
  }));
 }
 remove(): void {if (!this.focus && this.model) {const first = [...this.selected][0]; if (first?.startsWith('d:')) {this.setVisible(first.slice(2), false); return;} const logical = first ? logicalTarget(this.model, first) : undefined; if (logical) {this.reconstruct('a:' + logical.argument); return;}} if (this.model && [...this.selected].some(key => logicalTarget(this.model!, key) || logicalEdge(this.model!, key))) {const display = this.model; this.commit(() => {const source = removeLogical(this.engine!, display, this.selected); this.selected.clear(); return source;}); return;} this.commit(model => {if (this.selected.size === 1 && [...this.selected][0]!.startsWith('g:')) return editSection(this.engine!, model, [...this.selected][0]!);let candidate = this.source; for (const key of this.selected) if (key.startsWith('e:')) candidate = deleteRelation(this.engine!, this.engine!.project(candidate, this.focus), key); const nodes = new Set([...this.selected].filter(key => !key.startsWith('e:'))); if (nodes.size) candidate = deleteNodes(this.engine!, this.engine!.parse(candidate), nodes); this.selected.clear(); return candidate;});}
 undo(): void {const source = this.history.undo(); if (source !== undefined) this.setSource(source, false, false);}
 redo(): void {const source = this.history.redo(); if (source !== undefined) this.setSource(source, false, false);}
 private direction(event: MouseEvent): void {
  this.menu?.hide();const current=effectiveGraphDirection(this.model),menu=this.menu=new Menu();
  menu.addItem(item=>item.setTitle(tr('argdown.arrow_direction_help')).setDisabled(true));
  for(const [value,label,icon]of [['TB',tr('argdown.arrows_top_bottom'),'arrow-down'],['BT',tr('argdown.arrows_bottom_top'),'arrow-up'],['LR',tr('argdown.arrows_left_right'),'arrow-right'],['RL',tr('argdown.arrows_right_left'),'arrow-left']] as const)
   menu.addItem(item=>item.setTitle(label).setIcon(icon).setChecked(value===current).onClick(()=>{if(value!==current)this.commit(()=>graphDirection(this.source,value));}));
  showDiagramMenu(menu,event,this.stage.querySelector<HTMLElement>("[aria-label="+JSON.stringify(tr('argdown.argument_map_direction'))+"]")??this.stage);
 }
 private toggleFullscreen(): void {
  if (this.fullscreen) {this.fullscreen.close(); return;} const parent = this.root.parentElement!, next = this.root.nextSibling;
  const mount = (modal: Modal): void => {modal.setTitle(tr("argdown.argdown")); modal.modalEl.addClass('em-mm-fullscreen'); modal.contentEl.append(this.root); this.diagram.fit(); this.interactions.paint();};
  const restore = (): void => {this.fullscreen = undefined; if (!this.disposed) {parent.insertBefore(this.root, next?.parentNode === parent ? next : null); this.diagram.fit(); this.interactions.paint();}};
  class Fullscreen extends Modal {onOpen(): void {mount(this);} onClose(): void {restore();}}
  this.fullscreen = new Fullscreen(this.app); this.fullscreen.open();
 }
 private openDialog(modal: Modal): void {const close = modal.onClose.bind(modal); modal.onClose = () => {this.dialogs.delete(modal); close();}; this.dialogs.add(modal); modal.open();}
 async run(action: () => unknown): Promise<void> {try {await action();} catch (error) {if (!this.disposed) {if (this.binding?.failed) {this.binding.dispose(); this.binding = undefined; this.context();} this.error.setText(error instanceof Error ? error.message : String(error));}}}
}
