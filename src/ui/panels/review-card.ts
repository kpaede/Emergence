import {t as tr} from '../../i18n';
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
 const relation = card.createDiv({cls: 'em-relation-line'}); badge(relation, s.field || tr("labels.relation_is_missing"));
 relation.createSpan({text: s.targetKind === 'existing' ? tr("labels.existing_note") : tr("common.not_created_yet"), cls: 'em-muted'});
 if (s.target.includes('/')) card.createDiv({text: s.target, cls: 'em-path', attr: {title: s.target}});
 if (s.contract !== 'breadcrumbs-v2' && s.reason) card.createDiv({text: s.reason, cls: 'em-reason'});
 const details = disclosure(card, s.contract === 'breadcrumbs-v2' ? tr("fieldIdeas.source_location_and_verification") : tr("fieldIdeas.text_evidence_and_verification"), ctx.state.review.expanded === s.id);
 details.ontoggle = () => {if (details.open) ctx.state.review.expanded = s.id;};
 details.createEl('blockquote', {text: s.evidence});
 if (s.contract !== 'breadcrumbs-v2') details.createDiv({text: tr("fieldIdeas.qualitative_evidence_not_a_statistical_probability", {value1: evidenceLabel[s.confidence]}), cls: 'em-muted'});
 else details.createDiv({text: s.evidenceSource === 'title' ? tr("labels.source_note_title") : tr("labels.source_note_text"), cls: 'em-muted'});
 const planned = details.createDiv({cls: 'em-planned-change'}); planned.createEl('small', {text: tr("fieldIdeas.planned_addition")}); planned.createEl('code', {text: `${s.property || tr("labels.target_field_missing")}: ${s.value}`});
 const blockers = issues.filter(i => i.level === 'block'), warnings = issues.filter(i => i.level === 'warn');
 if (blockers.length) {
  card.createDiv({text: tr("fieldIdeas.not_ready_for_approval_yet"), cls: 'em-error em-caption'});
  const reasons = disclosure(details, `${blockers.length} ${blockers.length === 1 ? tr("labels.blocking_error") : tr("labels.blocking_errors")}`, true);
  for (const issue of blockers) reasons.createDiv({text: issue.message, cls: 'em-error'});
 }
 for (const issue of warnings) details.createDiv({text: `${issue.message}${issue.path ? '\n' + issue.path.join(' → ') : ''}`, cls: 'em-muted em-caption'});
 const actions = card.createDiv({cls: 'em-actions em-decision-actions'});
 button(actions, s.status === 'accepted' ? tr("labels.accepted") : tr("labels.accept"), () => {void ctx.run(() => c.review.decide(s.id, 'accepted', c.graph.snapshot, source, c.profile));}, blockers.length > 0 || c.review.analysis?.status !== 'complete' || s.status === 'accepted').dataset.emFocus = `accept-${s.id}`;
 button(actions, s.status === 'rejected' ? tr("labels.rejected") : tr("labels.reject"), () => {c.review.decide(s.id, 'rejected', c.graph.snapshot, source, c.profile); ctx.repaint();}, s.status === 'rejected').dataset.emFocus = `reject-${s.id}`;
 iconButton(actions, 'pencil', tr("fieldIdeas.edit_this_suggestion"), () => new SuggestionEditor(s, ctx).open());
}
export class SuggestionEditor extends Modal {
 constructor(private suggestion: Suggestion, private context: PanelContext) {super(context.controller.app);}
 onOpen(): void {
  const c = this.context.controller, s = this.suggestion;
  const compact = !!c.review.analysis?.perField;
  this.setTitle(compact ? tr("fieldIdeas.edit_idea") : tr("fieldIdeas.edit_suggestion")); this.modalEl.addClass('em-edit-modal');
  if (!compact) this.contentEl.createEl('p', {text: tr("fieldIdeas.changes_reset_the_suggestion_to_unreviewed_they_do_not_apply_anything")});
  let target = s.target, kind = s.targetKind, field = s.field, property = s.property, value = s.value;
  const destination = input(this.contentEl, tr("labels.target_path"), target, v => {target = v; value = `[[${v.replace(/\.md$/u, '')}]]`; valueInput.value = value;});
  destination.setAttribute('placeholder', tr("labels.folder_concept_md"));
  select(this.contentEl, tr("labels.target_status"), {existing: tr("labels.existing_note"), unresolved: tr("fieldIdeas.new_wiki_link")}, kind, v => {kind = v as typeof kind;});
  const fields = c.review.analysis?.perField ? c.analysisFieldsFor(s.source) : c.graph.snapshot.fields;
  select(this.contentEl, tr("fieldIdeas.field"), Object.fromEntries(fields.map(f => [f, f])), field, v => {field = v; property = s.contract === 'breadcrumbs-v2' ? v : c.graph.snapshot.rules[v]?.targetProperty ?? ''; propertyInput.value = property;});
  const advanced = disclosure(this.contentEl, tr("fieldIdeas.check_write_target_and_wiki_link"));
  const propertyInput = input(advanced, tr("graph.frontmatter_field"), property, v => {property = v;});
  const valueInput = input(advanced, tr("labels.suggested_value"), value, v => {value = v;});
  const buttons = this.contentEl.createDiv({cls: 'modal-button-container'});
  button(buttons, tr("common.cancel"), () => this.close());
  button(buttons, compact ? tr("mermaid.save") : tr("fieldIdeas.save_change_for_review"), () => {
   c.review.edit(s.id, {target, targetKind: kind, field, property, value}); this.context.state.review.expanded = s.id; this.close(); this.context.repaint();
  }).addClass('mod-cta');
 }
}
