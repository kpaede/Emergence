import type {Setting, SettingDefinitionItem} from 'obsidian';
export type SettingsSection = 'model' | 'relations' | 'profiles' | 'data';
/** Composite editors stay transactional; aliases make their actual controls discoverable in Obsidian search. */
export function settingsDefinitions(render: (setting: Setting, section: SettingsSection) => void | (() => void), fields: readonly string[], profiles: readonly string[]): SettingDefinitionItem[] {
 const pages: {id: SettingsSection; name: string; desc: string; editor: string; aliases: string[]}[] = [
  {id:'model',name:'Modell',desc:'Lokales Ollama und Anfrageverhalten.',editor:'Ollama und Leistung',aliases:[
   'Ollama-Adresse','Modell','Verbindung testen','Kontextfenster','Zeitlimit in Millisekunden','Gleichzeitige Anfragen','Thinking verwenden','Modell nach Anfrage freigeben',
  ]},
  {id:'relations',name:'Beziehungen',desc:'Bedeutung der Breadcrumbs-Felder und erlaubte Ergänzungen.',editor:'Breadcrumbs-Felder und Zuordnungskriterien',aliases:[
   'Beziehungsfeld','Bedeutung und Zuordnungskriterien','Feldbeschreibungen','Beziehungsklasse','Als Hierarchie darstellen','Geprüfte Ergänzungen erlauben','Richtung im Hierarchielayout','Inverses Feld','Zyklen verbieten','Transitiv','Symmetrisch','Selbstreferenzen erlauben','Erlaubte Zieltypen',...fields,
  ]},
  {id:'profiles',name:'Profile',desc:'Analyseprofile, Anweisungen, Prompts und Ergebnismodule.',editor:'Profile und Promptvorlagen',aliases:[
   'Analyseprofil','Profil duplizieren','Profil löschen','Profilname','Ausgabesprache','Anweisungen an die KI','Temperatur','Maximale Ausgabetokens','Promptvorlagen','Breadcrumbs-Zuordnung','Platzhalter','Ergebnismodule','Ergebnismodul','Ergebnisformat','Freigabe',...profiles,
  ]},
  {id:'data',name:'Daten',desc:'Citekeys, Suchbereich, Konfiguration und Rücknahmejournal.',editor:'Daten und Konfiguration',aliases:[
   'Citekey kopieren','Zielordner für Zuordnungen','Zielfilter über Frontmatter','Frontmatter-Schlüssel','Konfiguration exportieren','Konfiguration importieren','Sitzung zurücksetzen','Sitzung leeren','Rücknahmejournal','Journal löschen',
  ]},
 ];
 return pages.map(page=>({type:'page',name:page.name,desc:page.desc,items:[{
  name:page.editor,aliases:page.aliases,render:setting=>render(setting,page.id),
 }]}));
}
