import {Setting, type ToggleComponent} from 'obsidian';
import {unknownRule} from '../../config';
import {badge, disclosure, emptyState} from '../panel';
import {csv, type SettingsContext} from './context';
export function relationSettings(ctx: SettingsContext, selected: string, selectField: (field: string) => void): void {
 const {host, draft: s, controller: c} = ctx, fields = c.graph.snapshot.fields;
 new Setting(host).setName('Beziehungen und Schreibrechte').setHeading();
 host.createDiv({text: 'Beschreibe die Bedeutung deiner eigenen Breadcrumbs-Felder. Diese Beschreibungen werden der KI unverändert übergeben und können jederzeit geändert werden.', cls: 'em-muted'});
 if (!fields.length) {emptyState(host, 'unplug', 'Keine Breadcrumbs-Felder erkannt', 'Aktiviere Breadcrumbs und aktualisiere den Graphindex.'); return;}
 const label = fields.includes(selected) ? selected : fields[0]!;
 new Setting(host).setName('Beziehungsfeld').addDropdown(d => d.addOptions(Object.fromEntries(fields.map(f => [f, f]))).setValue(label).onChange(selectField));
 const rule = s.rules[label] ?? unknownRule(label);
 rule.description = s.fieldDescriptions[label] ?? rule.description;
 if (!s.rules[label]) {rule.writable = !!rule.description.trim(); rule.targetProperty = label;}
 if (!rule.description.trim()) {rule.writable = false; rule.targetProperty = '';}
 const mark = () => {rule.provenance = 'user'; s.rules[label] = rule; ctx.changed(); updateWrite();};
 const groupNames = c.graph.snapshot.groups.filter(g => g.fields.includes(label)).map(g => g.label);
 const status = host.createDiv({cls: 'em-setting-summary'}); badge(status, rule.writable ? 'Ergänzungen nach Review erlaubt' : 'Nur lesen');
 if (groupNames.length) status.createDiv({text: `Feldgruppen: ${groupNames.join(', ')}`, cls: 'em-muted'});
 let writeToggle: ToggleComponent | undefined;
 const updateWrite = () => writeToggle?.setDisabled(!rule.description.trim());
 const meaning = new Setting(host).setName('Bedeutung und Zuordnungskriterien').setDesc('Wann passt diese Beziehung? Richtung und Beispiele helfen der Klassifikation.'); meaning.settingEl.addClass('em-setting-stack');
 meaning.addTextArea(t => {t.inputEl.rows = 4; t.setValue(rule.description).onChange(v => {rule.description = v; s.fieldDescriptions[label] = v; if (!v.trim()) rule.writable = false; else if (!s.rules[label]) rule.writable = true; mark();});});
 new Setting(disclosure(host, 'Optionale formale Beziehungsklasse')).setName('Beziehungsklasse').addDropdown(d => d.addOptions({unknown: 'Noch nicht festgelegt', taxonomic: 'Oberbegriff / Unterbegriff', mereological: 'Teil / Ganzes', causal: 'Ursache / Wirkung', associative: 'Assoziativ', sequential: 'Reihenfolge'}).setValue(rule.class).onChange(v => {rule.class = v as typeof rule.class; mark();}));
 new Setting(host).setName('Als Hierarchie darstellen').setDesc('Ordnet diese Beziehung im Hierarchielayout ein.').addToggle(t => t.setValue(rule.hierarchical).onChange(v => {rule.hierarchical = v; mark();}));
 new Setting(host).setName('Geprüfte Ergänzungen erlauben').setDesc(`Schreibziel: „${label}“. Eine Feldbeschreibung genügt; die fachliche Prüfung erfolgt im Review.`).addToggle(t => {
  writeToggle = t; t.setValue(rule.writable).onChange(v => {rule.writable = v; rule.targetProperty = v ? label : ''; mark();}); updateWrite();
 });
 const advanced = disclosure(host, 'Richtung und Prüfregeln');
 new Setting(advanced).setName('Richtung im Hierarchielayout').addDropdown(d => d.addOptions({forward: 'Quelle → Ziel abwärts', reverse: 'Ziel → Quelle abwärts'}).setValue(rule.direction).onChange(v => {rule.direction = v as typeof rule.direction; mark();}));
 new Setting(advanced).setName('Inverses Feld').addDropdown(d => d.addOptions({'': 'Keine Zuordnung', ...Object.fromEntries(fields.map(f => [f, f]))}).setValue(rule.inverse).onChange(v => {rule.inverse = v; mark();}));
 for (const [key, name, description] of [['acyclic', 'Zyklen verbieten', 'Nur für fachlich ausdrücklich azyklische Beziehungen.'], ['transitive', 'Transitiv', 'Die Zuordnung kann über mehrere Schritte gelten.'], ['symmetric', 'Symmetrisch', 'Die Beziehung gilt in beide Richtungen.'], ['allowSelf', 'Selbstreferenzen erlauben', 'Eine Notiz darf auf sich selbst verweisen.']] as const)
  new Setting(advanced).setName(name).setDesc(description).addToggle(t => t.setValue(rule[key]).onChange(v => {rule[key] = v; mark();}));
 new Setting(advanced).setName('Erlaubte Zieltypen').setDesc('Kommagetrennt; leer erlaubt alle Typen.').addText(t => t.setValue(rule.eligibleNodeTypes.join(', ')).onChange(v => {rule.eligibleNodeTypes = csv(v); mark();}));
}
