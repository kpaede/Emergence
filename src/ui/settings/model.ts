import {Setting} from 'obsidian';
import {OllamaProvider} from '../../llm/provider';
import {disclosure} from '../panel';
import {errorMessage} from '../../util';
import type {SettingsContext} from './context';
export function modelSettings(ctx: SettingsContext): void {
 const {host, draft: s} = ctx;
 new Setting(host).setName('Lokales Modell').setHeading();
 host.createDiv({text: 'Emergence verbindet sich mit deinem lokalen Ollama. Notizinhalte verlassen deinen Rechner nicht.', cls: 'em-muted'});
 new Setting(host).setName('Ollama-Adresse').setDesc('Lokale HTTP-Adresse, zum Beispiel http://127.0.0.1:11434.').addText(t => t.setValue(s.endpoint).onChange(v => {s.endpoint = v; ctx.changed();}));
 const modelRow = new Setting(host).setName('Modell').setDesc('Name eines bereits installierten Modells.');
 modelRow.addText(t => t.setValue(s.model).onChange(v => {s.model = v; ctx.changed();}));
 new Setting(host).setName('Verbindung testen').setDesc('Prüft diese Adresse, verfügbare Modelle und Fähigkeiten. Speichert keine Einstellungen.').addButton(b => b.setButtonText('Jetzt prüfen').onClick(() => {
  b.setDisabled(true).setButtonText('Wird geprüft …');
  void new OllamaProvider(() => s).health().then(info => {
   ctx.report(`Verbunden · Ollama ${info.version} · ${info.models.length} installierte Modelle`);
   modelRow.controlEl.empty();
   modelRow.addDropdown(d => d.addOptions(Object.fromEntries(info.models.map(m => [m, m]))).setValue(s.model).onChange(v => {s.model = v; ctx.changed();}));
  }).catch(e => ctx.report(errorMessage(e), true)).finally(() => b.setDisabled(false).setButtonText('Jetzt prüfen'));
 }));
 const advanced = disclosure(host, 'Leistung und Anfrageverhalten');
 for (const [key, label, description] of [['numCtx', 'Kontextfenster', 'Startwert 8192 Tokens. Größere Werte benötigen mehr Speicher.'], ['timeoutMs', 'Zeitlimit in Millisekunden', 'Laufende Anfragen können zusätzlich abgebrochen werden.'], ['maxConcurrent', 'Gleichzeitige Anfragen', '1 oder 2. Eine Anfrage schont den verfügbaren Arbeitsspeicher.']] as const)
  new Setting(advanced).setName(label).setDesc(description).addText(t => {t.inputEl.type = 'number'; t.setValue(String(s[key])).onChange(v => {s[key] = Number(v); ctx.changed();});});
 new Setting(advanced).setName('Thinking verwenden').setDesc('Nur wenn das ausgewählte Modell die Funktion unterstützt.').addToggle(t => t.setValue(s.think).onChange(v => {s.think = v; ctx.changed();}));
 new Setting(advanced).setName('Modell nach Anfrage freigeben').setDesc('Gibt Speicher frei; die nächste Anfrage kann länger starten.').addToggle(t => t.setValue(s.releaseModel).onChange(v => {s.releaseModel = v; ctx.changed();}));
}
