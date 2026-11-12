import {t as tr} from '../i18n';
import type {Profile} from '../types';
import {assert, clone} from '../util';
import {placeholders, renderTemplate} from './context';

export interface ProfilePrompts {instructions: string; relations: string; outputId: string; outputPrompt: string}
export interface ProfilePromptDraft {base: ProfilePrompts; value: ProfilePrompts; version: number; error?: string; message?: string}
export function profilePrompts(profile: Profile): ProfilePrompts {
 const output=profile.outputs.find(o=>o.enabled&&o.kind==='relations');
 return {instructions:profile.instructions,relations:profile.templates.relations,outputId:output?.id??'',outputPrompt:output?.promptTemplate??''};
}
export function withProfilePrompts(profile: Profile, text: ProfilePrompts): Profile {
 assert(profilePrompts(profile).outputId===text.outputId,tr("fieldIdeas.the_relation_module_has_changed_reload_the_prompt_draft"));
 const values=Object.fromEntries(placeholders.map(key=>[key,`[${key}]`]));
 for(const template of [text.instructions,text.relations,text.outputPrompt])renderTemplate(template,values);
 const next=clone(profile);next.instructions=text.instructions;next.templates.relations=text.relations;
 const output=next.outputs.find(o=>o.id===text.outputId);if(output)output.promptTemplate=text.outputPrompt;
 return next;
}
