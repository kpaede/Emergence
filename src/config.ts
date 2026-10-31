import {synopsisRelations} from './graph/synopsis-types';
import type {OutputModule, Profile, RelationRule, Settings} from './types';
import {assert, clone, safeProperty} from './util';
export const templateVariables = ['language', 'instructions', 'note.title', 'note.path', 'note.content', 'selection',
 'graph.edge_fields', 'graph.relevant_nodes', 'graph.existing_edges', 'outputs.enabled', 'evidence.sections'];
const stringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
const validTemplate = (v: unknown): v is string => typeof v === 'string' && [...v.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/gu)].every(m => templateVariables.includes(m[1]!));

export const unknownRule = (label: string): RelationRule => ({
 label, description: '', class: 'unknown', hierarchical: false, acyclic: false,
 transitive: false, symmetric: false, inverse: '', direction: 'forward', allowSelf: false,
 writable: false, targetProperty: '', eligibleNodeTypes: [], provenance: 'unknown',
});
const output = (id: string, kind: OutputModule['kind']): OutputModule => ({
 id, kind, enabled: true, maxSuggestions: 8, eligibleNodeTypes: [], allowedEdgeTypes: [],
 targetProperty: '', dataType: 'wikilink-list', writeMode: kind === 'relations' ? 'review' : 'display',
 language: 'de', minEvidence: 'medium', promptTemplate: '', visibility: true, requiresManualReview: true,
});
export const defaultProfile = (): Profile => ({
 id: 'strict', name: 'Strenge Klassifikation', version: 1, language: 'de', temperature: 0.2,
 maxTokens: 768, instructions: 'Ordne die Notiz ihren ausgewählten Breadcrumbs-Feldern zu. Nur fachlich passende Zielnotizen; bei Unsicherheit keine Zuordnung.',
 templates: {
  system: 'Ausgabesprache: {{language}}.',
  extract: 'Extrahiere belegte Begriffe.',
  assign: 'Verwende vorhandene Kandidaten-IDs.',
  relations: 'Prüfe für jedes ausgewählte Feld, ob die Zielnotiz genau dessen Rolle gegenüber der Ausgangsnotiz erfüllt. Ein gemeinsames Wort oder Thema genügt nicht. Verwende je Ziel höchstens die passendste Zuordnung.',
  discover: 'Neue Konzepte nur mit Beleg und Dublettenprüfung.',
  validate: 'Nur gültiges JSON für die aktivierten Output-IDs.',
 }, outputs: [output('relations', 'relations')],
});
export const defaults = (): Settings => ({
 schemaVersion: 1, endpoint: 'http://127.0.0.1:11434', model: 'qwen3.5:9b', numCtx: 8192,
 timeoutMs: 180000, think: false, releaseModel: false, maxConcurrent: 1, rules: {},
 profiles: [defaultProfile()], activeProfile: 'strict', inquiryTemplates: [
  {name: 'Widersprüche', prompt: 'Welche philosophischen Positionen widersprechen dieser These? Trenne lokale Belege und unbestätigtes Modellwissen.'},
  {name: 'Kunstwerke', prompt: 'Welche Kunstwerke passen zum Thema? Kennzeichne nicht verifizierte Angaben. Erfinde keine Quellen oder URLs.'},
 ], maxGraphNodes: 1500, maxGraphEdges: 6000, conceptFolders: [], graphHeight: 560, layout: 'elk',
 assignment: {allFolders: true, allowNewTargets: true, excludeExistingTargets: false, propertyFilter: 'none', properties: [], fieldsByNote: {}}, fieldDescriptions: {},
});
export function validateSettings(s: Settings): void {
 assert(s !== null && typeof s === 'object', 'Einstellungen müssen ein JSON-Objekt sein.');
 assert(s.schemaVersion === 1, 'Nicht unterstützte Einstellungsversion.');
 const url = new URL(s.endpoint);
 assert(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash,
 'Nur eine lokale HTTP-Loopback-Adresse ist in V1 zulässig.');
 assert(typeof s.model === 'string' && s.model.length > 0 && !s.model.includes(':cloud'), 'Ein lokales Modell ist erforderlich.');
 assert(typeof s.think === 'boolean' && typeof s.releaseModel === 'boolean' && stringArray(s.conceptFolders), 'Ungültige Modell- oder Registeroptionen.');
 assert(s.assignment && [s.assignment.allFolders, s.assignment.allowNewTargets, s.assignment.excludeExistingTargets].every(v => typeof v === 'boolean')
  && ['none', 'breadcrumbs', 'custom'].includes(s.assignment.propertyFilter) && stringArray(s.assignment.properties), 'Ungültige Zuordnungseinstellungen.');
 assert(s.assignment.propertyFilter !== 'custom' || s.assignment.properties.length > 0, 'Mindestens einen Frontmatter-Schlüssel für den Zielfilter angeben.');
 assert(s.assignment.fieldsByNote && typeof s.assignment.fieldsByNote === 'object' && !Array.isArray(s.assignment.fieldsByNote)
  && Object.entries(s.assignment.fieldsByNote).every(([path, fields]) => path.endsWith('.md') && stringArray(fields)), 'Ungültige gespeicherte Feldauswahl.');
 assert(s.fieldDescriptions && typeof s.fieldDescriptions === 'object' && !Array.isArray(s.fieldDescriptions)
  && Object.values(s.fieldDescriptions).every(value => typeof value === 'string' && value.length <= 3000), 'Ungültige Feldbeschreibungen.');
 assert(s.conceptFolders.every(folder => folder === '/' || (!folder.startsWith('/') && !folder.includes('\\') && !folder.split('/').some(part => part === '..' || part === '.'))), 'Zielordner müssen relative Vaultpfade sein.');
 assert(Array.isArray(s.inquiryTemplates) && s.inquiryTemplates.every(t => t && typeof t.name === 'string' && typeof t.prompt === 'string'), 'Ungültige Recherchevorlagen.');
 assert(s.rules && typeof s.rules === 'object' && !Array.isArray(s.rules), 'Ungültige Semantiktabelle.');
 for (const [value, min, max] of [[s.numCtx, 2048, 131072], [s.timeoutMs, 1000, 1800000],
  [s.maxConcurrent, 1, 2], [s.maxGraphNodes, 50, 10000], [s.maxGraphEdges, 100, 50000], [s.graphHeight, 250, 2000]]) {
  assert(Number.isInteger(value) && value! >= min! && value! <= max!, 'Ungültiges numerisches Limit.');
 }
 if (s.synopsis!==undefined) {
  assert(s.synopsis!==null&&typeof s.synopsis==='object'&&!Array.isArray(s.synopsis),'Ungültige Konfiguration der Relationssynopse.');
  if(s.synopsis.depths!==undefined)assert(s.synopsis.depths!==null&&typeof s.synopsis.depths==='object'&&!Array.isArray(s.synopsis.depths)&&Object.entries(s.synopsis.depths).every(([key,value])=>synopsisRelations.includes(key as typeof synopsisRelations[number])&&[1,2,3,'all'].includes(value)),'Ungültige Sichttiefe der Relationssynopse.');
  if(s.synopsis.fields!==undefined)assert(s.synopsis.fields!==null&&typeof s.synopsis.fields==='object'&&!Array.isArray(s.synopsis.fields)&&Object.entries(s.synopsis.fields).every(([key,value])=>synopsisRelations.includes(key as typeof synopsisRelations[number])&&stringArray(value)),'Ungültige Feldzuordnung der Relationssynopse.');
 }
 if (s.graphStructure) assert(['up', 'down', 'left', 'right'].every(key => typeof s.graphStructure![key as 'up'] === 'string') && (s.graphStructure.examples === undefined || typeof s.graphStructure.examples === 'string') && Number.isInteger(s.graphStructure.depth) && s.graphStructure.depth >= 1 && s.graphStructure.depth <= 3, 'Ungültige Graphachsen.');
 assert(['elk', 'fcose', 'concentric'].includes(s.layout), 'Unbekanntes Layout.');
 assert(Array.isArray(s.profiles) && s.profiles.length > 0 && s.profiles.length <= 30, 'Ein bis 30 Profile erforderlich.');
 assert(new Set(s.profiles.map(p => p.id)).size === s.profiles.length, 'Profil-IDs müssen eindeutig sein.');
 assert(s.profiles.some(p => p.id === s.activeProfile), 'Aktives Profil fehlt.');
 for (const p of s.profiles) {
  assert(typeof p.id === 'string' && p.id.length > 0 && typeof p.name === 'string' && Number.isInteger(p.version) && p.version >= 1, 'Ungültiges Profil.');
  assert(p.templates && ['system', 'extract', 'assign', 'relations', 'discover', 'validate'].every(key => validTemplate(p.templates[key as keyof Profile['templates']])), 'Prompts enthalten unbekannte Platzhalter oder fehlende Templates.');
  assert(Array.isArray(p.outputs) && p.outputs.length <= 25, 'Ungültige Output-Liste.');
  assert(p.temperature >= 0 && p.temperature <= 2 && Number.isInteger(p.maxTokens) && p.maxTokens >= 128 && p.maxTokens < s.numCtx - 1024, 'Ungültiges Modellbudget im Profil.');
  assert(['de', 'en', 'note'].includes(p.language) && typeof p.instructions === 'string', 'Ungültige Profilsprache.');
  assert(new Set(p.outputs.map(o => o.id)).size === p.outputs.length, 'Output-IDs müssen eindeutig sein.');
  for (const o of p.outputs) {
   assert(typeof o.id === 'string' && o.id.length > 0 && typeof o.enabled === 'boolean' && typeof o.visibility === 'boolean', 'Ungültige Output-Metadaten.');
   assert(stringArray(o.eligibleNodeTypes) && stringArray(o.allowedEdgeTypes) && typeof o.targetProperty === 'string', 'Ungültige Output-Zuordnung.');
   assert(['de', 'en', 'note'].includes(o.language) && ['wikilink-list', 'text', 'json'].includes(o.dataType) && validTemplate(o.promptTemplate), 'Ungültiges Output-Format oder Template.');
   assert(o.requiresManualReview === true, 'Manuelle Prüfung kann nicht deaktiviert werden.');
   assert(Number.isInteger(o.maxSuggestions) && o.maxSuggestions >= 0 && o.maxSuggestions <= 100, 'Ungültiges Vorschlagslimit.');
   assert(['relations', 'concepts', 'text', 'table', 'json'].includes(o.kind), 'Unbekannter Output-Typ.');
   assert(o.writeMode === 'display' || (o.writeMode === 'review' && o.kind === 'relations'), 'Schreibbare Custom Outputs werden in V1 blockiert.');
   assert(['low', 'medium', 'high'].includes(o.minEvidence), 'Ungültige Evidenzstufe.');
  }
 }
 for (const [label, r] of Object.entries(s.rules)) {
  assert(r && [r.hierarchical, r.acyclic, r.transitive, r.symmetric, r.allowSelf, r.writable].every(v => typeof v === 'boolean')
   && typeof r.description === 'string' && typeof r.targetProperty === 'string' && typeof r.inverse === 'string' && stringArray(r.eligibleNodeTypes), 'Ungültige Semantikregel.');
  assert(r.label === label && r.provenance === 'user', 'Regeln benötigen explizite Benutzerprovenienz.');
  assert(['unknown', 'taxonomic', 'mereological', 'causal', 'associative', 'sequential'].includes(r.class), 'Ungültige Beziehungsklasse.');
  assert(['forward', 'reverse'].includes(r.direction), 'Ungültige Richtung.');
  assert(!r.writable || (safeProperty(r.targetProperty) && r.targetProperty === label && r.description.trim().length > 0),
   'Schreibfelder müssen dem Breadcrumbs-Label entsprechen und eine bestätigte Semantik besitzen.');
 }
}
export function migrateSettings(input: unknown): Settings {
 const d = defaults();
 if (input === null || typeof input !== 'object') return d;
 const raw = input as Partial<Settings>;
 assert(raw.schemaVersion === undefined || raw.schemaVersion === 1, 'Neuere Einstellungen können nicht verlustfrei geladen werden.');
 const s = {...d, ...raw, rules: raw.rules ?? {}, profiles: raw.profiles ?? d.profiles,
  assignment: {...d.assignment, allFolders: !(raw.conceptFolders?.length), ...raw.assignment}, fieldDescriptions: raw.fieldDescriptions ?? {}};
 validateSettings(s);
 return clone(s);
}
