import {t as tr} from '../i18n';
import {loadMermaid, sanitizeHTMLToDom} from 'obsidian';
import type {Pele} from './types';

let loading: Promise<Pele> | undefined;
export function loadNativePele(): Promise<Pele> {
 loading ??= (async () => {
  await loadMermaid();
  const pele = (window as unknown as {pele?: Pele}).pele;
  if (!pele?.parse || !pele.mount) throw new Error(tr("mermaid.the_mermaid_editor_requires_obsidian_1_15_or_newer_with_integrated"));
  return pele;
 })().catch((error: unknown) => {loading = undefined; throw error;});
 return loading;
}
export const sanitizeDiagram = (svg: string): DocumentFragment => sanitizeHTMLToDom(svg);
