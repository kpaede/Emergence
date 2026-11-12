import {t as tr} from '../../i18n';
import {button, input, select} from '../helpers';
import {disclosure, type PanelContext} from '../panel';
import {profilePrompts, withProfilePrompts, type ProfilePromptDraft} from '../../llm/profile-prompts';
import {clone, errorMessage} from '../../util';
import type {Profile} from '../../types';

function draftFor(ctx: PanelContext): ProfilePromptDraft {
 const p=ctx.controller.profile,state=ctx.state.analysis;
 state.profileDrafts??={};let draft=state.profileDrafts[p.id];
 const text=profilePrompts(p);
 if(!draft || JSON.stringify(draft.value)===JSON.stringify(draft.base) && (draft.version!==p.version || JSON.stringify(draft.base)!==JSON.stringify(text))) {
  draft={base:clone(text),value:clone(text),version:p.version};state.profileDrafts[p.id]=draft;
 }
 return draft;
}
export function hasPromptDraft(ctx: PanelContext): boolean {
 const draft=draftFor(ctx);return JSON.stringify(draft.value)!==JSON.stringify(draft.base);
}
export function previewProfile(ctx: PanelContext): Profile {return withProfilePrompts(ctx.controller.profile,draftFor(ctx).value);}
export async function savePromptDraft(ctx: PanelContext): Promise<void> {
 if(!hasPromptDraft(ctx))return;
 const c=ctx.controller,draft=draftFor(ctx),id=c.profile.id;
 draft.error=undefined;draft.message=undefined;
 try{
  const save=c.saveProfilePrompts(id,draft.base,clone(draft.value),draft.version);ctx.repaint();await save;
  const saved=c.settings().profiles.find(p=>p.id===id)!;
  draft.base=profilePrompts(saved);draft.version=saved.version;
  draft.message=JSON.stringify(draft.value)===JSON.stringify(draft.base)?tr("labels.saved"):undefined;
 }catch(error){draft.error=errorMessage(error);throw error;}
}
export function renderAnalysisProfile(ctx: PanelContext): void {
 const {controller:c,host}=ctx,draft=draftFor(ctx);
 const profile=select(host,tr("fieldIdeas.profile"),Object.fromEntries(c.settings().profiles.map(p=>[p.id,p.name])),c.profile.id,id=>{void ctx.run(async()=>{
  const previous=c.settings().activeProfile;c.settings().activeProfile=id;
  try{await c.persist();c.invalidateAssignments();}catch(error){c.settings().activeProfile=previous;throw error;}
 });});
 profile.disabled=!!c.abort||c.applyingIdea||!!c.profilePromptSave;
 const editor=disclosure(host,tr("fieldIdeas.edit_prompt"),false,'analysis-profile-prompt');editor.addClass('em-profile-prompt');
 const changed=()=>{draft.error=undefined;draft.message=undefined;sync();};
 const instructions=input(editor,tr("fieldIdeas.ai_instructions"),draft.value.instructions,value=>{draft.value.instructions=value;changed();},true) as HTMLTextAreaElement;
 instructions.rows=7;
 const advanced=disclosure(editor,tr("fieldIdeas.other_prompt_text"),false,`profile-extra-${c.profile.id}`);
 const relations=input(advanced,tr("fieldIdeas.additional_instructions"),draft.value.relations,value=>{draft.value.relations=value;changed();},true) as HTMLTextAreaElement;relations.rows=4;
 if(draft.value.outputId){const output=input(advanced,tr("fieldIdeas.relation_module_instructions"),draft.value.outputPrompt,value=>{draft.value.outputPrompt=value;changed();},true) as HTMLTextAreaElement;output.rows=3;}
 const actions=editor.createDiv({cls:'em-actions'});
 const save=button(actions,tr("fieldIdeas.save_prompt"),()=>{void ctx.run(async()=>{try{await savePromptDraft(ctx);}catch{/* Inline feedback keeps the draft. */}});});
 const discard=button(actions,tr("settings.discard_draft"),()=>{ctx.state.analysis.profileDrafts![c.profile.id]={base:profilePrompts(c.profile),value:profilePrompts(c.profile),version:c.profile.version};ctx.repaint();});
 const feedback=editor.createDiv({cls:'em-muted em-caption',attr:{role:'status','aria-live':'polite'}});
 const sync=()=>{
  const dirty=hasPromptDraft(ctx),busy=!!c.abort||c.applyingIdea||!!c.profilePromptSave;
  save.disabled=!dirty||busy;discard.disabled=!dirty||busy;
  feedback.setText(draft.error??draft.message??(c.profilePromptSave?tr("fieldIdeas.saving"):dirty?tr("fieldIdeas.unsaved_draft"):''));feedback.toggleClass('em-error',!!draft.error);
  const start=host.closest('.em-panel-analysis')?.querySelector<HTMLButtonElement>('[data-em-action="analyze"]');
  if(start&&!c.abort)start.textContent=dirty?tr("fieldIdeas.save_prompt_and_start"):tr("labels.suggest_ideas");
 };
 sync();
}
