import {t as tr,number as formatNumber} from '../../i18n';
import {renderReview} from './review';
import {renderWebSearchOption, renderWebSearchContext, webSearchRequest} from '../web-search';
import {Modal} from 'obsidian';
import {button} from '../helpers';
import {badge, disclosure, title, type PanelContext} from '../panel';
import {ContextBudgetError} from '../../llm/context';
import {prepareAssignments} from '../../llm/assignment-context';
import {renderAnalysisScope} from './analysis-scope';
import {errorMessage} from '../../util';
import type {AssignmentBlocker} from '../../llm/assignment-readiness';
import {scopedTargets} from '../../llm/assignment-scope';
import {renderFieldIdeas, renderIdeaContext} from './field-ideas';
import {renderIdeaFields} from './idea-fields';
import {renderAnalysisProfile, hasPromptDraft, savePromptDraft, previewProfile} from './analysis-profile';
import {renderWikipediaOption, renderWikipediaContext, wikipediaRequest} from '../wikipedia';

export function renderAnalysis(ctx: PanelContext): void {
 const {host, controller: c} = ctx;
 host.addClass('em-analysis-compact'); title(host, tr("common.field_ideas")); renderIdeaContext(host, c.activePath);
 renderIdeaFields(host, ctx);
 const blockers = c.assignmentBlockers(), ready = !blockers.length;
 const actions = host.createDiv({cls: 'em-actions em-analysis-actions'});
 // The setup element is in place before an event can invoke this handler.
 const start=button(actions, c.abort ? tr("fieldIdeas.finding_ideas") : hasPromptDraft(ctx) ? tr("fieldIdeas.save_prompt_and_start") : tr("labels.suggest_ideas"), () => {
  const issues = c.assignmentBlockers(); if (issues.length) {revealSetup(host, issues[0]!); return;}
  if(!hasPromptDraft(ctx)){setup.open=false;void ctx.run(()=>c.analyze(wikipediaRequest(ctx.state.analysis,c.activePath),webSearchRequest(ctx.state.analysis,c.activePath)));return;}
  void ctx.run(async()=>{
   try{await savePromptDraft(ctx);}catch{
    for(const key of ['analysis-settings','analysis-profile-prompt']){const box=host.querySelector<HTMLDetailsElement>(`[data-em-disclosure="${key}"]`);if(box)box.open=true;}return;
   }
   const current=host.querySelector<HTMLDetailsElement>('[data-em-disclosure="analysis-settings"]');if(current)current.open=false;
   await c.analyze(wikipediaRequest(ctx.state.analysis,c.activePath),webSearchRequest(ctx.state.analysis,c.activePath));
  });
 }, !!c.abort || c.applyingIdea || !!c.profilePromptSave);start.addClass('mod-cta');start.dataset.emAction='analyze';start.dataset.emFocus='analysis-start';
 if (c.abort) button(actions, tr("common.cancel"), () => c.cancel());
 renderWebSearchOption(host,ctx.state.analysis,c.activePath,!!c.abort,()=>ctx.repaint());
 renderWikipediaOption(host,ctx.state.analysis,c.activePath,!!c.abort,()=>ctx.repaint());
 const setup = disclosure(host, tr("labels.configure_analysis"), !ready, 'analysis-settings');
 renderAnalysisProfile({...ctx,host:setup});
 renderAnalysisScope({...ctx, host: setup});
 if (blockers.length && !c.abort) {
  const message = host.createDiv({cls: 'em-message em-analysis-setup', attr: {role: 'status'}});
  for (const issue of blockers) message.createDiv({text: issue.message});
  if (blockers.some(issue => ['fields', 'descriptions', 'filter'].includes(issue.kind))) button(message, tr("fieldIdeas.complete_setup"), () => revealSetup(host, blockers[0]!));
 }
 if (c.abort) host.createDiv({text: c.status, cls: 'em-muted em-caption', attr: {role: 'status', 'aria-live': 'polite'}});
 const a = c.review.analysis;
 if (a&&a.source===c.activePath) {
  const summary = host.createDiv({cls: 'em-analysis-result'});
  if (a.perField || a.associative) renderFieldIdeas(summary, ctx);
  else {
   title(summary, tr("fieldIdeas.assignment_suggestions"));
   badge(summary, a.status === 'complete' ? tr("common.unreviewed") : a.status === 'partial' ? tr("fieldIdeas.incomplete") : tr("labels.cancelled"));
   for (const error of a.errors) summary.createDiv({text: error, cls: 'em-error'});
   void renderReview({...ctx, host: summary}).catch(error => {if (ctx.isCurrent()) summary.createDiv({text: errorMessage(error), cls: 'em-error'});});
  }
  renderWebSearchContext(summary,a.webSearch,`analysis-web-${a.id}`);
  renderWikipediaContext(summary,a.wikipedia,`analysis-wikipedia-${a.id}`);
 }
 renderDiagnostics(ctx);
}

