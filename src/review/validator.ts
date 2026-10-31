import type {GraphSnapshot, Issue, Profile, Suggestion} from '../types';
import {findPath} from '../graph/registry';
import {safeProperty} from '../util';
import {needsTargetChoice} from './target-matches';

export function validateSuggestion(s: Suggestion, graph: GraphSnapshot, sourceContent: string, profile: Profile): Issue[] {
 const issues: Issue[] = [], block = (message: string) => issues.push({level: 'block', message});
 const source = graph.nodes.find(n => n.id === s.source), target = graph.nodes.find(n => n.id === s.target);
 const rule = graph.rules[s.field];
 const assignment = s.contract === 'breadcrumbs-v2';
 if (needsTargetChoice(s)) block('Bitte eine vorhandene Zielnotiz auswählen.');
 const output = profile.outputs.find(o => o.id === s.outputId && o.enabled && o.kind === 'relations');
 if (!source?.exists || !s.target.endsWith('.md') || /[[\]#|\n\r\0\\]/u.test(s.target) || s.target.startsWith('/') || s.target.split('/').some(p => !p || p === '.' || p === '..')) block('Ungültiger konkreter Markdown-Zielpfad.');
 if (s.targetKind === 'existing' && !target?.exists) block('Als vorhanden bezeichnete Zielnotiz fehlt.');
 if (s.targetKind === 'unresolved') {
  if (target?.exists) block('Das als neu bezeichnete Ziel existiert bereits. Zielart korrigieren.');
  issues.push({level: 'warn', message: 'Noch nicht angelegtes Ziel: Es wird ausschließlich ein Wiki-Link ergänzt. Keine Datei wird erstellt.'});
  const basename = s.target.split('/').at(-1)?.replace(/\.md$/u, '').toLocaleLowerCase();
  const similar = graph.nodes.filter(n => [n.title, ...n.aliases].some(v => v.toLocaleLowerCase() === basename));
  if (similar.length) issues.push({level: 'warn', message: `Ähnliche vorhandene Begriffe prüfen: ${similar.map(n => n.id).join(', ')}`});
 }
 if (!['existing', 'unresolved'].includes(s.targetKind)) block('Zielart muss ausdrücklich feststehen.');
 if ((!rule && !assignment) || !graph.fields.includes(s.field)) block('Nicht konfiguriertes Edge Field.');
 if (assignment ? !rule?.description.trim() || rule.provenance !== 'user' || !rule.writable : !rule?.writable || rule.provenance !== 'user' || rule.class === 'unknown') block('Feldbeschreibung oder Schreibfreigabe fehlt in den Einstellungen.');
 if (!safeProperty(s.property) || (!assignment && s.property !== rule?.targetProperty) || s.property !== s.field) block('Frontmatter-Zielfeld ist nicht autorisiert.');
 if (s.operation !== 'add') block('V1 schreibt ausschließlich Ergänzungen.');
 if (!output || output.writeMode !== 'review') block('Output ist nicht zum Review-Schreiben konfiguriert.');
 if (output?.targetProperty && output.targetProperty !== s.property) block('Output-Property stimmt nicht überein.');
 if (output?.allowedEdgeTypes.length && !output.allowedEdgeTypes.includes(s.field)) block('Beziehungstyp ist im Output nicht erlaubt.');
 if (output?.eligibleNodeTypes.length && (!target || !output.eligibleNodeTypes.includes(target.type))) block('Zieltyp ist im Output nicht erlaubt oder noch unbekannt.');
 if (rule?.eligibleNodeTypes.length && (!target || !rule.eligibleNodeTypes.includes(target.type))) block('Zieltyp ist in der Feldsemantik nicht erlaubt oder noch unbekannt.');
 if (s.target === s.source && !rule?.allowSelf) block('Selbstreferenz ist nicht erlaubt.');
 if (!s.evidence.trim() || (assignment && s.evidenceSource === 'title' ? s.evidence !== source?.title : !sourceContent.includes(s.evidence))) block('Keine nachprüfbare Ausgangsstelle in Notiztitel oder Quelltext.');
 const confidence = {low: 0, medium: 1, high: 2};
 if (!assignment && output && confidence[s.confidence] < confidence[output.minEvidence]) block('Gewünschte qualitative Evidenzstufe wird unterschritten (keine kalibrierte Wahrscheinlichkeit).');
 if (graph.edges.some(e => e.layer === 'breadcrumbs' && e.explicit && e.source === s.source && e.target === s.target && e.field === s.field)) block('Identische direkte Beziehung existiert bereits.');
 const path = findPath(graph, s.source, s.target, s.field);
 if (path && path.length > 2) issues.push({level: 'warn', message: rule?.transitive ? 'Bereits transitiv erreichbar; zusätzliche direkte Beziehung fachlich prüfen.' : 'Alternativer Pfad vorhanden; keine automatische Redundanzannahme.', path});
 if (rule?.acyclic && findPath(graph, s.target, s.source, s.field)) block('Diese ausdrücklich azyklisch konfigurierte Relation würde einen Zyklus bilden.');
 if (graph.partial) block('Graph ist partiell; vollständige Linkauflösung vor einer Schreibfreigabe erforderlich.');
 return issues;
}
