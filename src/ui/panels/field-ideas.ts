import {button} from '../helpers';
import {badge, disclosure, iconButton, type PanelContext} from '../panel';
import {validateSuggestion} from '../../review/validator';
import {beginIdeaEdit, renderIdeaEditor} from './idea-editor';
import {needsTargetChoice} from '../../review/target-matches';
import {renderTargetStatus, renderTargetChoices, toggleTargetChoice} from './target-status';

export function renderIdeaContext(host: HTMLElement, path: string): void {
 host.createDiv({text: path.split('/').at(-1)?.replace(/\.md$/u, '') || 'Keine Notiz geöffnet', cls: 'em-idea-context', attr: {title: path}});
}

/** Compact, field-first decisions. A click applies one link; no batch approval is required. */
export function renderFieldIdeas(host: HTMLElement, ctx: PanelContext): void {
 const c = ctx.controller; c.review.refreshTargets(c.graph.snapshot);
 const a = c.review.analysis; if (!a?.perField) return;
 const pending = a.suggestions.filter(s => s.status === 'pending');
 if (ctx.state.analysis.targetChoice && !pending.some(s => s.id === ctx.state.analysis.targetChoice)) ctx.state.analysis.targetChoice = undefined;
 if (ctx.state.analysis.ideaEdit && !pending.some(s => s.id === ctx.state.analysis.ideaEdit?.id)) ctx.state.analysis.ideaEdit = undefined;
 const editing = !!ctx.state.analysis.ideaEdit;
 const status = pending.length ? `${pending.length} offene Ideen` : 'Keine offenen Ideen';
 host.createDiv({text: `${status}${a.elapsedMs === undefined ? '' : ` · ${Math.round(a.elapsedMs / 1000)} s`}`, cls: 'em-muted em-idea-summary', attr: {role: 'status', 'aria-live': 'polite'}});
 if(a.diagnostics?.sourceMode==='overview')host.createDiv({text:`Arbeitszusammenfassung · ${a.diagnostics.sourceParts??1} Teile`,cls:'em-muted em-caption'});
 if (a.status !== 'complete') badge(host, a.status === 'partial' ? 'Unvollständig' : 'Abgebrochen', 'warning');
 for (const error of a.errors) host.createDiv({text: error, cls: 'em-error'});
 for (const field of a.fields ?? [...new Set(a.suggestions.map(s => s.field))]) {
  const ideas = pending.filter(s => s.field === field);
  const group = disclosure(host, field, ideas.length > 0, `ideas-${a.id}-${field}`); group.addClass('em-idea-group');
  const summary = group.querySelector('summary')!;
  summary.createSpan({text: String(ideas.length), cls: 'em-idea-count'});
  summary.setAttribute('aria-label', `${field}: ${ideas.length} offene Ideen`);
  if (!ideas.length) group.createDiv({text: 'Keine offenen Ideen.', cls: 'em-muted em-caption'});
  for (const s of ideas) {
   const row = group.createDiv({cls: 'em-idea-row', attr: {'data-idea-id': s.id}});
   if (renderIdeaEditor(row, s, ctx)) continue;
   const name = row.createDiv({cls: 'em-idea-name'});
   renderTargetStatus(name, row, s, ctx);
   const choosing = needsTargetChoice(s);
   const blockers = validateSuggestion(s, c.graph.snapshot, '', c.profile).filter(i => i.level === 'block');
   const accept = iconButton(row, 'check', choosing ? 'Vorhandene Zielnotiz auswählen' : `Übernehmen: ${s.field} → ${s.target}`, () => {if (choosing) toggleTargetChoice(s, ctx); else void ctx.run(() => c.applyIdea(s.id));});
   accept.addClass('em-idea-accept'); accept.disabled = !!c.abort || c.applyingIdea || !!c.profilePromptSave || editing || a.status !== 'complete' || a.source !== c.activePath || !choosing && blockers.length > 0;
   accept.dataset.emFocus = `idea-accept-${s.id}`;
   if (blockers.length && !choosing) accept.title = blockers.map(b => b.message).join('\n');
   const reject = iconButton(row, 'x', `Ablehnen: ${s.target}`, () => {void ctx.run(() => c.rejectIdea(s.id));}); reject.disabled = c.applyingIdea || editing; reject.dataset.emFocus = `idea-reject-${s.id}`;
   const edit = iconButton(row, 'pencil', `Begriff bearbeiten: ${s.target}`, () => beginIdeaEdit(s, ctx)); edit.disabled = c.applyingIdea || !!c.abort || editing; edit.dataset.emFocus = `idea-edit-${s.id}`;
   renderTargetChoices(row, s, ctx);
  }
 }
 renderIdeaUndo(host, ctx);
}
export function renderIdeaUndo(host: HTMLElement, ctx: PanelContext): void {
 const c = ctx.controller;
 const entry = [...c.writer.journal].reverse().find(e => e.path === c.activePath && e.status !== 'undone' && e.changes.length === 1);
 if (!entry) return;
 const row = host.createDiv({cls: 'em-idea-undo'}), change = entry.changes[0]!;
 row.createSpan({text: `Zuletzt ergänzt: ${change.target.split('/').at(-1)!.replace(/\.md$/u, '')}`, cls: 'em-muted em-caption'});
 button(row, 'Rückgängig', () => {void ctx.run(() => c.undoIdea(entry.id));}, c.applyingIdea || !!c.abort);
}
