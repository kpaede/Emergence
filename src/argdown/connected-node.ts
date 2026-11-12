import {addNode, connectNodes, moveToSection} from './actions';
import {argdownMeaning, relationUnder, tryFormatArgdown} from './source-layout';
import {isGroup, nodeKey, span, type ArgdownModel} from './model';
import type {ArgdownEngine} from './engine';
import type {DragRelation, NodeKind} from './relations';
/** A new reason/objection points toward the selected claim or argument. */
export function addConnectedNode(engine: ArgdownEngine, model: ArgdownModel, origin: string, kind: DragRelation, nodeKind: NodeKind, section?: string): {source: string; key: string} {
 const added = addNode(model.source, model, nodeKind), initial = engine.parse(added.source);
 let current = section ? engine.parse(moveToSection(engine, initial, new Set([added.key]), section)) : initial;
 const fallback = connectNodes(engine, current, added.key, origin, kind);
 const owner = model.nodes.find(node => isGroup(node) && node.children?.some(child => nodeKey(child) === origin));
 if ((owner ? nodeKey(owner) : undefined) === section) {
  const rule = initial.rules.find(rule => nodeKind === 'argument' ? String(rule.name) === 'argument' && rule.argument?.title === added.key.slice(2) : String(rule.name) === 'statement' && rule.statement?.title === added.key.slice(2));
  const range = rule ? span(rule) : undefined, declaration = range ? initial.source.slice(range.from, range.to).trimEnd() : undefined;
  if (declaration) {
   const candidate = relationUnder(model, origin, declaration, kind === 'support' ? '+' : kind === 'attack' ? '-' : '_');
   if (candidate) try {current = engine.parse(candidate); if (argdownMeaning(current, added.key) === argdownMeaning(engine.parse(fallback), added.key)) return {key: added.key, source: tryFormatArgdown(engine, candidate)};} catch { /* Use the independently checked cross-section representation. */ }
  }
 }
 return {key: added.key, source: tryFormatArgdown(engine, fallback)};
}
