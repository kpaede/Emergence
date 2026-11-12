import {t as tr} from '../i18n';
export const synopsisRelations = ['broader', 'narrower', 'similar', 'friction', 'examples', 'literature', 'links'] as const;
export type SynopsisRelation = typeof synopsisRelations[number];
export type SynopsisDepth = 1 | 2 | 3 | 'all';
export const synopsisLabels: Record<SynopsisRelation, string> = {get broader() {return tr("graph.broader");}, get narrower() {return tr("labels.narrower");}, get similar() {return tr("graph.similarity");}, get friction() {return tr("labels.friction");}, get examples() {return tr("labels.examples");}, get literature() {return tr("graph.literature");}, get links() {return tr("labels.free_references");}};
export const defaultSynopsisDepths = (): Record<SynopsisRelation, SynopsisDepth> => ({broader: 3, narrower: 1, similar: 1, friction: 1, examples: 1, literature: 1, links: 1});
export interface SynopsisNote {id: string; title: string; linktext: string; sourcePath: string; exists: boolean; path?: string}
export interface SynopsisEntry {note: SynopsisNote; step: number; repeated: boolean; children: SynopsisEntry[]}
export interface AncestorPath {notes: SynopsisNote[]; cycle: boolean}
