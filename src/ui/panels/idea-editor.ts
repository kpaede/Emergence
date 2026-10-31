import type {Suggestion} from '../../types';
import {errorMessage} from '../../util';
import {targetTitle} from '../../review/wikilink';
import {iconButton, type PanelContext} from '../panel';
import {needsTargetChoice} from '../../review/target-matches';

function focus(ctx: PanelContext, key: string, select = false): void {
 const node = [...ctx.host.querySelectorAll<HTMLElement>('[data-em-focus]')].find(node => node.dataset.emFocus === key);
 node?.focus({preventScroll: true});
 if (select && node instanceof HTMLInputElement) node.select();
}
export function beginIdeaEdit(s: Suggestion, ctx: PanelContext): void {
 ctx.state.analysis.ideaEdit = {id: s.id, value: needsTargetChoice(s) && s.targetLabel ? s.targetLabel : targetTitle(s.target)};
 ctx.repaint(); focus(ctx, `idea-input-${s.id}`, true);
}
/** Editing changes the pending idea only. The separate accept action writes the link. */
export function renderIdeaEditor(row: HTMLElement, s: Suggestion, ctx: PanelContext): boolean {
 const draft = ctx.state.analysis.ideaEdit;
 if (draft?.id !== s.id) return false;
 row.addClass('em-idea-editing');
 const cell = row.createDiv({cls: 'em-idea-name'});
 const editor = cell.createEl('input', {type: 'text', cls: 'em-idea-editor', attr: {'aria-label': 'Begriff bearbeiten', title: 'Enter: speichern · Esc: abbrechen'}});
 editor.value = draft.value; editor.dataset.emFocus = `idea-input-${s.id}`; editor.spellcheck = false;
 const cancel = () => {ctx.state.analysis.ideaEdit = undefined; ctx.repaint(); focus(ctx, `idea-edit-${s.id}`);};
 const save = () => {
  try {
   ctx.controller.editIdea(s.id, draft.value); ctx.state.analysis.ideaEdit = undefined;
   const updated = ctx.controller.review.analysis?.suggestions.find(idea => idea.id === s.id);
   if (updated && needsTargetChoice(updated)) ctx.state.analysis.targetChoice = s.id;
   ctx.repaint(); focus(ctx, `idea-accept-${s.id}`);
  } catch (error) {draft.error = errorMessage(error); ctx.repaint(); focus(ctx, `idea-input-${s.id}`);}
 };
 editor.oninput = () => {
  draft.value = editor.value; draft.error = undefined;
  row.querySelector('.em-idea-edit-error')?.remove(); editor.removeAttribute('aria-invalid'); editor.removeAttribute('aria-describedby');
 };
 editor.onkeydown = event => {
  if (event.isComposing) return;
  if (event.key === 'Enter') {event.preventDefault(); event.stopPropagation(); save();}
  if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); cancel();}
 };
 const confirm = iconButton(row, 'check', 'Begriff speichern', save); confirm.dataset.emFocus = `idea-save-${s.id}`;
 iconButton(row, 'x', 'Bearbeitung abbrechen', cancel);
 if (draft.error) {
  const id = `idea-error-${s.id}`;
  editor.setAttribute('aria-invalid', 'true'); editor.setAttribute('aria-describedby', id);
  row.createDiv({text: draft.error, cls: 'em-error em-idea-edit-error', attr: {id, role: 'alert'}});
 }
 return true;
}
