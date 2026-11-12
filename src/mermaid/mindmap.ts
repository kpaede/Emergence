import {t as tr} from '../i18n';
import {freshId, quoted} from './source';
import {labelMode, labelSource, labelText, type LabelMode} from './labels';
import type {MindModel, MindNode, SourceRange} from './types';
export interface MindLine extends SourceRange {node: MindNode; indent: string; end: number}

/** Associate complete node statements, including quoted multiline labels, with Pele's tree. */
export function mindLines(source: string, model: MindModel): MindLine[] {
 const result: MindLine[] = []; let offset = 0, started = false, index = 0;
 while (offset < source.length) {
  const newline = source.indexOf('\n', offset), lineEnd = newline < 0 ? source.length : newline, text = source.slice(offset, lineEnd), clean = text.trim();
  if (/^mindmap\s*$/iu.test(clean)) started = true;
  else if (started && clean && !clean.startsWith('%%') && !clean.startsWith('::')) {
   const node = model.nodes[index++]; if (!node) throw new Error(tr("mermaid.mindmap_nodes_could_not_be_uniquely_matched"));
   const indent = /^[ \t]*/u.exec(text)![0], start = offset + indent.length, shape = /^[^([\n){}]*?(\(\(|\)\)|\{\{|\[|\(|\))/u.exec(source.slice(start, lineEnd));
   let to = lineEnd;
   if (shape) {
    const open = shape[1]!, close = ({'[': ']', '(': ')', '((': '))', ')': '(', '))': '((', '{{': '}}'} as Record<string, string>)[open]!;
    let quote = false, found = false;
    for (let p = start + shape[0].length; p < source.length; p++) {
     if (source[p] === '"' && source[p - 1] !== '\\') quote = !quote;
     if (!quote && source.startsWith(close, p)) {to = p + close.length; found = true; break;}
    }
    if (!found) throw new Error(tr("mermaid.the_mindmap_label_is_incomplete"));
   }
   result.push({node, indent, from: offset, to, end: source.length});
   const end = source.indexOf('\n', to); offset = end < 0 ? source.length : end + 1; continue;
  }
  offset = newline < 0 ? source.length : newline + 1;
 }
 if (index !== model.nodes.length) throw new Error(tr("mermaid.mindmap_nodes_could_not_be_uniquely_matched"));
 for (const [i, line] of result.entries()) line.end = result.slice(i + 1).find(next => next.node.level <= line.node.level)?.from ?? source.length;
 return result;
}
const shapes: Record<number, [string, string]> = {1: ['(', ')'], 2: ['[', ']'], 3: ['((', '))'], 4: [')', '('], 5: ['))', '(('], 6: ['{{', '}}']};
export function mindLabel(node: MindNode, text = node.descr, type = node.type, mode: LabelMode = 'text'): string {
 if (type === 0) return mode === 'markdown' ? quoted(text).slice(1, -1) : labelSource(text, mode).slice(1, -1);
 const pair = shapes[type] ?? shapes[2]!; return node.nodeId + pair[0] + labelSource(text, mode) + pair[1];
}
export function editMindNode(source: string, model: MindModel, id: string, text?: string, type?: number, mode?: LabelMode): string {
 const line = mindLines(source, model).find(l => l.node.nodeId === id); if (!line) throw new Error(tr("mermaid.node_not_found"));
 const format = mode ?? mindLabelMode(source, line);
 return source.slice(0, line.from) + line.indent + mindLabel(line.node, text ?? labelText(line.node.descr), type, format) + source.slice(line.to);
}
export function mindLabelMode(source: string, line: MindLine): LabelMode {const raw = source.slice(line.from, line.to); return line.node.type === 0 && /[*_`~]/u.test(raw) ? 'markdown' : labelMode(raw);}
export function mindParent(model: MindModel, id: string): MindNode | undefined {return model.nodes.find(n => n.children.some(child => child.nodeId === id));}
function childIndent(lines: MindLine[], parent: MindLine, exclude?: string): string {
 const children = lines.filter(l => l.node.nodeId !== exclude && parent.node.children.some(n => n.nodeId === l.node.nodeId));
 return children.length ? children.reduce((shortest, child) => child.indent.length < shortest.length ? child.indent : shortest, children[0]!.indent) : parent.indent + '  ';
}
function insertAt(source: string, at: number, node: string): string {return source.slice(0, at).replace(/\n?$/u, '\n') + node + '\n' + source.slice(at);}
export function addMindChild(source: string, model: MindModel, parent: string): string {
 const lines = mindLines(source, model), line = lines.find(l => l.node.nodeId === parent); if (!line) throw new Error(tr("mermaid.parent_node_not_found"));
 return insertAt(source, line.end, childIndent(lines, line) + freshId(model.nodes.map(n => n.nodeId)) + '[' + tr('messages.newNode') + ']');
}
export function addMindSibling(source: string, model: MindModel, id: string, side: 'before' | 'after'): string {
 const line = mindLines(source, model).find(l => l.node.nodeId === id); if (!line || line.node.isRoot) throw new Error(tr("mermaid.the_root_cannot_have_siblings"));
 return insertAt(source, side === 'before' ? line.from : line.end, line.indent + freshId(model.nodes.map(n => n.nodeId)) + '[' + tr('messages.newNode') + ']');
}
export function reorderMindBranch(source: string, model: MindModel, id: string, direction: -1 | 1): string {
 const lines = mindLines(source, model), branch = lines.find(l => l.node.nodeId === id), parent = mindParent(model, id), index = parent?.children.findIndex(n => n.nodeId === id) ?? -1;
 const sibling = parent?.children[index + direction], other = lines.find(l => l.node.nodeId === sibling?.nodeId);
 if (!branch || !other) throw new Error(tr("mermaid.the_branch_is_already_first_or_last"));
 const content = reindent(source.slice(branch.from, branch.end), other.indent.length - branch.indent.length), at = direction < 0 ? other.from : other.end;
 const without = source.slice(0, branch.from) + source.slice(branch.end), insert = at > branch.from ? at - (branch.end - branch.from) : at;
 return insertAt(without, insert, content.replace(/\n$/u, ''));
}
function reindent(source: string, delta: number): string {return source.split('\n').map(line => !line.trim() ? line : delta >= 0 ? ' '.repeat(delta) + line : line.slice(-delta)).join('\n');}
export function moveMindBranch(source: string, model: MindModel, id: string, target: string): string {
 const lines = mindLines(source, model), branch = lines.find(l => l.node.nodeId === id), parent = lines.find(l => l.node.nodeId === target);
 if (!branch || !parent || branch.node.isRoot || parent.from >= branch.from && parent.from < branch.end) throw new Error(tr("mermaid.a_branch_cannot_be_moved_under_itself_or_any_of_its"));
 const content = source.slice(branch.from, branch.end), moved = reindent(content, childIndent(lines, parent, id).length - branch.indent.length);
 const without = source.slice(0, branch.from) + source.slice(branch.end), insert = parent.end > branch.from ? parent.end - content.length : parent.end;
 return insertAt(without, insert, moved.replace(/\n$/u, ''));
}
export function deleteMindBranch(source: string, model: MindModel, id: string): string {
 const line = mindLines(source, model).find(l => l.node.nodeId === id);
 if (!line || line.node.isRoot) throw new Error(tr("mermaid.the_mindmap_root_is_retained"));
 return source.slice(0, line.from) + source.slice(line.end);
}
