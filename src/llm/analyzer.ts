import type {AnalysisResult, GraphSnapshot, Profile, Settings} from '../types';
import type {LLMProvider} from './provider';
import {ContextBudgetError} from './context';
import {prepareLongContext} from './long-context';
import {assignmentDocument} from './assignment-document';
import type {ModelMetrics} from '../types';
import {parseAssignments, parseFieldIdeas, parseAssociativeIdeas, type fieldIdeasSchema} from './assignment-schema';
import {prepareAssignments, type AssignmentOptions} from './assignment-context';
import {sourceFields} from './assignment-scope';
import {assignmentTarget, alreadyAssigned} from './assignment-result';
import {assert, errorMessage, hash} from '../util';
import {resolveEvidence} from './evidence';
import {shortWikilink} from '../review/wikilink';
import {refreshTargetMatch} from '../review/target-matches';

export class DocumentAnalyzer {
 constructor(private provider: LLMProvider) {}
 async analyze(source: string, content: string, graph: GraphSnapshot, profile: Profile, settings: Settings,
  signal: AbortSignal, progress: (message: string) => void, configured?: AssignmentOptions): Promise<AnalysisResult> {
  const started = performance.now(), id = crypto.randomUUID(), sourceVersion = await hash(content);
  const output = profile.outputs.find(o => o.enabled && o.kind === 'relations');
  assert(output, 'Im Analyseprofil muss ein Beziehungsmodul aktiviert sein.');
  const options: AssignmentOptions = configured ?? {fields: sourceFields(content, graph), folders: settings.assignment.allFolders ? [] : settings.conceptFolders,
   allowNew: settings.assignment.allowNewTargets, maxSuggestions: Math.min(output.maxSuggestions, 8), outputId: output.id,
   excludeExistingTargets: settings.assignment.excludeExistingTargets,
   targetProperties: settings.assignment.propertyFilter === 'breadcrumbs' ? graph.fields : settings.assignment.propertyFilter === 'custom' ? settings.assignment.properties : []};
  options.fields = options.fields.filter(field => !output.allowedEdgeTypes.length || output.allowedEdgeTypes.includes(field));
  const result: AnalysisResult = {id, source, sourceVersion, suggestions: [], candidates: [], artifacts: [], completed: 0, total: 0, status: 'complete', errors: [], discarded: 0};
  if (options.perField) {result.fields = [...options.fields]; result.perField = options.perField;}
  if (options.associative) {result.fields = [...options.fields]; result.associative = true;}
  if (signal.aborted) {result.status = 'cancelled'; return result;}
  let prepared:ReturnType<typeof prepareAssignments>,preparationRequests=0,sourceParts=1,sourceMode:'full'|'overview'='full';const preparationMetrics:ModelMetrics[]=[];
  try{prepared=prepareAssignments(source,content,graph,profile,settings,options);}
  catch(error){
   if(!(error instanceof ContextBudgetError))throw error;
   const fits=(text:string):boolean=>{try{prepareAssignments(source,content,graph,profile,settings,{...options,overview:{text,parts:Math.max(1,content.length)}});return true;}catch(error){if(error instanceof ContextBudgetError)return false;throw error;}};
   const question=`Fachliche Bedeutung, Definitionen, Beispiele, Einschränkungen und Beziehungen der gesamten Notiz ${source}. Bewahre die Grundlage für spätere Breadcrumbs-Zuordnungen.`;
   const document=assignmentDocument(content),overview=await prepareLongContext(this.provider,document.evidence.map(span=>span.text).join(''),question,settings,signal,fits,{progress,onMetrics:metrics=>preparationMetrics.push(metrics)});
   preparationRequests=overview.requests;sourceParts=overview.parts;sourceMode=overview.mode;
   prepared=prepareAssignments(source,content,graph,profile,settings,{...options,overview:{text:overview.text,parts:overview.parts}});
  }
  result.total = prepared.sections.length;
  if(prepared.contexts[0]!.webSearch)result.webSearch=prepared.contexts[0]!.webSearch;
  if(prepared.contexts[0]!.wikipedia)result.wikipedia=prepared.contexts[0]!.wikipedia;
  result.diagnostics = {requests: preparationRequests, sourceMode,sourceParts, titlesTotal: prepared.targets.length, titlesSent: prepared.contexts[0]!.candidates.length,
   titleMode: prepared.contexts[0]!.titleMode, estimatedTokens: prepared.contexts[0]!.estimatedTokens, ignoredLines: prepared.contexts[0]!.ignoredLines, preparationMs: Math.round(performance.now() - started), model: preparationMetrics};
  for (let index = 0; index < prepared.sections.length; index++) {
   if (signal.aborted) {result.status = 'cancelled'; break;}
   const section = prepared.sections[index]!, context = prepared.contexts[index]!;
   progress(`${options.associative ? 'Begriffe werden assoziiert' : prepared.contexts.length === 1 ? 'Notiz wird zugeordnet' : `Feldgruppe ${index + 1}/${prepared.contexts.length}`} · ${context.fields.join(', ')}`);
   try {
    result.diagnostics.requests++;
    const response = await this.provider.chat({messages: context.messages, temperature: profile.temperature,
     maxTokens: context.maxTokens, format: context.format, signal, onMetrics: metrics => result.diagnostics!.model.push(metrics)});
    const parsed = options.associative ? parseAssociativeIdeas(response, context.format) : options.perField ? parseFieldIdeas(response, context.format as ReturnType<typeof fieldIdeasSchema>) : parseAssignments(response, context.format);
    assert(!signal.aborted, 'Analyse abgebrochen.');
    for (const assignment of parsed.suggestions) {
     assert(!/^N\d+$/u.test(assignment.target) || context.refs.has(assignment.target), 'Unbekannte Ziel-ID.');
     const target = assignmentTarget(assignment, context.refs, prepared.targets, graph, source, options);
     if (!target || target.path === source || alreadyAssigned(source, target.path, assignment.field, graph, content, options.excludeExistingTargets)
      || result.suggestions.some(s => s.target === target.path && (!options.perField || s.field === assignment.field))
      || (options.perField ? result.suggestions.filter(s => s.field === assignment.field).length >= options.perField : result.suggestions.length >= options.maxSuggestions)) {result.discarded!++; continue;}
     const evidence = assignment.evidence === 'T' ? prepared.title : resolveEvidence(assignment.evidence, context.evidence, section.content);
     result.suggestions.push({id: crypto.randomUUID(), analysisId: id, source, sourceVersion, operation: 'add',
      target: target.path, targetKind: target.kind, field: assignment.field, property: assignment.field,
      value: options.perField || options.associative ? shortWikilink(target.path) : `[[${target.path.replace(/\.md$/u, '')}]]`, reason: '', evidence, confidence: 'medium', status: 'pending', outputId: output.id,
      contract: 'breadcrumbs-v2', evidenceSource: assignment.evidence === 'T' ? 'title' : 'content', ...(target.label ? {targetLabel: target.label} : {})});
     if (options.perField || options.associative) refreshTargetMatch(result.suggestions.at(-1)!, graph);
    }
    result.completed++;
   } catch (error) {result.errors.push(errorMessage(error)); result.status = signal.aborted ? 'cancelled' : 'partial'; break;}
  }
  result.elapsedMs = Math.round(performance.now() - started);
  return result;
 }
}
