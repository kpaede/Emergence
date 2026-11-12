import {t as tr} from '../../i18n';
import type {Setting, SettingDefinitionItem} from 'obsidian';
export type SettingsSection = 'model' | 'relations' | 'profiles' | 'data' | 'graph';
export interface FeatureSettings {language: SettingDefinitionItem; fieldIdeas?:SettingDefinitionItem[]; mermaid: SettingDefinitionItem[]; argdown: SettingDefinitionItem[]; search: SettingDefinitionItem[]; graph: SettingDefinitionItem[]}
/** Composite editors stay transactional; aliases make their actual controls discoverable in Obsidian search. */
export function settingsDefinitions(render: (setting: Setting, section: SettingsSection) => void | (() => void), fields: readonly string[], profiles: readonly string[], features?: FeatureSettings): SettingDefinitionItem[] {
 const pages: {id: SettingsSection; name: string; desc: string; editor: string; aliases: string[]}[] = [
  {id:'model',name:tr("common.model"),desc:tr("settings.local_ollama_and_request_behavior"),editor:tr("settings.ollama_and_performance"),aliases:[
   tr("settings.ollama_address"),tr("common.model"),tr("settings.test_connection"),tr("labels.context_window"),tr("labels.timeout_in_milliseconds"),tr("labels.concurrent_requests"),tr("settings.use_thinking"),tr("settings.unload_model_after_request"),
  ]},
  {id:'relations',name:tr("settings.relations"),desc:tr("settings.meaning_of_breadcrumbs_fields_and_allowed_additions"),editor:tr("settings.breadcrumbs_fields_and_assignment_criteria"),aliases:[
   tr("settings.relation_field"),tr("settings.meaning_and_assignment_criteria"),tr("labels.field_descriptions"),tr("settings.relation_class"),tr("settings.show_as_hierarchy"),tr("settings.allow_reviewed_additions"),tr("settings.direction_in_hierarchical_layout"),tr("settings.inverse_field"),tr("labels.prevent_cycles"),tr("labels.transitive"),tr("labels.symmetric"),tr("labels.allow_self_references"),tr("settings.allowed_target_types"),...fields,
  ]},
  {id:'profiles',name:tr("settings.profiles"),desc:tr("settings.analysis_profiles_instructions_prompts_and_output_modules"),editor:tr("settings.profiles_and_prompt_templates"),aliases:[
   tr("settings.analysis_profile"),tr("settings.duplicate_profile"),tr("settings.delete_profile"),tr("settings.profile_name"),tr("settings.output_language"),tr("fieldIdeas.ai_instructions"),tr("labels.temperature"),tr("labels.maximum_output_tokens"),tr("settings.prompt_templates"),tr("labels.breadcrumbs_assignment"),tr("labels.placeholders"),tr("labels.output_modules"),tr("labels.output_module"),tr("labels.output_format"),tr("labels.approval"),...profiles,
  ]},
  {id:'data',name:tr("settings.data"),desc:tr("settings.citekeys_search_scope_configuration_and_undo_journal"),editor:tr("settings.data_and_configuration"),aliases:[
   tr("settings.copy_citekey"),tr("settings.target_folders_for_assignments"),tr("settings.filter_targets_by_frontmatter"),tr("settings.frontmatter_keys"),tr("settings.export_configuration"),tr("labels.import_configuration"),tr("settings.reset_session"),tr("settings.clear_session"),tr("settings.undo_journal"),tr("settings.delete_journal"),
  ]},
 ];
 const fieldPages: SettingDefinitionItem[] = pages.map(page=>({type:'page',name:page.name,desc:page.desc,items:[{
  name:page.editor,aliases:page.aliases,render:setting=>render(setting,page.id),
 }]}));
 if (!features) return fieldPages;
 return [features.language,
  {type:'page',name:tr('settings.graph'),desc:tr('settings.graphDescription'),items:features.graph},
  {type:'page',name:tr('settings.fieldIdeas'),desc:tr('settings.fieldIdeasDescription'),items:[...features.fieldIdeas??[],...fieldPages]},
  {type:'page',name:tr('settings.mermaid'),desc:tr('settings.mermaidDescription'),items:features.mermaid},
  {type:'page',name:tr('settings.argdown'),desc:tr('settings.argdownDescription'),items:features.argdown},
  {type:'page',name:tr('settings.search'),desc:tr('settings.searchDescription'),items:features.search},
 ];
}
