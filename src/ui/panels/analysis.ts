import {renderReview} from './review';
import {Modal} from 'obsidian';
import {button} from '../helpers';
import {badge, disclosure, title, type PanelContext} from '../panel';
import {prepareAssignments} from '../../llm/assignment-context';
import {renderAnalysisScope} from './analysis-scope';
import {errorMessage} from '../../util';
import type {AssignmentBlocker} from '../../llm/assignment-readiness';
import {scopedTargets} from '../../llm/assignment-scope';
import {renderFieldIdeas, renderIdeaContext} from './field-ideas';
import {renderAnalysisProfile, hasPromptDraft, savePromptDraft, previewProfile} from './analysis-profile';
import {renderWikipediaOption, renderWikipediaContext, wikipediaRequest} from '../wikipedia';

export function renderAnalysis(ctx: PanelContext): void {
 const {host, controller: c} = ctx;
 host.addClass('em-analysis-compact'); title(host, 'Feldideen'); renderIdeaContext(host, c.activePath);
 const blockers = c.assignmentBlockers(), ready = !blockers.length;
 const actions = host.createDiv({cls: 'em-actions em-analysis-actions'});
 // The setup element is in place before an event can invoke this handler.
 const start=button(actions, c.abort ? 'Ideen werden gesucht …' : hasPromptDraft(ctx) ? 'Prompt speichern und starten' : 'Ideen vorschlagen', () => {
  const issues = c.assignmentBlockers(); if (issues.length) {revealSetup(host, issues[0]!); return;}
  if(!hasPromptDraft(ctx)){setup.open=false;void ctx.run(()=>c.analyze(wikipediaRequest(ctx.state.analysis,c.activePath)));return;}
  void ctx.run(async()=>{
   try{await savePromptDraft(ctx);}catch{
    for(const key of ['analysis-settings','analysis-profile-prompt']){const box=host.querySelector<HTMLDetailsElement>(`[data-em-disclosure="${key}"]`);if(box)box.open=true;}return;
   }
   const current=host.querySelector<HTMLDetailsElement>('[data-em-disclosure="analysis-settings"]');if(current)current.open=false;
   await c.analyze(wikipediaRequest(ctx.state.analysis,c.activePath));
  });
 }, !!c.abort || c.applyingIdea || !!c.profilePromptSave);start.addClass('mod-cta');start.dataset.emAction='analyze';start.dataset.emFocus='analysis-start';
 if (c.abort) button(actions, 'Abbrechen', () => c.cancel());
 renderWikipediaOption(host,ctx.state.analysis,c.activePath,!!c.abort,()=>ctx.repaint());
 const setup = disclosure(host, 'Analyse einstellen', !ready, 'analysis-settings');
 renderAnalysisProfile({...ctx,host:setup});
 renderAnalysisScope({...ctx, host: setup});
 if (blockers.length && !c.abort) {
  const message = host.createDiv({cls: 'em-message em-analysis-setup', attr: {role: 'status'}});
  for (const issue of blockers) message.createDiv({text: issue.message});
  if (blockers.some(issue => ['fields', 'descriptions', 'filter'].includes(issue.kind))) button(message, 'Einrichtung vervollständigen', () => revealSetup(host, blockers[0]!));
 }
 if (c.abort) host.createDiv({text: c.status, cls: 'em-muted em-caption', attr: {role: 'status', 'aria-live': 'polite'}});
 const a = c.review.analysis;
 if (a) {
  const summary = host.createDiv({cls: 'em-analysis-result'});
  if (a.source !== c.activePath) {summary.createDiv({text: 'Ideen für eine andere Notiz', cls: 'em-muted'}); renderIdeaContext(summary, a.source);}
  if (a.perField) renderFieldIdeas(summary, ctx);
  else {
   title(summary, 'Zuordnungsvorschläge');
   badge(summary, a.status === 'complete' ? 'Ungeprüft' : a.status === 'partial' ? 'Unvollständig' : 'Abgebrochen');
   for (const error of a.errors) summary.createDiv({text: error, cls: 'em-error'});
   void renderReview({...ctx, host: summary}).catch(error => {if (ctx.isCurrent()) summary.createDiv({text: errorMessage(error), cls: 'em-error'});});
  }
  renderWikipediaContext(summary,a.wikipedia,`analysis-wikipedia-${a.id}`);
 }
 renderDiagnostics(ctx);
}

