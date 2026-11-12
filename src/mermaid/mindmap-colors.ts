import {t as tr} from '../i18n';
import {parseDocument} from 'yaml';
/** Palette changes belong to portable Mermaid source, never to injected diagram CSS. */
export function mindmapColors(source: string, slots: string[], color?: string): string {
 const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(source);
 if (!frontmatter && !color) return source;
 const document = parseDocument(frontmatter?.[1] ?? '');
 if (document.errors.length) throw new Error(tr("mermaid.the_diagram_configuration_contains_invalid_yaml"));
 for (const slot of slots) {
  if (!/^cScale[1-8]$/u.test(slot)) throw new Error(tr("labels.unknown_palette_color"));
  const path = ['config', 'themeVariables', slot]; if (color) document.setIn(path, color); else document.deleteIn(path);
 }
 return '---\n' + document.toString() + '---\n' + source.slice(frontmatter?.[0].length ?? 0);
}
