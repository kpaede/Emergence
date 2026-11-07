import type {Suggestion} from '../../types';
import {validateSuggestion} from '../../review/validator';
import {needsTargetChoice} from '../../review/target-matches';
import {termDrop} from '../term-drag';
import type {PanelContext} from '../panel';
import {toggleTargetChoice} from './target-status';

export function ideaReady(ctx: PanelContext): boolean {
 const c = ctx.controller, a = c.review.analysis;
 return !!a && a.source === c.activePath && a.status === 'complete' && !c.abort && !c.applyingIdea && !c.profilePromptSave && !ctx.state.analysis.ideaEdit;
}
export function ideaBlockers(s: Suggestion, field: string, ctx: PanelContext): string[] {
 return validateSuggestion({...s, field, property: field}, ctx.controller.graph.snapshot, '', ctx.controller.profile)
  .filter(issue => issue.level === 'block').map(issue => issue.message);
}
export function renderIdeaFields(host: HTMLElement, ctx: PanelContext): void {
 const c = ctx.controller, a = c.review.analysis;
 const pending = a?.source === c.activePath ? a.suggestions.filter(s => s.status === 'pending') ?? [] : [];
 const state = ctx.state.analysis;
 if (!pending.some(s => s.id === state.selectedIdea)) state.selectedIdea = undefined;
 const selected = pending.find(s => s.id === state.selectedIdea);
 const fields = c.analysisFields.filter(field => !a?.associative || a.source !== c.activePath || a.fields?.includes(field));
 const box = host.createDiv({cls: 'em-idea-fields', attr: {'aria-label': 'Breadcrumbs-Felder zum Zuordnen'}});
 box.createDiv({text: selected ? 'Feld für den ausgewählten Begriff wählen' : 'Begriffe auf ein Feld ziehen oder erst Begriff, dann Feld auswählen.', cls: 'em-muted em-caption'});
 const list = box.createDiv({cls: 'em-idea-field-targets'});
 for (const field of fields) {
  const target = list.createEl('button', {text: field, cls: 'em-idea-field-target', attr: {type: 'button', 'data-idea-field': field, 'aria-label': `${field}: Begriff zuordnen`}});
  target.disabled = !ideaReady(ctx);
  target.title = c.graph.snapshot.rules[field]?.description ?? field;
  const assign = (s: Suggestion) => {
   if (!ideaReady(ctx)) return;
   if (needsTargetChoice(s)) {toggleTargetChoice(s, ctx); return;}
   void ctx.run(async () => {await c.applyIdea(s.id, field); state.selectedIdea = undefined;});
  };
  if (selected) {
   const blockers = ideaBlockers(selected, field, ctx);
   if (blockers.length && !needsTargetChoice(selected)) {target.disabled = true; target.title = blockers.join('\n');}
  }
  target.onclick = () => {if (selected) assign(selected);};
  termDrop(target, term => term.kind === 'idea' && term.analysis === a?.id && term.source === c.activePath && ideaReady(ctx)
   && pending.some(s => s.id === term.id && !needsTargetChoice(s) && !ideaBlockers(s, field, ctx).length), term => {
    if (term.kind === 'idea') {const s = pending.find(s => s.id === term.id); if (s) assign(s);}
   });
 }
 if (!fields.length) box.createDiv({text: 'Breadcrumbs-Felder im Frontmatter ergänzen.', cls: 'em-muted em-caption'});
}
