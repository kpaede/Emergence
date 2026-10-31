import type {GraphSnapshot, Settings, Profile} from '../types';

export interface AssignmentBlocker {kind: 'note' | 'fields' | 'descriptions' | 'filter' | 'profile'; message: string; fields?: string[]}
export function assignmentReadiness(source: string, fields: string[], graph: GraphSnapshot, settings: Settings, profile: Profile): AssignmentBlocker[] {
 const issues: AssignmentBlocker[] = [];
 if (!source.endsWith('.md')) issues.push({kind: 'note', message: 'Öffne zuerst eine Markdown-Notiz im Hauptbereich.'});
 if (!fields.length) issues.push({kind: 'fields', message: 'Im Frontmatter dieser Notiz fehlt ein konfiguriertes Breadcrumbs-Feld. Ergänze dort einen Feldschlüssel; er darf leer sein.'});
 const output = profile.outputs.find(o => o.enabled && o.kind === 'relations');
 if (!output || output.maxSuggestions === 0) issues.push({kind: 'profile', message: 'Aktiviere im Analyseprofil Beziehungsvorschläge mit mindestens einem Ergebnis.'});
 const usable = fields.filter(field => !output?.allowedEdgeTypes.length || output.allowedEdgeTypes.includes(field));
 if (fields.length && !usable.length) issues.push({kind: 'profile', message: 'Das Analyseprofil erlaubt keines der ausgewählten Felder.'});
 const missing = usable.filter(field => !graph.rules[field]?.description.trim());
 if (missing.length) issues.push({kind: 'descriptions', message: `Feldbeschreibung noch nicht gespeichert: ${missing.join(', ')}.`, fields: missing});
 if (settings.assignment.propertyFilter === 'custom' && !settings.assignment.properties.length) issues.push({kind: 'filter', message: 'Trage mindestens einen Frontmatter-Schlüssel für den Zielfilter ein und übernimm den Suchbereich.'});
 return issues;
}
