import {t as tr} from '../../i18n';
import {button} from '../helpers';
import {badge, disclosure, iconButton, type PanelContext} from '../panel';
import {validateSuggestion} from '../../review/validator';
import {beginIdeaEdit, renderIdeaEditor} from './idea-editor';
import {needsTargetChoice} from '../../review/target-matches';
import {renderTargetStatus, renderTargetChoices, toggleTargetChoice} from './target-status';
import {termHandle} from '../term-drag';
import {ideaReady} from './idea-fields';

export function renderIdeaContext(host: HTMLElement, path: string): void {
 host.createDiv({text: path.split('/').at(-1)?.replace(/\.md$/u, '') || tr("common.no_note_open"), cls: 'em-idea-context', attr: {title: path}});
}

/** New analyses share one unassigned pool; older in-session analyses stay usable. */
export function renderFieldIdeas(host: HTMLElement, ctx: PanelContext): void {
 const c = ctx.controller; c.review.refreshTargets(c.graph.snapshot);
 const a = c.review.analysis; if (!a?.perField && !a?.associative) return;
 const pending = a.suggestions.filter(s => s.status === 'pending');
 if (ctx.state.analysis.targetChoice && !pending.some(s => s.id === ctx.state.analysis.targetChoice)) ctx.state.analysis.targetChoice = undefined;
 if (ctx.state.analysis.ideaEdit && !pending.some(s => s.id === ctx.state.analysis.ideaEdit?.id)) ctx.state.analysis.ideaEdit = undefined;
 const editing = !!ctx.state.analysis.ideaEdit;
 const status = pending.length ? tr("messages.openIdeas",{count:pending.length}) : tr("fieldIdeas.no_pending_ideas");
 host.createDiv({text: `${status}${a.elapsedMs === undefined ? '' : ` · ${Math.round(a.elapsedMs / 1000)} s`}`, cls: 'em-muted em-idea-summary', attr: {role: 'status', 'aria-live': 'polite'}});
 if(a.diagnostics?.sourceMode==='overview')host.createDiv({text:tr("messages.summaryParts",{count:a.diagnostics.sourceParts??1}),cls:'em-muted em-caption'});
 if (a.status !== 'complete') badge(host, a.status === 'partial' ? tr("fieldIdeas.incomplete") : tr("labels.cancelled"), 'warning');
 for (const error of a.errors) host.createDiv({text: error, cls: 'em-error'});
 for (const field of a.associative ? [''] : a.fields ?? [...new Set(a.suggestions.map(s => s.field))]) {
  const ideas = a.associative ? pending : pending.filter(s => s.field === field);
  const group = a.associative ? host.createDiv({cls: 'em-idea-pool', attr: {'aria-label': tr("fieldIdeas.unassigned_concepts")}}) : disclosure(host, field, ideas.length > 0, `ideas-${a.id}-${field}`);
  if (!a.associative) {group.addClass('em-idea-group');const summary = group.querySelector('summary')!;
   summary.createSpan({text: String(ideas.length), cls: 'em-idea-count'});summary.setAttribute('aria-label', tr("messages.fieldIdeas",{field,count:ideas.length}));}
  if (!ideas.length) group.createDiv({text: tr("fieldIdeas.no_pending_ideas_2"), cls: 'em-muted em-caption'});
  for (const s of ideas) {
   const row = group.createDiv({cls: 'em-idea-row', attr: {'data-idea-id': s.id}});
   if (renderIdeaEditor(row, s, ctx)) continue;
   if (a.associative) {
    row.addClass('em-idea-unassigned');
    const selected = ctx.state.analysis.selectedIdea === s.id; if (selected) row.addClass('em-idea-selected');
    const handle = termHandle(row, tr("fieldIdeas.drag_concept_or_select_it_to_assign", {value1: s.target}), {kind: 'idea', id: s.id, analysis: a.id, source: a.source}, ideaReady(ctx) && !needsTargetChoice(s), () => {
     ctx.state.analysis.selectedIdea = selected ? undefined : s.id; ctx.repaint();
    });
    handle.setAttribute('aria-pressed', String(selected)); handle.dataset.emFocus = `idea-select-${s.id}`;
   }
   const name = row.createDiv({cls: 'em-idea-name'});
   renderTargetStatus(name, row, s, ctx);
   const choosing = needsTargetChoice(s);
   if (!a.associative || choosing) {
    const blockers = validateSuggestion(s, c.graph.snapshot, '', c.profile).filter(i => i.level === 'block');
    const accept = iconButton(row, choosing ? 'list' : 'check', choosing ? tr("fieldIdeas.select_existing_target_note") : tr("fieldIdeas.apply", {value1: s.field, value2: s.target}), () => {if (choosing) toggleTargetChoice(s, ctx); else void ctx.run(() => c.applyIdea(s.id));});
    accept.addClass('em-idea-accept'); accept.disabled = !ideaReady(ctx) || !choosing && blockers.length > 0;
    accept.dataset.emFocus = `idea-accept-${s.id}`;
    if (blockers.length && !choosing) accept.title = blockers.map(b => b.message).join('\n');
   }
   const reject = iconButton(row, 'x', tr("messages.rejectTarget",{target:s.target}), () => {void ctx.run(() => c.rejectIdea(s.id));}); reject.disabled = c.applyingIdea || editing; reject.dataset.emFocus = `idea-reject-${s.id}`;
   const edit = iconButton(row, 'pencil', tr("fieldIdeas.edit_concept", {value1: s.target}), () => beginIdeaEdit(s, ctx)); edit.disabled = c.applyingIdea || !!c.abort || editing; edit.dataset.emFocus = `idea-edit-${s.id}`;
   renderTargetChoices(row, s, ctx);
  }
 }
 renderIdeaUndo(host, ctx);
}
export function renderIdeaUndo(host: HTMLElement, ctx: PanelContext): void {
 const c = ctx.controller;
 const entry = [...c.writer.journal].reverse().find(e => e.path === c.activePath && e.kind !== 'move' && e.status !== 'undone' && e.changes.length === 1);
 if (!entry) return;
 const row = host.createDiv({cls: 'em-idea-undo'}), change = entry.changes[0]!;
 row.createSpan({text: tr("fieldIdeas.last_added", {value1: change.target.split('/').at(-1)!.replace(/\.md$/u, '')}), cls: 'em-muted em-caption'});
 button(row, tr("mermaid.undo"), () => {void ctx.run(() => c.undoIdea(entry.id));}, c.applyingIdea || !!c.abort);
}