function renderDiagnostics(ctx: PanelContext): void {
 const {host, controller: c} = ctx, a = c.review.analysis;
 const options = disclosure(host, tr("fieldIdeas.connection_and_details"), false, 'analysis-diagnostics'), state = ctx.state.analysis;
 options.createDiv({text: tr("fieldIdeas.local_fields_as_prompts_shared_concept_list", {value1: c.settings().model, value2: c.analysisFields.length}), cls: 'em-muted em-caption'});
 if (!c.assignmentBlockers().length) {
  const assignment = c.assignmentOptions(), total = scopedTargets(c.activePath, c.graph.snapshot, assignment.folders, assignment.targetProperties, assignment.excludeExistingTargets).length;
  options.createDiv({text: tr("fieldIdeas.existing_notes_in_the_title_list", {value1: total}), cls: 'em-muted em-caption'});
 }
 if (a?.source===c.activePath&&a.diagnostics) {
  const d = a.diagnostics;
  options.createDiv({text: tr("messages.requests",{count:d.requests,details:d.titleMode==='local'?tr("messages.localMatch",{count:d.titlesTotal}):tr("fieldIdeas.target_titles_in_context",{value1:d.titlesSent,value2:d.titlesTotal})}), cls: 'em-muted em-caption'});
  if(d.sourceMode==='overview')options.createDiv({text:tr("fieldIdeas.working_summary_from_fully_processed_parts", {value1: d.sourceParts??1}),cls:'em-muted em-caption'});
  if (d.estimatedTokens !== undefined) options.createDiv({text: tr("fieldIdeas.estimated_context_tokens_including_output_and_reserve", {value1: d.estimatedTokens, value2: c.settings().numCtx}), cls: 'em-muted em-caption'});
  for (const m of d.model) options.createDiv({text: [m.loadMs === undefined ? '' : tr("fieldIdeas.loading_s", {value1: (m.loadMs / 1000).toFixed(1)}),
   m.promptMs === undefined ? '' : tr("messages.inputTime",{seconds:formatNumber(m.promptMs/1000,{minimumFractionDigits:1,maximumFractionDigits:1})}), m.generationMs === undefined ? '' : tr("messages.outputTime",{seconds:formatNumber(m.generationMs/1000,{minimumFractionDigits:1,maximumFractionDigits:1})}),
   m.inputTokens === undefined ? '' : tr("messages.inputTokens",{count:m.inputTokens}), m.outputTokens === undefined ? '' : tr("messages.outputTokens",{count:m.outputTokens})].filter(Boolean).join(' · '), cls: 'em-muted em-caption'});
 }
 const actions = options.createDiv({cls: 'em-actions'});
 button(actions, state.connection === 'checking' ? tr("fieldIdeas.checking_connection") : tr("fieldIdeas.check_ollama_connection"), () => {void ctx.run(async () => {
  if (state.connection === 'checking') return;
  state.connection = 'checking'; state.connectionMessage = tr("fieldIdeas.checking_connection"); ctx.repaint();
  try {await c.checkConnection(); state.connection = 'success'; state.connectionMessage = tr("messages.connectedModel",{model:c.settings().model});}
  catch (error) {state.connection = 'error'; state.connectionMessage = errorMessage(error);}
 });}, state.connection === 'checking');
 button(actions, tr("fieldIdeas.open_request_preview"), () => {void ctx.run(() => openPreview(ctx));});
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
 const c = ctx.controller, modal = new Modal(c.app); modal.setTitle(tr("fieldIdeas.request_preview")); modal.modalEl.addClass('em-inspect-modal');
 const abort=new AbortController();modal.onClose=()=>abort.abort();
 modal.contentEl.createDiv({text: tr("fieldIdeas.this_preview_does_not_send_a_request_to_the_model"), cls: 'em-muted'});
 const body = modal.contentEl.createDiv();
 button(modal.contentEl.createDiv({cls: 'modal-button-container'}), tr("fieldIdeas.close"), () => modal.close()); modal.open();
 const issues = c.assignmentBlockers();
 if (issues.length) {
  body.createEl('h4', {text: tr("fieldIdeas.not_ready_to_send_yet")});
  for (const issue of issues) body.createDiv({text: issue.message, cls: 'em-message'});
  body.createEl('pre', {text: JSON.stringify({fields: c.analysisFields.map(field => ({field, meaning: c.graph.snapshot.rules[field]?.description ?? ''})),
   folders: c.settings().assignment.allFolders ? [] : c.settings().conceptFolders, filter: c.settings().assignment.propertyFilter, properties: c.settings().assignment.properties}, null, 2), cls: 'em-code-preview'});
  return;
 }
 body.createDiv({text: tr("fieldIdeas.preparing_request"), cls: 'em-muted'});
 try {
  const file = c.app.vault.getFileByPath(c.activePath); if (!file) throw new Error(tr("fieldIdeas.the_current_note_is_no_longer_available"));
  const editor = c.app.workspace.activeEditor;
  const content = editor?.file?.path === file.path && editor.editor ? editor.editor.getValue() : await c.app.vault.read(file);
  const online=wikipediaRequest(ctx.state.analysis,file.path);
  const wikipedia=online.enabled?await c.wikipedia.lookup(online.term??'',abort.signal):undefined;
  if(abort.signal.aborted)return;
  const assignment={...c.assignmentOptions(content),...(wikipedia?{wikipedia}:{})};let request:ReturnType<typeof prepareAssignments>,needsOverview=false;
  try{request=prepareAssignments(file.path,content,c.graph.snapshot,previewProfile(ctx),c.settings(),assignment);}
  catch(error){if(!(error instanceof ContextBudgetError))throw error;needsOverview=true;request=prepareAssignments(file.path,content,c.graph.snapshot,previewProfile(ctx),c.settings(),{...assignment,overview:{text:tr("fieldIdeas.working_summary_of_all_note_sections_generated_locally_only_when_started"),parts:1}});}
  const prepared = request.contexts[0]!;
  body.empty();if(hasPromptDraft(ctx))body.createDiv({text:tr("fieldIdeas.preview_with_unsaved_prompt_draft"),cls:'em-muted'});
  body.createDiv({text: tr("fieldIdeas.model_request_approximately_tokens_including_output_and_reserve", {value1: request.sections.length, value2: prepared.titleMode === 'local' ? `lokaler Abgleich gegen alle ${request.targets.length} Zieltitel` : tr("fieldIdeas.target_titles_in_context", {value1: prepared.candidates.length, value2: request.targets.length}), value3: prepared.estimatedTokens, value4: c.settings().numCtx}), cls: 'em-muted'});
  if(needsOverview)body.createDiv({text:tr("fieldIdeas.the_complete_note_is_processed_in_sections_before_assignment_this_preview"),cls:'em-muted em-caption'});
  renderWikipediaContext(body,prepared.wikipedia,'preview-wikipedia');
  body.createEl('pre', {text: JSON.stringify(request.contexts.map(({messages, format, maxTokens}) => ({messages, format, maxTokens})), null, 2), cls: 'em-code-preview'});
 } catch (error) {body.empty(); body.createDiv({text: errorMessage(error), cls: 'em-error', attr: {role: 'alert'}});}
}
