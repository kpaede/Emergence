import type {GraphSnapshot} from '../types';

const workFields = new Set(['Konzept', 'Komponist_in', 'Autor_in', 'Künstler_in', 'Regisseur_in', 'Librettist_in']);

export function frontmatterTags(value: unknown): string[] {
 return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : typeof value === 'string' ? [value] : [];
}
export function isWorkField(field: string, graph: GraphSnapshot): boolean {
 return workFields.has(field) || graph.rules[field]?.inverse === 'Werk'
  || !!graph.inferenceRules?.some(rule => rule.reversed && rule.field === 'Werk' && rule.chain.length === 1 && rule.chain[0] === field);
}
/** Scope comes exclusively from the source note's frontmatter tags, never its body or title. */
export function fieldAllowedForSource(field: string, tags: string[], graph: GraphSnapshot): boolean {
 if (!isWorkField(field, graph)) return true;
 return tags.some(tag => /^#?werk\/[^\s/]+(?:\/[^\s/]+)*$/iu.test(tag.trim()));
}
