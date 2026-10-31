import type {Concept, GraphSnapshot} from '../types';
import type {Assignment} from './assignment-schema';
import type {AssignmentOptions} from './assignment-context';
import {matchingTargets, inFolders} from './assignment-scope';
import {normalize} from '../graph/registry';
import {parseFrontmatter} from '../review/frontmatter';

export function assignmentTarget(assignment: Assignment, refs: Map<string, Concept>, targets: Concept[], graph: GraphSnapshot,
 source: string, options: AssignmentOptions): {path: string; kind: 'existing' | 'unresolved'; label?: string} | undefined {
 // Local models may follow Obsidian's link spelling despite the bare-title contract.
 // Accept one complete wikilink, never prose containing links or heading fragments.
 const raw = assignment.target.trim(), link = /^\[\[([^[\]\r\n|#]+)(?:\|[^[\]\r\n]+)?\]\]$/u.exec(raw);
 const targetText = link?.[1]?.trim() ?? raw;
 const referenced = refs.get(targetText);
 if (referenced) return referenced.exists && inFolders(referenced.id, options.folders) ? {path: referenced.id, kind: 'existing'} : undefined;
 const qualified = targetText.replace(/\.md$/u, '');
 const exactPath = qualified.includes('/') || targetText.endsWith('.md') ? targets.filter(n => n.id.replace(/\.md$/u, '') === qualified) : [];
 if (exactPath.length === 1) return {path: exactPath[0]!.id, kind: 'existing'};
 const title = targetText.replace(/\.md$/u, '');
 if (!title || /[[\]#|\n\r\0/\\:]/u.test(title) || /^N\d+$/u.test(title) || title === '.' || title === '..') return;
 const matches = matchingTargets(title, targets);
 if (matches.length === 1) return {path: matches[0]!.id, kind: 'existing', ...(options.perField ? {label: title} : {})};
 if (matches.length > 1) return options.perField ? {path: matches[0]!.id, kind: 'existing', label: title} : undefined;
 const elsewhere = matchingTargets(title, graph.nodes.filter(n => n.exists && n.id !== source && n.id.endsWith('.md')));
 if (options.perField && elsewhere.length) return {path: elsewhere[0]!.id, kind: 'existing', label: title};
 if (title.length > 100) return;
 if (!options.allowNew) return;
 // A relation has one target. Do not invent a comparison note for two endpoints.
 // Exact existing titles and aliases above remain valid, regardless of spelling.
 if (/(?:\s(?:vs\.?|versus|contra)\s|\s[↔⇔]\s|\s<[-=]>\s)/iu.test(title)) return;
 // Do not disguise an out-of-scope or ambiguous existing note as a new target.
 if (matchingTargets(title, graph.nodes.filter(n => n.exists)).length) return;
 const unresolved = matchingTargets(title, graph.nodes.filter(n => !n.exists && inFolders(n.id, options.folders)));
 if (unresolved.length === 1) return {path: unresolved[0]!.id, kind: 'unresolved'};
 if (unresolved.length > 1) return;
 const folder = (options.folders[0] ?? source.slice(0, Math.max(0, source.lastIndexOf('/')))).replace(/\/$/u, '');
 return {path: (folder ? folder + '/' : '') + title + '.md', kind: 'unresolved'};
}

export function alreadyAssigned(source: string, target: string, field: string, graph: GraphSnapshot, content: string, anyField = false): boolean {
 if (graph.edges.some(e => e.layer === 'breadcrumbs' && (anyField
  ? (e.source === source && e.target === target) || (e.source === target && e.target === source)
  : e.source === source && e.target === target && e.field === field))) return true;
 const data = parseFrontmatter(content).data;
 const values = (anyField ? graph.fields : [field]).flatMap(key => Array.isArray(data[key]) ? data[key] as unknown[] : [data[key]]);
 const node = graph.nodes.find(n => n.id === target), names = new Set([target.replace(/\.md$/u, ''), node?.title, ...node?.aliases ?? []].filter((v): v is string => !!v).map(normalize));
 return values.some(v => typeof v === 'string' && names.has(normalize(/^\[\[([^#|\]]+)(?:[^\]]*)\]\]$/u.exec(v)?.[1] ?? v)));
}
