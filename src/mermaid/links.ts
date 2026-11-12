import {t as tr} from '../i18n';
import {appendSource, quoted, statements} from './source';
import {editFlowNode} from './flow-actions';
import {formatFlow} from './flow-format';
import {sameMermaidValue} from './groups';
import {isFlow, type FlowModel, type Pele} from './types';

export function noteLinkName(value: string): string {
 const wiki = /^\s*\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*$/u.exec(value);
 return (wiki?.[1] ?? value).trim();
}
/** Emit native Mermaid links after lossless normalization of inline classes. */
export function flowNodeLink(source: string, model: FlowModel, pele: Pele, id: string, kind: 'note' | 'url' | 'remove', value = ''): string {
 const node = model.nodes.get(id); if (!node || model.subgraphs.some(g => g.id === id)) throw new Error(tr("mermaid.select_a_single_node"));
 const normalized = formatFlow(source, model, pele);
 let candidate = statements(normalized).filter(s => {
  const words = s.text.trim().replace(/;$/u, '').split(/\s+/u);
  return !(words[0] === 'click' && words[1] === id || words[0] === 'class' && words[1] === id && ['internal-link', 'clickable'].includes(words[2] ?? ''));
 }).map(s => s.text).join('');
 if (kind === 'note') {
  const name = noteLinkName(value); if (!name || /[\n\r]/u.test(name)) throw new Error(tr("mermaid.enter_a_note_name"));
  candidate = appendSource(editFlowNode(candidate, id, name, undefined, 'text'), 'class ' + id + ' internal-link');
 } else if (kind === 'url') {
  if (!/^(?:https?:\/\/|mailto:|tel:)/iu.test(value.trim())) throw new Error(tr("mermaid.enter_an_http_https_email_or_phone_address"));
  candidate = appendSource(candidate, 'click ' + id + ' href ' + quoted(value.trim()));
 }
 const after = pele.parse(candidate);
 if (!isFlow(after) || after.nodes.size !== model.nodes.size || !sameMermaidValue(after.edges, model.edges) || !sameMermaidValue(after.subgraphs, model.subgraphs)) throw new Error(tr("mermaid.the_link_would_change_the_diagram_structure"));
 for (const [key, before] of model.nodes) {
  const next = after.nodes.get(key); if (!next) throw new Error(tr("mermaid.nodes_could_not_be_preserved"));
  const comparable = (value: object): unknown => Object.fromEntries(Object.entries(value).filter(([name]) => key !== id || !['link', 'linkTarget', 'classes', 'haveCallback', 'linkCallback', ...(kind === 'note' ? ['text', 'labelType'] : [])].includes(name)));
  if (!sameMermaidValue(comparable(before), comparable(next))) throw new Error(tr("mermaid.node_properties_would_change"));
  if (key === id && !sameMermaidValue(before.classes.filter(c => !['internal-link', 'clickable'].includes(c)), next.classes.filter(c => !['internal-link', 'clickable'].includes(c)))) throw new Error(tr("mermaid.node_classes_would_change"));
 }
 pele.render(candidate); return candidate;
}
