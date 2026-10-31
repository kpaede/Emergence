import type {Concept, GraphSnapshot, Suggestion} from '../types';
import {matchingTargets} from '../llm/assignment-scope';
import {targetTitle, shortWikilink, fullWikilink} from './wikilink';

export const needsTargetChoice = (s: Suggestion): boolean => (s.targetCandidates?.length ?? 0) > 1 && !s.targetSelected;
export function existingTargetMatches(label: string, graph: GraphSnapshot, source: string): Concept[] {
 return matchingTargets(label, graph.nodes.filter(n => n.exists && n.id !== source && n.id.endsWith('.md'))).sort((a,b) => a.id.localeCompare(b.id));
}
/** Name matches are existing knowledge, even outside the model's title shortlist. */
export function refreshTargetMatch(s: Suggestion, graph: GraphSnapshot): boolean {
 const matches = existingTargetMatches(s.targetLabel ?? targetTitle(s.target), graph, s.source);
 if (!matches.length) return false;
 const chosen = matches.find(n => n.id === s.target) ?? matches[0]!;
 const value = s.value === shortWikilink(s.target) || s.value === fullWikilink(s.target) ? shortWikilink(chosen.id) : s.value;
 const patch = {target: chosen.id, targetKind: 'existing' as const, value,
  targetCandidates: matches.length > 1 ? matches.map(n => n.id) : undefined,
  targetSelected: matches.length > 1 ? !!s.targetSelected && chosen.id === s.target : undefined};
 if (Object.entries(patch).every(([key,value]) => JSON.stringify(s[key as keyof Suggestion]) === JSON.stringify(value))) return false;
 Object.assign(s, patch); return true;
}
