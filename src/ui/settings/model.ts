import {t as tr} from '../../i18n';
import {Setting} from 'obsidian';
import {OllamaProvider} from '../../llm/provider';
import {disclosure} from '../panel';
import {errorMessage} from '../../util';
import type {SettingsContext} from './context';
export function modelSettings(ctx: SettingsContext): void {
 const {host, draft: s} = ctx;
 new Setting(host).setName(tr("settings.local_model")).setHeading();
 host.createDiv({text: tr("settings.the_language_model_runs_in_your_local_ollama_optional_web_and"), cls: 'em-muted'});
 new Setting(host).setName(tr("settings.ollama_address")).setDesc(tr("settings.local_http_address_for_example_http_127_0_0_1_11434")).addText(t => t.setValue(s.endpoint).onChange(v => {s.endpoint = v; ctx.changed();}));
 const modelRow = new Setting(host).setName(tr("common.model")).setDesc(tr("settings.name_of_an_already_installed_model"));
 modelRow.addText(t => t.setValue(s.model).onChange(v => {s.model = v; ctx.changed();}));
 new Setting(host).setName(tr("settings.test_connection")).setDesc(tr("settings.checks_this_address_available_models_and_capabilities_does_not_save_settings")).addButton(b => b.setButtonText(tr("settings.check_now")).onClick(() => {
  b.setDisabled(true).setButtonText(tr("settings.checking"));
  void new OllamaProvider(() => s).health().then(info => {
   ctx.report(tr("messages.modelConnection",{version:info.version,count:info.models.length}));
   modelRow.controlEl.empty();
   modelRow.addDropdown(d => d.addOptions(Object.fromEntries(info.models.map(m => [m, m]))).setValue(s.model).onChange(v => {s.model = v; ctx.changed();}));
  }).catch(e => ctx.report(errorMessage(e), true)).finally(() => b.setDisabled(false).setButtonText(tr("settings.check_now")));
 }));
 const advanced = disclosure(host, tr("settings.performance_and_request_behavior"));
 for (const [key, label, description] of [['numCtx', tr("labels.context_window"), tr("settings.default_8192_tokens_larger_values_need_more_memory")], ['timeoutMs', tr("labels.timeout_in_milliseconds"), tr("settings.running_requests_can_also_be_cancelled")], ['maxConcurrent', tr("labels.concurrent_requests"), tr("settings.1_or_2_one_request_uses_less_memory")]] as const)
  new Setting(advanced).setName(label).setDesc(description).addText(t => {t.inputEl.type = 'number'; t.setValue(String(s[key])).onChange(v => {s[key] = Number(v); ctx.changed();});});
 new Setting(advanced).setName(tr("settings.use_thinking")).setDesc(tr("settings.only_if_the_selected_model_supports_it")).addToggle(t => t.setValue(s.think).onChange(v => {s.think = v; ctx.changed();}));
 new Setting(advanced).setName(tr("settings.unload_model_after_request")).setDesc(tr("settings.frees_memory_the_next_request_may_take_longer_to_start")).addToggle(t => t.setValue(s.releaseModel).onChange(v => {s.releaseModel = v; ctx.changed();}));
}
