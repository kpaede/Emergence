import {Modal} from 'obsidian';
import type {Suggestion} from '../../types';
import {validateSuggestion} from '../../review/validator';
import {button, input, select} from '../helpers';
import {badge, decisionLabel, disclosure, evidenceLabel, iconButton, type PanelContext} from '../panel';

export function renderSuggestion(parent: HTMLElement, s: Suggestion, source: string, ctx: PanelContext): void {
 const c = ctx.controller, issues = validateSuggestion(s, c.graph.snapshot, source, c.profile);
 const card = parent.createDiv({cls: 'em-suggestion', attr: {'data-suggestion-id': s.id, 'data-decision': s.status}});
 const heading = card.createDiv({cls: 'em-suggestion-heading'});
 heading.createDiv({text: `${s.field} → [[${s.target.split('/').at(-1)?.replace(/\.md$/u, '') ?? s.target}]]`, cls: 'em-concept-title'});
 badge(heading, decisionLabel[s.status], s.status);
 const relation = card.createDiv({cls: 'em-relation-line'}); badge(relation, s.field || 'Beziehung fehlt');
 relation.createSpan({text: s.targetKind === 'existing' ? 'Vorhandene Notiz' : 'Noch nicht angelegt', cls: 'em-muted'});
 if (s.target.includes('/')) card.createDiv({text: s.target, cls: 'em-path', attr: {title: s.target}});
 if (s.contract !== 'breadcrumbs-v2' && s.reason) card.createDiv({text: s.reason, cls: 'em-reason'});
 const details = disclosure(card, s.contract === 'breadcrumbs-v2' ? 'Ausgangsstelle und Prüfung' : 'Textbeleg und Prüfung', ctx.state.review.expanded === s.id);
 details.ontoggle = () => {if (details.open) ctx.state.review.expanded = s.id;};
 details.createEl('blockquote', {text: s.evidence});
 if (s.contract !== 'breadcrumbs-v2') details.createDiv({text: `Qualitative Evidenz: ${evidenceLabel[s.confidence]}. Keine statistische Wahrscheinlichkeit.`, cls: 'em-muted'});
 else details.createDiv({text: s.evidenceSource === 'title' ? 'Ausgangsstelle: Notiztitel' : 'Ausgangsstelle: Notiztext', cls: 'em-muted'});
 const planned = details.createDiv({cls: 'em-planned-change'}); planned.createEl('small', {text: 'Geplante Ergänzung'}); planned.createEl('code', {text: `${s.property || '(Zielfeld fehlt)'}: ${s.value}`});
 const blockers = issues.filter(i => i.level === 'block'), warnings = issues.filter(i => i.level === 'warn');
 if (blockers.length) {
  card.createDiv({text: 'Noch nicht freigabefähig', cls: 'em-error em-caption'});
  const reasons = disclosure(details, `${blockers.length} ${blockers.length === 1 ? 'Blockierender Fehler' : 'Blockierende Fehler'}`, true);
  for (const issue of blockers) reasons.createDiv({text: issue.message, cls: 'em-error'});
 }
 for (const issue of warnings) details.createDiv({text: `${issue.message}${issue.path ? '\n' + issue.path.join(' → ') : ''}`, cls: 'em-muted em-caption'});
 const actions = card.createDiv({cls: 'em-actions em-decision-actions'});
 button(actions, s.status === 'accepted' ? 'Akzeptiert' : 'Akzeptieren', () => {void ctx.run(() => c.review.decide(s.id, 'accepted', c.graph.snapshot, source, c.profile));}, blockers.length > 0 || c.review.analysis?.status !== 'complete' || s.status === 'accepted').dataset.emFocus = `accept-${s.id}`;
 button(actions, s.status === 'rejected' ? 'Abgelehnt' : 'Ablehnen', () => {c.review.decide(s.id, 'rejected', c.graph.snapshot, source, c.profile); ctx.repaint();}, s.status === 'rejected').dataset.emFocus = `reject-${s.id}`;
 iconButton(actions, 'pencil', 'Diesen Vorschlag bearbeiten', () => new SuggestionEditor(s, ctx).open());
}
export class SuggestionEditor extends Modal {
 constructor(private suggestion: Suggestion, private context: PanelContext) {super(context.controller.app);}
 onOpen(): void {
  const c = this.context.controller, s = this.suggestion;
  const compact = !!c.review.analysis?.perField;
  this.setTitle(compact ? 'Idee bearbeiten' : 'Vorschlag bearbeiten'); this.modalEl.addClass('em-edit-modal');
  if (!compact) this.contentEl.createEl('p', {text: 'Änderungen setzen den Vorschlag zurück auf „Ungeprüft“. Sie übernehmen noch nichts in deine Notiz.'});
  let target = s.target, kind = s.targetKind, field = s.field, property = s.property, value = s.value;
  const destination = input(this.contentEl, 'Zielpfad', target, v => {target = v; value = `[[${v.replace(/\.md$/u, '')}]]`; valueInput.value = value;});
  destination.setAttribute('placeholder', 'Ordner/Begriff.md');
  select(this.contentEl, 'Zielstatus', {existing: 'Vorhandene Notiz', unresolved: 'Neuer Wikilink'}, kind, v => {kind = v as typeof kind;});
  const fields = c.review.analysis?.perField ? c.analysisFieldsFor(s.source) : c.graph.snapshot.fields;
  select(this.contentEl, 'Feld', Object.fromEntries(fields.map(f => [f, f])), field, v => {field = v; property = s.contract === 'breadcrumbs-v2' ? v : c.graph.snapshot.rules[v]?.targetProperty ?? ''; propertyInput.value = property;});
  const advanced = disclosure(this.contentEl, 'Schreibziel und Wiki-Link prüfen');
  const propertyInput = input(advanced, 'Frontmatter-Feld', property, v => {property = v;});
  const valueInput = input(advanced, 'Vorgeschlagener Wert', value, v => {value = v;});
  const buttons = this.contentEl.createDiv({cls: 'modal-button-container'});
  button(buttons, 'Abbrechen', () => this.close());
  button(buttons, compact ? 'Speichern' : 'Änderung zur Prüfung speichern', () => {
   c.review.edit(s.id, {target, targetKind: kind, field, property, value}); this.context.state.review.expanded = s.id; this.close(); this.context.repaint();
  }).addClass('mod-cta');
 }
}
