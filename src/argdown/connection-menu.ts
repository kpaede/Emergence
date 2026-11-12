import {t as tr} from '../i18n';
import {Component, setIcon} from 'obsidian';
import {kindOf, relationOptions, strictMode, type ConnectionChoice, type DragRelation} from './relations';
import {nodeKey, type ArgdownModel} from './model';
export interface ConnectionRequest {model: ArgdownModel; origin: string; kind: DragRelation; point: {x: number; y: number}; apply(choice: ConnectionChoice): Promise<void>}
/** A handle adds a reason or objection for the selected origin. */
export class ArgdownConnectionMenu extends Component {
 readonly root: HTMLElement;
 private request?: ConnectionRequest;
 private busy = false;
 constructor(host: HTMLElement) {super(); this.root = host.createDiv({cls: 'em-ad-connection-menu', attr: {role: 'dialog', 'aria-label': tr("argdown.create_relation")}}); this.root.hidden = true;}
 onload(): void {
  this.registerDomEvent(this.root.ownerDocument, 'pointerdown', event => {if (!this.root.hidden && event.target instanceof Node && !this.root.contains(event.target)) this.hide();}, {capture: true});
  this.registerDomEvent(this.root, 'keydown', event => {
   if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); this.hide(true);}
   if (event.key === 'Tab' && !this.busy) {
    const controls = [...this.root.querySelectorAll<HTMLElement>('button:not(:disabled)')], first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && event.target === first) {event.preventDefault(); last?.focus();} else if (!event.shiftKey && event.target === last) {event.preventDefault(); first?.focus();}
   }
  });
  const resize = new ResizeObserver(() => {if (!this.root.hidden) this.position();});
  if (this.root.parentElement) resize.observe(this.root.parentElement);
  this.register(() => {resize.disconnect(); this.request = undefined; this.root.remove();});
 }
 open(request: ConnectionRequest): void {this.request = request; this.busy = false; this.root.hidden = false; this.render(); this.root.querySelector<HTMLElement>('[data-node-kind]:not(:disabled)')?.focus();}
 hide(focus = false): void {this.root.hidden = true; this.request = undefined; if (focus) this.root.parentElement?.querySelector<HTMLElement>('.em-ad-preview')?.focus({preventScroll: true});}
 private position(): void {
  if (!this.request) return; const bounds = this.root.parentElement!.getBoundingClientRect();
  this.root.style.setProperty('left', Math.max(4, Math.min(bounds.width - this.root.offsetWidth - 4, this.request.point.x - bounds.left)) + 'px');
  this.root.style.setProperty('top', Math.max(4, Math.min(bounds.height - this.root.offsetHeight - 4, this.request.point.y - bounds.top)) + 'px');
 }
 private render(): void {
  const request = this.request; if (!request) return;
  const origin = request.model.nodes.find(node => nodeKey(node) === request.origin); if (!origin) {this.hide(); return;}
  this.root.empty(); const heading = this.root.createDiv({cls: 'em-ad-connection-heading'});
  heading.createEl('strong', {text: tr("argdown.which_element_are_you_adding")});
  const close = heading.createEl('button', {cls: 'clickable-icon', attr: {'aria-label': tr("argdown.close_selection")}}); setIcon(close, 'x'); close.onclick = () => this.hide(true);
  const option = relationOptions('argument', kindOf(origin), strictMode(request.model)).find(item => item.kind === request.kind)!;
  this.root.createEl('small', {text: request.kind === 'attack' ? tr("argdown.the_new_element_attacks", {value1: (origin.title ?? '')}) : tr("argdown.the_new_element", {value1: option.verb, value2: (origin.title ?? '')}), cls: 'em-muted'});
  const types = this.root.createDiv({cls: 'em-ad-choice-row', attr: {role: 'group', 'aria-label': tr("argdown.new_element")}});
  for (const [kind, label, description, icon] of [['statement', tr("argdown.statement_2"), tr("argdown.a_claim"), 'message-square'], ['argument', tr("argdown.argument_2"), tr("argdown.a_reason"), 'square']] as const) {
   const allowed = relationOptions(kind, kindOf(origin)).some(item => item.kind === request.kind);
   const button = types.createEl('button', {attr: {'data-node-kind': kind}}); setIcon(button.createSpan(), icon);
   const text = button.createSpan(); text.createEl('strong', {text: label}); text.createEl('small', {text: description});
   button.disabled = !allowed; if (!allowed) button.title = tr("argdown.an_undercut_targets_an_argument");
   button.onclick = () => {void this.apply(request, {nodeKind: kind});};
  }
  if (request.kind === 'undercut' && kindOf(origin) !== 'argument') this.root.createEl('small', {text: tr("argdown.an_undercut_challenges_an_argument_s_inference_a_statement_cannot_be"), cls: 'em-muted'});
  this.position();
 }
 private async apply(request: ConnectionRequest, choice: ConnectionChoice): Promise<void> {
  if (this.busy) return; this.busy = true; for (const control of this.root.querySelectorAll('button')) control.disabled = true;
  try {await request.apply(choice); if (this.request === request) this.hide(true);}
  catch (error) {if (this.request === request) this.root.createDiv({text: error instanceof Error ? error.message : String(error), cls: 'em-error', attr: {role: 'status'}});}
  finally {this.busy = false; for (const control of this.root.querySelectorAll('button')) control.disabled = false;}
 }
}
