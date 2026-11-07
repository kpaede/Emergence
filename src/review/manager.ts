import type {AnalysisResult, GraphSnapshot, Profile, Suggestion} from '../types';
import {assert, clone} from '../util';
import {validateSuggestion} from './validator';
import {refreshTargetMatch} from './target-matches';

export class ReviewManager {
 private result?: AnalysisResult;
 private appliedIdeas = new Map<string, Suggestion>();
 revision = 0;
 set(result: AnalysisResult): void {
  this.result = clone(result); this.revision++;
  this.appliedIdeas.clear();
  for (const s of this.result.suggestions) s.status = 'pending';
 }
 get analysis(): AnalysisResult | undefined {return this.result ? clone(this.result) : undefined;}
 refreshTargets(graph: GraphSnapshot): void {
  if (!this.result?.perField && !this.result?.associative) return;
  let changed = false;
  for (const s of this.result.suggestions) if (s.status === 'pending') changed = refreshTargetMatch(s, graph) || changed;
  if (changed) this.revision++;
 }
 clear(): void {this.result = undefined; this.appliedIdeas.clear(); this.revision++;}
 consumeIdea(id: string, journalId: string, version: string): void {
  const s = this.result?.suggestions.find(s => s.id === id); if (!s || !this.result) return;
  this.appliedIdeas.set(journalId, clone(s));
  this.result.suggestions = this.result.suggestions.filter(s => s.id !== id);
  this.result.sourceVersion = version;
  for (const remaining of this.result.suggestions) remaining.sourceVersion = version;
  this.revision++;
 }
 restoreIdea(journalId: string, version: string): void {
  const s = this.appliedIdeas.get(journalId); if (!s || this.result?.id !== s.analysisId) return;
  this.result.suggestions.push({...s, status: 'pending', sourceVersion: version});
  this.result.sourceVersion = version; this.appliedIdeas.delete(journalId); this.revision++;
 }
 setCandidateStatus(id: string, status: 'proposed' | 'keep-for-later' | 'rejected'): void {
  const c = this.result?.candidates.find(c => c.id === id); assert(c, 'Kandidat fehlt.'); c.status = status;
 }
 proposeCandidateLink(id: string, target: string, field: string, property: string, outputId: string): void {
  const result = this.result; assert(result?.status === 'complete', 'Nur vollständige Analysen können Wikilinks vorschlagen.');
  const candidate = result.candidates.find(c => c.id === id); assert(candidate && candidate.status !== 'rejected', 'Kandidat fehlt oder wurde abgelehnt.');
  result.suggestions.push({id: crypto.randomUUID(), analysisId: result.id, source: result.source, sourceVersion: result.sourceVersion,
   operation: 'add', target, targetKind: 'unresolved', field, property, value: `[[${target.replace(/\.md$/u, '')}]]`,
   reason: candidate.reason, evidence: candidate.evidence, confidence: 'medium', status: 'pending', outputId});
  this.revision++;
 }
 decide(id: string, decision: 'accepted' | 'rejected', graph: GraphSnapshot, content: string, profile: Profile): void {
  const s = this.result?.suggestions.find(s => s.id === id); assert(s, 'Vorschlag fehlt.');
  if (decision === 'accepted') {
   assert(this.result?.status === 'complete', 'Teilweise oder abgebrochene Analysen können nichts schreiben.');
   assert(!validateSuggestion(s, graph, content, profile).some(i => i.level === 'block'), 'Vorschlag enthält blockierende Validierungsfehler.');
  }
  s.status = decision; this.revision++;
 }
 edit(id: string, patch: Pick<Suggestion, 'target' | 'targetKind' | 'field' | 'property' | 'value'> & Partial<Pick<Suggestion, 'targetLabel' | 'targetCandidates' | 'targetSelected'>>): void {
  const s = this.result?.suggestions.find(s => s.id === id); assert(s, 'Vorschlag fehlt.');
  if (!Object.prototype.hasOwnProperty.call(patch, 'targetSelected')) s.targetSelected = true;
  Object.assign(s, patch); s.status = 'pending'; this.revision++;
 }
 rejectPending(): void {for (const s of this.result?.suggestions ?? []) if (s.status === 'pending') s.status = 'rejected'; this.revision++;}
 accepted(): Suggestion[] {
  assert(this.result?.status === 'complete', 'Nur vollständige Analysen können freigegeben werden.');
  assert(this.result.suggestions.every(s => s.status !== 'pending'), 'Ungeprüfte Vorschläge blockieren die Freigabe.');
  const accepted = this.result.suggestions.filter(s => s.status === 'accepted');
  assert(accepted.length > 0, 'Keine akzeptierten Änderungen.');
  return clone(accepted);
 }
}
