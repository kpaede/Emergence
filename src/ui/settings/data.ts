import {Setting} from 'obsidian';
import {migrateSettings} from '../../config';
import {clone, download, errorMessage} from '../../util';
import {button, input} from '../helpers';
import {disclosure} from '../panel';
import type {SettingsContext} from './context';
export function dataSettings(ctx: SettingsContext): void {
 const {host, draft: s, controller: c} = ctx;
 new Setting(host).setName('Graphdaten').setHeading();
 const folders = new Setting(host).setName('Zielordner für Zuordnungen').setDesc('Ein Vaultordner pro Zeile. Leer berücksichtigt alle Markdown-Notizen.'); folders.settingEl.addClass('em-setting-stack');
 folders.addTextArea(t => {t.inputEl.rows = 3; t.setValue(s.conceptFolders.join('\n')).onChange(v => {s.conceptFolders = v.split('\n').map(f => f.trim()).filter(Boolean); s.assignment.allFolders = !s.conceptFolders.length; ctx.changed();});});
 new Setting(host).setName('Zielfilter über Frontmatter').addDropdown(d => d.addOptions({none: 'Keine Einschränkung', breadcrumbs: 'Mindestens ein Breadcrumbs-Feld', custom: 'Eigene Frontmatter-Schlüssel'}).setValue(s.assignment.propertyFilter).onChange(v => {s.assignment.propertyFilter = v as typeof s.assignment.propertyFilter; ctx.changed(); ctx.refresh();}));
 if (s.assignment.propertyFilter === 'custom') new Setting(host).setName('Frontmatter-Schlüssel').setDesc('Kommagetrennt; mindestens einer der Schlüssel muss vorhanden sein.').addText(t => t.setValue(s.assignment.properties.join(', ')).onChange(v => {s.assignment.properties = v.split(',').map(p => p.trim()).filter(Boolean); ctx.changed();}));
 const display = disclosure(host, 'Anzeigegrenzen für große Graphen');
 for (const [key, label] of [['maxGraphNodes', 'Maximal sichtbare Knoten'], ['maxGraphEdges', 'Maximal sichtbare Beziehungen'], ['graphHeight', 'Maximale Graphhöhe in Pixeln']] as const)
  new Setting(display).setName(label).addText(t => {t.inputEl.type = 'number'; t.setValue(String(s[key])).onChange(v => {s[key] = Number(v); ctx.changed();});});
 new Setting(host).setName('Konfiguration übertragen').setHeading();
 new Setting(host).setName('Konfiguration exportieren').setDesc('Modelleinstellungen, Feldregeln, Profile und Vorlagen. Keine Notizkörper.').addButton(b => b.setButtonText('Exportieren').onClick(() => download('emergence-konfiguration.json', JSON.stringify(s, null, 2))));
 const importer = disclosure(host, 'Konfiguration importieren'); let json = '';
 input(importer, 'Exportierte Konfiguration als JSON', '', value => {json = value;}, true);
 button(importer.createDiv({cls: 'em-actions'}), 'Import prüfen und als Entwurf laden', () => {
  try {const next = migrateSettings(JSON.parse(json)); Object.assign(s, clone(next)); ctx.changed(); ctx.refresh(); ctx.report('Import ist gültig. „Änderungen speichern“ übernimmt die Konfiguration.');}
  catch (error) {ctx.report(errorMessage(error), true);}
 });
 new Setting(host).setName('Lokale Sitzungsdaten').setHeading();
 host.createDiv({text: 'Graph, Analysen und Rechercheverlauf bleiben im Arbeitsspeicher. Das lokale Rücknahmejournal speichert höchstens 20 Frontmatter-Zustände; keine Notizkörper.', cls: 'em-muted'});
 new Setting(host).setName('Sitzung zurücksetzen').setDesc('Bricht laufende Anfragen ab und entfernt Analysen und Rechercheverlauf.').addButton(b => b.setButtonText('Sitzung leeren').onClick(() => {c.clearSession(); ctx.report('Sitzungsdaten entfernt.');}));
 const journal = disclosure(host, 'Rücknahmejournal verwalten');
 new Setting(journal).setName('Journal löschen').setDesc('Entfernt die gespeicherten Rücknahmemöglichkeiten. Deine Notizen werden nicht geändert.').addButton(b => b.setButtonText('Journal löschen').onClick(() => {
  c.writer.journal.splice(0); void c.persist().then(() => ctx.report('Journal gelöscht.')).catch(e => ctx.report(errorMessage(e), true));
 }));
}
