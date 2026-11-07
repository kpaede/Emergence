import {button, ConfirmModal, input, select} from '../helpers';
import {badge, disclosure, emptyState, noteContext, pagination, title, type PanelContext} from '../panel';
import {renderSuggestion} from './review-card';
import {renderFieldIdeas, renderIdeaContext} from './field-ideas';
import {renderIdeaFields} from './idea-fields';

export async function renderReview(ctx: PanelContext): Promise<void> {
 const {host, controller: c, state: {review: s}} = ctx, a = c.review.analysis;
 if (a?.perField || a?.associative) {
  host.addClass('em-analysis-compact'); title(host, 'Feldideen');
  renderIdeaContext(host, a.source); if(a.associative)renderIdeaFields(host, ctx); renderFieldIdeas(host, ctx); return;
 }
 title(host, 'Vorschläge prüfen', 'Erst einzeln entscheiden, dann den Änderungsvergleich bestätigen.');
 if (!a) {
  const empty = emptyState(host, 'clipboard-check', 'Noch nichts zu prüfen', 'Analysiere zuerst eine Notiz. Alle Vorschläge beginnen ungeprüft.');
  button(empty, 'Zur Analyse', () => ctx.navigate('analysis')).addClass('mod-cta'); renderJournal(ctx); return;
 }
 noteContext(host, a.source, 'Analysierte Notiz');
 const source = c.app.vault.getFileByPath(a.source), content = source ? await c.app.vault.read(source) : '';
 if (!ctx.isCurrent()) return;
 const pending = a.suggestions.filter(v => v.status === 'pending').length, accepted = a.suggestions.filter(v => v.status === 'accepted').length;
 const progress = host.createDiv({cls: 'em-review-progress'});
 progress.createEl('progress', {attr: {max: String(Math.max(1, a.suggestions.length)), value: String(a.suggestions.length - pending), 'aria-label': 'Individuell geprüfte Vorschläge'}});
 const numbers = progress.createDiv({cls: 'em-stat-line'}); badge(numbers, `${pending} ungeprüft`, 'pending'); badge(numbers, `${accepted} akzeptiert`, 'accepted'); badge(numbers, `${a.suggestions.length - pending - accepted} abgelehnt`);
 if (a.status !== 'complete') host.createDiv({text: 'Diese Analyse ist unvollständig oder abgebrochen. Die Ergebnisse sind lesbar; eine Übernahme ist gesperrt.', cls: 'em-message'});
 const controls = host.createDiv({cls: 'em-search-controls'});
 const search = input(controls, 'Vorschläge suchen', s.query, value => {s.query = value; s.page = 0; draw();}) as HTMLInputElement; search.type = 'search';
 select(controls, 'Anzeigen', {all: 'Alle Vorschläge', pending: 'Ungeprüft', accepted: 'Akzeptiert', rejected: 'Abgelehnt'}, s.status, value => {s.status = value; s.page = 0; draw();});
 const list = host.createDiv(), paging = host.createDiv();
 const draw = () => {
  list.empty(); paging.empty();
  const suggestions = c.review.analysis?.suggestions.filter(v => (s.status === 'all' || v.status === s.status) && `${v.target} ${v.field} ${v.reason}`.toLocaleLowerCase().includes(s.query.toLocaleLowerCase())) ?? [];
  s.page = Math.min(s.page, Math.max(0, Math.ceil(suggestions.length / 6) - 1));
  if (!suggestions.length) emptyState(list, 'list-filter', 'Keine Vorschläge in dieser Ansicht', 'Ändere den Filter oder starte eine neue Analyse.');
  for (const suggestion of suggestions.slice(s.page * 6, s.page * 6 + 6)) renderSuggestion(list, suggestion, content, ctx);
  pagination(paging, suggestions.length, s.page, 6, page => {s.page = page; draw();});
 }; draw();
 const other = disclosure(host, 'Weitere Prüfaktionen');
 button(other, `${pending} ungeprüfte Vorschläge ablehnen`, () => {c.review.rejectPending(); ctx.repaint();}, pending === 0);
 const finalize = host.createDiv({cls: 'em-finalize'});
 finalize.createDiv({text: pending ? `Noch ${pending} ${pending === 1 ? 'Vorschlag braucht' : 'Vorschläge brauchen'} deine Entscheidung.` : accepted ? `${accepted} ${accepted === 1 ? 'Ergänzung bereit' : 'Ergänzungen bereit'} für den Vergleich.` : 'Keine Änderungen ausgewählt.', cls: 'em-muted'});
 if (pending) button(finalize, 'Nächsten ungeprüften Vorschlag anzeigen', () => {
  const all = c.review.analysis?.suggestions ?? [], next = all.find(v => v.status === 'pending');
  if (next) {s.query = ''; s.status = 'pending'; s.page = 0; s.expanded = next.id; ctx.repaint();}
 });
 else button(finalize, 'Änderungen ansehen …', () => {void ctx.run(async () => {
  const preview = await c.writer.preview();
  new ConfirmModal(c.app, `${preview.changes.length} Ergänzungen bestätigen`, preview.beforeFrontmatter, preview.afterFrontmatter,
   async () => {await c.writer.apply(preview.token, true); ctx.repaint();}, () => c.writer.invalidate()).open();
 });}, accepted === 0 || a.status !== 'complete').addClass('mod-cta');
 renderJournal(ctx);
}
function renderJournal(ctx: PanelContext): void {
 const {controller: c} = ctx;
 if (!c.writer.journal.length) return;
 const journal = disclosure(ctx.host, `Änderungsverlauf (${c.writer.journal.length})`);
 for (const entry of [...c.writer.journal].reverse()) {
  const row = journal.createDiv({cls: 'em-journal-row'});
  row.createDiv({text: entry.path, cls: 'em-path'}); row.createDiv({text: `${new Date(entry.time).toLocaleString()} · ${entry.status === 'undone' ? 'Zurückgenommen' : entry.status === 'refresh-failed' ? 'Aktualisierung fehlgeschlagen' : 'Übernommen'}`, cls: 'em-muted'});
  button(row, 'Rücknahme ansehen …', () => {void ctx.run(async () => {
   const preview = await c.writer.undoPreview(entry.id);
   new ConfirmModal(c.app, 'Rücknahme bestätigen', preview.before, preview.after,
    async () => {await c.writer.undo(entry.id, preview.before, true); ctx.repaint();}, undefined, 'Rücknahme bestätigen').open();
  });}, entry.status === 'undone');
 }
}
