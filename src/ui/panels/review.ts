import {t as tr,dateTime} from '../../i18n';
import {button, ConfirmModal, input, select} from '../helpers';
import {badge, disclosure, emptyState, noteContext, pagination, title, type PanelContext} from '../panel';
import {renderSuggestion} from './review-card';
import {renderFieldIdeas, renderIdeaContext} from './field-ideas';
import {renderIdeaFields} from './idea-fields';

export async function renderReview(ctx: PanelContext): Promise<void> {
 const {host, controller: c, state: {review: s}} = ctx, a = c.review.analysis;
 if (a?.perField || a?.associative) {
  host.addClass('em-analysis-compact'); title(host, tr("common.field_ideas"));
  renderIdeaContext(host, a.source); if(a.associative)renderIdeaFields(host, ctx); renderFieldIdeas(host, ctx); return;
 }
 title(host, tr("fieldIdeas.review_suggestions"), tr("fieldIdeas.decide_on_each_suggestion_first_then_confirm_the_comparison_of_changes"));
 if (!a) {
  const empty = emptyState(host, 'clipboard-check', tr("fieldIdeas.nothing_to_review_yet"), tr("fieldIdeas.analyze_a_note_first_all_suggestions_start_unreviewed"));
  button(empty, tr("labels.go_to_analysis"), () => ctx.navigate('analysis')).addClass('mod-cta'); renderJournal(ctx); return;
 }
 noteContext(host, a.source, tr("labels.analyzed_note"));
 const source = c.app.vault.getFileByPath(a.source), content = source ? await c.app.vault.read(source) : '';
 if (!ctx.isCurrent()) return;
 const pending = a.suggestions.filter(v => v.status === 'pending').length, accepted = a.suggestions.filter(v => v.status === 'accepted').length;
 const progress = host.createDiv({cls: 'em-review-progress'});
 progress.createEl('progress', {attr: {max: String(Math.max(1, a.suggestions.length)), value: String(a.suggestions.length - pending), 'aria-label': tr("fieldIdeas.individually_reviewed_suggestions")}});
 const numbers = progress.createDiv({cls: 'em-stat-line'}); badge(numbers, tr("common.unreviewed_2", {value1: pending}), 'pending'); badge(numbers, tr("messages.acceptedCount",{count:accepted}), 'accepted'); badge(numbers, tr("messages.rejectedCount",{count:a.suggestions.length-pending-accepted}));
 if (a.status !== 'complete') host.createDiv({text: tr("fieldIdeas.this_analysis_is_incomplete_or_cancelled_results_are_readable_applying_them"), cls: 'em-message'});
 const controls = host.createDiv({cls: 'em-search-controls'});
 const search = input(controls, tr("fieldIdeas.search_suggestions"), s.query, value => {s.query = value; s.page = 0; draw();}) as HTMLInputElement; search.type = 'search';
 select(controls, tr("labels.show"), {all: tr("fieldIdeas.all_suggestions"), pending: tr("common.unreviewed"), accepted: tr("labels.accepted"), rejected: tr("labels.rejected")}, s.status, value => {s.status = value; s.page = 0; draw();});
 const list = host.createDiv(), paging = host.createDiv();
 const draw = () => {
  list.empty(); paging.empty();
  const suggestions = c.review.analysis?.suggestions.filter(v => (s.status === 'all' || v.status === s.status) && `${v.target} ${v.field} ${v.reason}`.toLocaleLowerCase().includes(s.query.toLocaleLowerCase())) ?? [];
  s.page = Math.min(s.page, Math.max(0, Math.ceil(suggestions.length / 6) - 1));
  if (!suggestions.length) emptyState(list, 'list-filter', tr("fieldIdeas.no_suggestions_in_this_view"), tr("fieldIdeas.change_the_filter_or_start_a_new_analysis"));
  for (const suggestion of suggestions.slice(s.page * 6, s.page * 6 + 6)) renderSuggestion(list, suggestion, content, ctx);
  pagination(paging, suggestions.length, s.page, 6, page => {s.page = page; draw();});
 }; draw();
 const other = disclosure(host, tr("fieldIdeas.more_review_actions"));
 button(other, tr("fieldIdeas.reject_unreviewed_suggestions", {value1: pending}), () => {c.review.rejectPending(); ctx.repaint();}, pending === 0);
 const finalize = host.createDiv({cls: 'em-finalize'});
 finalize.createDiv({text: pending ? tr("messages.pendingDecision",{count:pending}) : accepted ? tr("messages.readyCompare",{count:accepted}) : tr("fieldIdeas.no_changes_selected"), cls: 'em-muted'});
 if (pending) button(finalize, tr("fieldIdeas.show_next_unreviewed_suggestion"), () => {
  const all = c.review.analysis?.suggestions ?? [], next = all.find(v => v.status === 'pending');
  if (next) {s.query = ''; s.status = 'pending'; s.page = 0; s.expanded = next.id; ctx.repaint();}
 });
 else button(finalize, tr("fieldIdeas.view_changes"), () => {void ctx.run(async () => {
  const preview = await c.writer.preview();
  new ConfirmModal(c.app, tr("fieldIdeas.confirm_additions", {value1: preview.changes.length}), preview.beforeFrontmatter, preview.afterFrontmatter,
   async () => {await c.writer.apply(preview.token, true); ctx.repaint();}, () => c.writer.invalidate()).open();
 });}, accepted === 0 || a.status !== 'complete').addClass('mod-cta');
 renderJournal(ctx);
}
function renderJournal(ctx: PanelContext): void {
 const {controller: c} = ctx;
 if (!c.writer.journal.length) return;
 const journal = disclosure(ctx.host, tr("fieldIdeas.change_history", {value1: c.writer.journal.length}));
 for (const entry of [...c.writer.journal].reverse()) {
  const row = journal.createDiv({cls: 'em-journal-row'});
  row.createDiv({text: entry.path, cls: 'em-path'}); row.createDiv({text: `${dateTime(new Date(entry.time))} · ${entry.status === 'undone' ? tr("fieldIdeas.undone") : entry.status === 'refresh-failed' ? tr("labels.refresh_failed") : tr("fieldIdeas.applied")}`, cls: 'em-muted'});
  button(row, tr("fieldIdeas.view_undo"), () => {void ctx.run(async () => {
   const preview = await c.writer.undoPreview(entry.id);
   new ConfirmModal(c.app, tr("fieldIdeas.confirm_undo"), preview.before, preview.after,
    async () => {await c.writer.undo(entry.id, preview.before, true); ctx.repaint();}, undefined, tr("fieldIdeas.confirm_undo")).open();
  });}, entry.status === 'undone');
 }
}