function renderDiagnostics(ctx: PanelContext): void {
 const {host, controller: c} = ctx, a = c.review.analysis;
 const options = disclosure(host, 'Verbindung und Details', false, 'analysis-diagnostics'), state = ctx.state.analysis;
 options.createDiv({text: `${c.settings().model} · lokal · ${c.analysisFields.length} Felder · bis zu vier Ideen je Feld`, cls: 'em-muted em-caption'});
 if (!c.assignmentBlockers().length) {
  const assignment = c.assignmentOptions(), total = scopedTargets(c.activePath, c.graph.snapshot, assignment.folders, assignment.targetProperties, assignment.excludeExistingTargets).length;
  options.createDiv({text: `${total} vorhandene Notizen in der Titelliste`, cls: 'em-muted em-caption'});
 }
 if (a?.diagnostics) {
  const d = a.diagnostics;
  options.createDiv({text: `${d.requests} Anfrage · ${d.titleMode === 'local' ? `lokaler Abgleich gegen ${d.titlesTotal} Zieltitel` : `${d.titlesSent}/${d.titlesTotal} Zieltitel im Kontext`}`, cls: 'em-muted em-caption'});
  if (d.estimatedTokens !== undefined) options.createDiv({text: `Kontext geschätzt: ${d.estimatedTokens}/${c.settings().numCtx} Tokens einschließlich Ausgabe und Reserve.`, cls: 'em-muted em-caption'});
  for (const m of d.model) options.createDiv({text: [m.loadMs === undefined ? '' : `Laden ${(m.loadMs / 1000).toFixed(1)} s`,
   m.promptMs === undefined ? '' : `Eingabe ${(m.promptMs / 1000).toFixed(1)} s`, m.generationMs === undefined ? '' : `Ausgabe ${(m.generationMs / 1000).toFixed(1)} s`,
   m.inputTokens === undefined ? '' : `${m.inputTokens} Eingabetokens`, m.outputTokens === undefined ? '' : `${m.outputTokens} Ausgabetokens`].filter(Boolean).join(' · '), cls: 'em-muted em-caption'});
 }
 const actions = options.createDiv({cls: 'em-actions'});
 button(actions, state.connection === 'checking' ? 'Verbindung wird geprüft …' : 'Ollama-Verbindung prüfen', () => {void ctx.run(async () => {
  if (state.connection === 'checking') return;
  state.connection = 'checking'; state.connectionMessage = 'Verbindung wird geprüft …'; ctx.repaint();
  try {await c.checkConnection(); state.connection = 'success'; state.connectionMessage = `Verbunden · ${c.settings().model}`;}
  catch (error) {state.connection = 'error'; state.connectionMessage = errorMessage(error);}
 });}, state.connection === 'checking');
 button(actions, 'Anfragevorschau öffnen', () => {void ctx.run(() => openPreview(ctx));});
 if (state.connectionMessage) options.createDiv({text: state.connectionMessage, cls: `em-message em-connection-result${state.connection === 'error' ? ' em-error' : ''}`,
  attr: {role: 'status', 'aria-live': 'polite', 'data-status': state.connection ?? 'checking'}});
}

