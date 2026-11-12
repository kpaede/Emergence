import {t as tr} from '../i18n';
import {Menu, setIcon} from 'obsidian';
import {parents, validGroupTarget} from './groups';
import {isFlow, isMind, type DiagramModel} from './types';
import {mindParent} from './mindmap';

export type MermaidAction = 'rename' | 'link-note' | 'link-url' | 'link-remove' | 'shape' | 'shape-picker' | 'edge-picker' | 'direction-picker' | 'color' | 'duplicate' | 'delete' | 'group-new' | 'group-move' | 'group-dissolve' | 'edge-label' | 'edge-type' | 'mind-child' | 'mind-before' | 'mind-after' | 'mind-up' | 'mind-down';
export function renderMermaidToolbar(host: HTMLElement, model: DiagramModel, selection: Set<string>, action: (command: MermaidAction, value?: string) => void): void {
 host.empty(); if (!selection.size) {host.hidden = true; return;} host.hidden = false;
 const first = [...selection][0]!, edge = first.startsWith('e:'), group = first.startsWith('g:'), single = selection.size === 1;
 const button = (icon: string, label: string, click: (event: MouseEvent) => void, disabled = false): void => {
  const b = host.createEl('button', {cls: 'clickable-icon', attr: {type: 'button', 'aria-label': label, title: label}}); setIcon(b, icon); b.disabled = disabled; b.onclick = click;
 };
 if (first.startsWith('m:')) {button('trash-2', tr("mermaid.delete_branch_and_subbranches"), () => action('delete')); return;}
 button('pencil', edge ? tr("labels.label_connection") : tr("mermaid.edit_text"), () => action(edge ? 'edge-label' : 'rename'), !single);
 if (!edge && !group) button('shapes', tr("mermaid.change_shape"), () => action('shape-picker'), !isFlow(model) && !isMind(model));
 if (isFlow(model)) {
  if (!edge && !group) button('link', tr("mermaid.link_node"), event => {
   const menu = new Menu(); menu.addItem(item => item.setTitle(tr("mermaid.link_note")).setIcon('file').onClick(() => action('link-note')));
   menu.addItem(item => item.setTitle(tr("mermaid.link_web_address")).setIcon('external-link').onClick(() => action('link-url')));
   menu.addItem(item => item.setTitle(tr("mermaid.remove_link")).setIcon('unlink').onClick(() => action('link-remove'))); menu.showAtMouseEvent(event);
  }, !single);
  button('palette', tr("mermaid.change_color"), event => {const menu = new Menu(); for (const [value, label] of [...selection].some(key => key.startsWith('e:')) ? [['stroke', tr("mermaid.lines_borders")], ['color', tr("labels.label")]] : [['fill', tr("mermaid.fill")], ['stroke', tr("mermaid.border")], ['color', tr("argdown.text")]]) menu.addItem(item => item.setTitle(label!).onClick(() => action('color', value))); menu.showAtMouseEvent(event);});
  if (edge) button('move-right', tr("mermaid.change_connection_type"), () => action('edge-picker'), !single);
  if ([...selection].some(key => !key.startsWith('e:'))) {
   button('group', 'Subgraph', event => {
    const menu = new Menu(), ids = [...selection].filter(k => !k.startsWith('e:')).map(k => k.slice(2)), parent = parents(model);
    menu.addItem(item => item.setTitle(tr("mermaid.create_new_subgraph")).setIcon('plus').onClick(() => action('group-new'))); menu.addSeparator();
    menu.addItem(item => item.setTitle(tr("mermaid.top_level")).onClick(() => action('group-move', '')));
    for (const g of model.subgraphs) {
     const path = [g.title || g.id]; let p = parent.get(g.id); const seen = new Set<string>();
     while (p && !seen.has(p)) {seen.add(p); path.unshift(model.subgraphs.find(group => group.id === p)?.title || p); p = parent.get(p);}
     const valid = validGroupTarget(model, ids, g.id);
     menu.addItem(item => item.setTitle(path.join(' / ') + (valid ? '' : tr("mermaid.would_create_cyclic_nesting"))).setDisabled(!valid).onClick(() => action('group-move', g.id)));
    }
    if (single && group) {menu.addSeparator(); menu.addItem(item => item.setTitle(tr("mermaid.dissolve_subgraph_keep_contents")).setIcon('ungroup').onClick(() => action('group-dissolve')));}
    menu.showAtMouseEvent(event);
   });
  }
  if (single && group) button('arrow-down-up', tr("mermaid.subgraph_direction"), () => action('direction-picker'));
 }
 if (!edge && !group) button('copy', tr("mermaid.duplicate_node"), () => action('duplicate'), !single);
 if (isMind(model)) {
  button('palette', tr("mermaid.change_branch_color_shared_palette_color"), () => action('color', 'mindmap'), ![...selection].some(key => model.nodes.some(n => n.nodeId === key.slice(2) && !n.isRoot)));
  const parent = single ? mindParent(model, first.slice(2)) : undefined, index = parent?.children.findIndex(n => n.nodeId === first.slice(2)) ?? -1;
  button('git-fork', tr("mermaid.add_child_last"), () => action('mind-child'), !single);
  button('arrow-up-from-line', tr("mermaid.add_sibling_before"), () => action('mind-before'), !parent);
  button('arrow-down-from-line', tr("mermaid.add_sibling_after"), () => action('mind-after'), !parent);
  button('list-ordered', tr("labels.sibling_order"), event => {
   const menu = new Menu(); menu.addItem(item => item.setTitle(tr("mermaid.move_one_position_earlier")).setIcon('arrow-up').setDisabled(index <= 0).onClick(() => action('mind-up')));
   menu.addItem(item => item.setTitle(tr("mermaid.move_one_position_later")).setIcon('arrow-down').setDisabled(!parent || index >= parent.children.length - 1).onClick(() => action('mind-down'))); menu.showAtMouseEvent(event);
  }, !parent);
 }
 button('trash-2', group ? tr("mermaid.dissolve_subgraph_keep_contents") : tr("mermaid.delete_selection"), () => action(group && single ? 'group-dissolve' : 'delete'));
}
