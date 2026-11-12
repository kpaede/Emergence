import {t as tr} from '../i18n';
import type {ArgdownModel, IMapNode} from './model';
export type NodeKind = 'statement' | 'argument';
export type RelationKind = 'support' | 'attack' | 'undercut' | 'contradictory';
export interface RelationOption {kind: RelationKind; label: string; verb: string; icon: string}
export const kindOf = (node: IMapNode): NodeKind => String(node.type) === 'argument-map-node' ? 'argument' : 'statement';
/** Argdown distinguishes node types from dialectical and logical relationships. */
export function relationOptions(from: NodeKind, to: NodeKind, strict = false): RelationOption[] {
 const logical = strict && from === 'statement' && to === 'statement';
 const options: RelationOption[] = [
  {kind: 'support', label: logical ? tr("labels.entailment") : tr("argdown.support"), verb: logical ? tr("messages.verbEntails") : tr("argdown.supports_2"), icon: 'plus'},
  {kind: 'attack', label: logical ? tr("labels.contrariness") : tr("argdown.attack"), verb: logical ? tr("argdown.is_contrary_to") : tr("messages.verbAttack"), icon: 'minus'},
 ];
 if (to === 'argument') options.push({kind: 'undercut', label: tr("argdown.undercut"), verb: tr("messages.verbUndercut"), icon: 'arrow-right'});
 if (from === 'statement' && to === 'statement') options.push({kind: 'contradictory', label: tr("argdown.contradiction"), verb: tr("messages.verbContradicts"), icon: 'arrow-left-right'});
 return options;
}
export const strictMode = (model: ArgdownModel): boolean => String(model.request.model?.mode) === 'strict';
export function assertRelation(from: NodeKind, to: NodeKind, kind: RelationKind): void {
 if (!relationOptions(from, to).some(option => option.kind === kind)) throw new Error(kind === 'undercut' ? tr("argdown.an_undercut_targets_an_argument") : tr("argdown.contradiction_connects_two_statements_use_attack_for_counterarguments"));
}
export type DragRelation = Exclude<RelationKind, 'contradictory'>;
export const dragRelations: {kind: DragRelation; label: string; icon?: string; symbol?: string}[] = [
 {kind: 'support', get label() {return tr("argdown.support_2");}, icon: 'plus'},
 {kind: 'attack', get label() {return tr("argdown.attack_2");}, icon: 'minus'},
 {kind: 'undercut', get label() {return tr("argdown.undercut_2");}, symbol: '_>'},
];
export interface ConnectionChoice {nodeKind: NodeKind}