function revealSetup(host: HTMLElement, issue: AssignmentBlocker): void {
 const key = issue.kind === 'fields' ? 'analysis-fields' : issue.kind === 'descriptions' ? 'analysis-descriptions' : issue.kind === 'filter' ? 'analysis-scope' : '';
 let box = host.querySelector<HTMLDetailsElement>(`details[data-em-disclosure="${key}"]`);
 if (box) {
  for (let parent = box.parentElement; parent && parent !== host; parent = parent.parentElement) if (parent.tagName === 'DETAILS') (parent as HTMLDetailsElement).open = true;
  box.open = true;
  if (issue.kind === 'descriptions' && issue.fields?.length) {
   const select = box.querySelector<HTMLSelectElement>('select');
   if (select && select.value !== issue.fields[0]) {select.value = issue.fields[0]!; select.dispatchEvent(new Event('change', {bubbles: true}));}
   box = host.querySelector<HTMLDetailsElement>(`details[data-em-disclosure="${key}"]`); if (box) box.open = true;
  }
  box?.querySelector<HTMLElement>(issue.kind === 'descriptions' ? 'textarea' : 'summary')?.focus(); box?.scrollIntoView({block: 'nearest'});
 }
 else host.querySelector<HTMLElement>('.em-analysis-setup')?.scrollIntoView({block: 'nearest'});
}
async function openPreview(ctx: PanelContext): Promise<void> {
 const c = ctx.controller, modal = new Modal(c.app); modal.setTitle('Anfragevorschau'); modal.modalEl.addClass('em-inspect-modal');
 const abort=new AbortController();modal.onClose=()=>abort.abort();
 modal.contentEl.createDiv({text: 'Diese Vorschau sendet keine Anfrage an das Modell.', cls: 'em-muted'});
 const body = modal.contentEl.createDiv();
 button(modal.contentEl.createDiv({cls: 'modal-button-container'}), 'Schließen', () => modal.close()); modal.open();
 const issues = c.assignmentBlockers();
 if (issues.length) {
  body.createEl('h4', {text: 'Noch nicht sendebereit'});
  for (const issue of issues) body.createDiv({text: issue.message, cls: 'em-message'});
  body.createEl('pre', {text: JSON.stringify({fields: c.analysisFields.map(field => ({field, meaning: c.graph.snapshot.rules[field]?.description ?? ''})),
   folders: c.settings().assignment.allFolders ? [] : c.settings().conceptFolders, filter: c.settings().assignment.propertyFilter, properties: c.settings().assignment.properties}, null, 2), cls: 'em-code-preview'});
  return;
 }
 body.createDiv({text: 'Anfrage wird zusammengestellt …', cls: 'em-muted'});
 try {
  const file = c.app.vault.getFileByPath(c.activePath); if (!file) throw new Error('Aktuelle Notiz ist nicht mehr verfügbar.');
  const editor = c.app.workspace.activeEditor;
  const content = editor?.file?.path === file.path && editor.editor ? editor.editor.getValue() : await c.app.vault.read(file);
  const online=wikipediaRequest(ctx.state.analysis,file.path);
  const wikipedia=online.enabled?await c.wikipedia.lookup(online.term??'',abort.signal):undefined;
  if(abort.signal.aborted)return;
  const request = prepareAssignments(file.path, content, c.graph.snapshot, previewProfile(ctx), c.settings(), {...c.assignmentOptions(content),...(wikipedia?{wikipedia}:{})});
  const prepared = request.contexts[0]!;
  body.empty();if(hasPromptDraft(ctx))body.createDiv({text:'Vorschau mit ungespeichertem Promptentwurf.',cls:'em-muted'});
  body.createDiv({text: `${request.sections.length} Modellanfrage · ${prepared.titleMode === 'local' ? `lokaler Abgleich gegen alle ${request.targets.length} Zieltitel` : `${prepared.candidates.length}/${request.targets.length} Zieltitel im Kontext`} · geschätzt ${prepared.estimatedTokens}/${c.settings().numCtx} Tokens einschließlich Ausgabe und Reserve.`, cls: 'em-muted'});
  renderWikipediaContext(body,prepared.wikipedia,'preview-wikipedia');
  body.createEl('pre', {text: JSON.stringify(request.contexts.map(({messages, format, maxTokens}) => ({messages, format, maxTokens})), null, 2), cls: 'em-code-preview'});
 } catch (error) {body.empty(); body.createDiv({text: errorMessage(error), cls: 'em-error', attr: {role: 'alert'}});}
}
