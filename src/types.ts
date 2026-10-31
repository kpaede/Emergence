import type {SynopsisDepth, SynopsisRelation} from './graph/synopsis-types';
export interface Concept {
 id: string; title: string; aliases: string[]; tags: string[]; type: string; exists: boolean;
 mtime: number; size: number;
 properties?: string[];
 citation?: {citekey: string; state: 'missing' | 'ambiguous' | 'noteless'; indexedKey?: string; reference?: LiteratureReference};
}
export interface LiteratureReference {title?: string; detail?: string; citekey?: string; indexedKey?: string; state?: 'missing' | 'ambiguous' | 'noteless'}
export type RelationClass = 'unknown' | 'taxonomic' | 'mereological' | 'causal' | 'associative' | 'sequential';
export interface RelationRule {
 label: string; description: string; class: RelationClass; hierarchical: boolean;
 acyclic: boolean; transitive: boolean; symmetric: boolean; inverse: string;
 direction: 'forward' | 'reverse'; allowSelf: boolean; writable: boolean;
 targetProperty: string; eligibleNodeTypes: string[]; provenance: 'user' | 'unknown';
}
export interface Edge {
 reference?: LiteratureReference;
 id: string; source: string; target: string; layer: 'breadcrumbs' | 'obsidian' | 'zotlit';
 field: string; explicit: boolean; provenance: string;
 occurrences: {kind: 'body' | 'frontmatter' | 'aggregate'; property?: string; line?: number}[];
}
export interface GraphSnapshot {
 version: number; builtAt: number; nodes: Concept[]; edges: Edge[];
 fields: string[]; groups: {label: string; fields: string[]}[];
 rules: Record<string, RelationRule>; partial: boolean; diagnostics: string[];
 unresolved: {source: string; link: string; count: number; occurrences?: Edge['occurrences']}[]; breadcrumbsVersion: string;
 inferenceRules?: BreadcrumbsInference[];
 zotlit?: {status: 'unavailable' | 'loading' | 'ready' | 'error'; message: string; edges: number};
}
export interface BreadcrumbsInference {chain: string[]; field: string; reversed: boolean; rounds: number}
export type Decision = 'pending' | 'accepted' | 'rejected';
export interface Suggestion {
 id: string; analysisId: string; source: string; sourceVersion: string;
 operation: 'add'; target: string; targetKind: 'existing' | 'unresolved'; field: string; property: string; value: string;
 reason: string; evidence: string; confidence: 'low' | 'medium' | 'high';
 status: Decision; outputId: string;
 contract?: 'breadcrumbs-v2'; evidenceSource?: 'content' | 'title';
 targetLabel?: string; targetCandidates?: string[]; targetSelected?: boolean;
}
export interface Candidate {
 id: string; label: string; definition: string; reason: string; evidence: string;
 parents: string[]; children: string[]; related: string[]; duplicates: string[];
 status: 'proposed' | 'keep-for-later' | 'rejected';
}
export interface OutputModule {
 id: string; enabled: boolean; kind: 'relations' | 'concepts' | 'text' | 'table' | 'json';
 maxSuggestions: number; eligibleNodeTypes: string[]; allowedEdgeTypes: string[];
 targetProperty: string; dataType: 'wikilink-list' | 'text' | 'json';
 writeMode: 'review' | 'display'; language: 'de' | 'en' | 'note'; minEvidence: 'low' | 'medium' | 'high';
 promptTemplate: string; visibility: boolean; requiresManualReview: true;
}
export type PromptKey = 'system' | 'extract' | 'assign' | 'relations' | 'discover' | 'validate';
export interface Profile {
 id: string; name: string; version: number; instructions: string;
 language: 'de' | 'en' | 'note'; temperature: number; maxTokens: number;
 templates: Record<PromptKey, string>; outputs: OutputModule[];
}
export interface Settings {
 citekeyFormat?: 'brackets' | 'at' | 'plain';
 schemaVersion: 1; endpoint: string; model: string; numCtx: number; timeoutMs: number;
 think: boolean; releaseModel: boolean; maxConcurrent: number;
 rules: Record<string, RelationRule>; profiles: Profile[]; activeProfile: string;
 inquiryTemplates: {name: string; prompt: string}[]; maxGraphNodes: number; maxGraphEdges: number;
 synopsis?: {depths?: Partial<Record<SynopsisRelation, SynopsisDepth>>; fields?: Partial<Record<SynopsisRelation, string[]>>};
 graphStructure?: {up: string; down: string; left: string; right: string; examples?: string; depth: number};
 conceptFolders: string[]; graphHeight: number; layout: 'elk' | 'fcose' | 'concentric';
 assignment: {allFolders: boolean; allowNewTargets: boolean; excludeExistingTargets: boolean; propertyFilter: 'none' | 'breadcrumbs' | 'custom'; properties: string[]; fieldsByNote: Record<string, string[]>};
 fieldDescriptions: Record<string, string>;
}
export interface Issue {level: 'block' | 'warn'; message: string; path?: string[]}
export interface AnalysisResult {
 webSearch?: import('./llm/web-search').WebSearchContext;
 id: string; source: string; sourceVersion: string; suggestions: Suggestion[]; candidates: Candidate[];
 artifacts: {outputId: string; content: string}[]; completed: number; total: number;
 status: 'complete' | 'partial' | 'cancelled'; errors: string[];
 elapsedMs?: number; discarded?: number;
 fields?: string[]; perField?: number;
 wikipedia?: WikipediaContext;
 diagnostics?: {sourceMode?:'full'|'overview';sourceParts?:number;requests: number; titlesTotal: number; titlesSent: number; titleMode?: 'full' | 'local'; estimatedTokens?: number; ignoredLines: number; preparationMs: number; model: ModelMetrics[]};
}
export interface WikipediaSource {id: string; title: string; url: string; excerpt: string; related: string[]; language: 'de' | 'en'}
export interface WikipediaContext {query: string; status: 'ready' | 'empty' | 'error'; sources: WikipediaSource[]; fetchedAt: string; message?: string; cached?: boolean; shortened?: boolean}
export interface WikipediaRequest {enabled?: boolean; term?: string}
export interface ModelMetrics {loadMs?: number; promptMs?: number; generationMs?: number; inputTokens?: number; outputTokens?: number}
export interface JournalEntry {
 id: string; path: string; time: number; beforeHash: string; afterHash: string;
 beforeFrontmatter: string; afterFrontmatter: string; status: 'applied' | 'undone' | 'refresh-failed';
 changes: {property: string; target: string; value?: string}[];
}
