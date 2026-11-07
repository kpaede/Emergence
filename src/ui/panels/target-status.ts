import type {Suggestion} from '../../types';
import {targetTitle} from '../../review/wikilink';
import {badge, iconButton, type PanelContext} from '../panel';
import {needsTargetChoice} from '../../review/target-matches';

export function toggleTargetChoice(s: Suggestion, ctx: PanelContext): void {
 ctx.state.analysis.targetChoice = ctx.state.analysis.targetChoice === s.id ? undefined : s.id; ctx.repaint();
}
export function renderTargetStatus(name: HTMLElement, row: HTMLElement, s: Suggestion, ctx: PanelContext): void {
 const existing = s.targetKind === 'existing', multiple = (s.targetCandidates?.length ?? 0) > 1;
 row.dataset.targetKind = existing ? 'existing' : 'new';
 const label = s.targetLabel && multiple && !s.targetSelected ? s.targetLabel : targetTitle(s.target);
 const title = name.createEl(existing && !needsTargetChoice(s) ? 'a' : 'span', {text: label, cls: `em-idea-target-title${existing ? ' is-existing' : ''}`});
 if (title instanceof HTMLAnchorElement) {
  title.href = '#'; title.dataset.href = s.target; title.addClass('internal-link');
  title.onclick = event => {event.preventDefault(); void ctx.run(async () => {
   const file = ctx.controller.app.vault.getFileByPath(s.target); if (file) await ctx.controller.app.workspace.getLeaf('tab').openFile(file);
  });};
 }
 if (multiple) {
  const show = name.createEl('button', {text: `${s.targetCandidates!.length} Notizen`, cls: 'em-target-match-count', attr: {type: 'button', 'aria-label': `Vorhandene Notizen für ${label} auswählen`, 'aria-expanded': String(ctx.state.analysis.targetChoice === s.id)}});
  show.onclick = () => toggleTargetChoice(s, ctx); show.disabled = !!ctx.state.analysis.ideaEdit;
 } else {
  const status = badge(name, existing ? 'Vorhanden' : 'Neu'); status.addClass(existing ? 'em-target-existing' : 'em-target-new');
 }
}
export function renderTargetChoices(row: HTMLElement, s: Suggestion, ctx: PanelContext): void {
 if ((s.targetCandidates?.length ?? 0) < 2 || ctx.state.analysis.targetChoice !== s.id) return;
 const choices = row.createDiv({cls: 'em-target-choices'});
 choices.createDiv({text: 'Mehrere vorhandene Notizen · mögliche Dubletten', cls: 'em-muted em-caption'});
 for (const path of s.targetCandidates!) {
  const choice = choices.createDiv({cls: 'em-target-choice'});
  const select = choice.createEl('button', {text: path.replace(/\.md$/u, ''), cls: 'em-target-option', attr: {type: 'button', 'aria-pressed': String(!!s.targetSelected && s.target === path)}});
  select.onclick = () => {void ctx.run(() => {ctx.controller.chooseIdeaTarget(s.id, path); ctx.state.analysis.targetChoice = undefined;});};
  select.disabled = ctx.controller.applyingIdea || !!ctx.controller.abort;
  iconButton(choice, 'arrow-up-right', `Notiz öffnen: ${path}`, () => {void ctx.run(async () => {
   const file = ctx.controller.app.vault.getFileByPath(path); if (file) await ctx.controller.app.workspace.getLeaf('tab').openFile(file);
  });});
 }
}
