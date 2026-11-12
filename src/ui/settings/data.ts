import {t as tr} from '../../i18n';
import {Setting} from 'obsidian';
import {migrateSettings} from '../../config';
import {clone, download, errorMessage} from '../../util';
import {button, input} from '../helpers';
import {disclosure} from '../panel';
import type {SettingsContext} from './context';
export function dataSettings(ctx: SettingsContext): void {
 const {host, draft: s, controller: c} = ctx;
 new Setting(host).setName(tr("settings.copy_citekey")).setDesc(tr("settings.clicking_the_citekey_of_a_zotero_result_copies_it_in_this")).addDropdown(d=>d.addOptions({brackets:'[@citekey]',at:'@citekey',plain:'citekey'}).setValue(s.citekeyFormat??'brackets').onChange(v=>{s.citekeyFormat=v as 'brackets'|'at'|'plain';ctx.changed();}));
 new Setting(host).setName(tr("settings.graph_data")).setHeading();
 const folders = new Setting(host).setName(tr("settings.target_folders_for_assignments")).setDesc(tr("settings.one_vault_folder_per_line_leave_empty_to_include_all_markdown")); folders.settingEl.addClass('em-setting-stack');
 folders.addTextArea(t => {t.inputEl.rows = 3; t.setValue(s.conceptFolders.join('\n')).onChange(v => {s.conceptFolders = v.split('\n').map(f => f.trim()).filter(Boolean); s.assignment.allFolders = !s.conceptFolders.length; ctx.changed();});});
 new Setting(host).setName(tr("settings.filter_targets_by_frontmatter")).addDropdown(d => d.addOptions({none: tr("settings.no_restriction"), breadcrumbs: tr("settings.at_least_one_breadcrumbs_field"), custom: tr("settings.custom_frontmatter_keys")}).setValue(s.assignment.propertyFilter).onChange(v => {s.assignment.propertyFilter = v as typeof s.assignment.propertyFilter; ctx.changed(); ctx.refresh();}));
 if (s.assignment.propertyFilter === 'custom') new Setting(host).setName(tr("settings.frontmatter_keys")).setDesc(tr("settings.comma_separated_at_least_one_key_must_exist")).addText(t => t.setValue(s.assignment.properties.join(', ')).onChange(v => {s.assignment.properties = v.split(',').map(p => p.trim()).filter(Boolean); ctx.changed();}));
 new Setting(host).setName(tr("settings.transfer_configuration")).setHeading();
 new Setting(host).setName(tr("settings.export_configuration")).setDesc(tr("settings.model_settings_field_rules_profiles_and_templates_no_note_bodies")).addButton(b => b.setButtonText(tr("settings.export")).onClick(() => download('emergence-konfiguration.json', JSON.stringify(s, null, 2))));
 const importer = disclosure(host, tr("labels.import_configuration")); let json = '';
 input(importer, tr("labels.exported_configuration_as_json"), '', value => {json = value;}, true);
 button(importer.createDiv({cls: 'em-actions'}), tr("settings.validate_import_and_load_as_draft"), () => {
  try {const next = migrateSettings(JSON.parse(json)); Object.assign(s, clone(next)); ctx.changed(); ctx.refresh(); ctx.report(tr("settings.the_import_is_valid_save_changes_applies_the_configuration"));}
  catch (error) {ctx.report(errorMessage(error), true);}
 });
 new Setting(host).setName(tr("settings.local_session_data")).setHeading();
 host.createDiv({text: tr("settings.graph_and_field_ideas_remain_in_memory_the_local_undo_journal"), cls: 'em-muted'});
 new Setting(host).setName(tr("settings.reset_session")).setDesc(tr("settings.cancels_running_requests_and_removes_field_ideas")).addButton(b => b.setButtonText(tr("settings.clear_session")).onClick(() => {c.clearSession(); ctx.report(tr("settings.session_data_removed"));}));
 const journal = disclosure(host, tr("settings.manage_undo_journal"));
 new Setting(journal).setName(tr("settings.delete_journal")).setDesc(tr("settings.removes_saved_undo_options_your_notes_remain_unchanged")).addButton(b => b.setButtonText(tr("settings.delete_journal")).onClick(() => {
  c.writer.journal.splice(0); void c.persist().then(() => ctx.report(tr("settings.journal_deleted"))).catch(e => ctx.report(errorMessage(e), true));
 }));
}
