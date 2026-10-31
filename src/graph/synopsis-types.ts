export const synopsisRelations = ['broader', 'narrower', 'similar', 'friction', 'examples', 'literature', 'links'] as const;
export type SynopsisRelation = typeof synopsisRelations[number];
export type SynopsisDepth = 1 | 2 | 3 | 'all';
export const synopsisLabels: Record<SynopsisRelation, string> = {broader: 'Überordnung', narrower: 'Unterordnung', similar: 'Ähnlichkeit', friction: 'Reibung', examples: 'Beispiele', literature: 'Literatur', links: 'Freie Verweise'};
export const defaultSynopsisDepths = (): Record<SynopsisRelation, SynopsisDepth> => ({broader: 3, narrower: 1, similar: 1, friction: 1, examples: 1, literature: 1, links: 1});
export interface SynopsisNote {id: string; title: string; linktext: string; sourcePath: string; exists: boolean; path?: string}
export interface SynopsisEntry {note: SynopsisNote; step: number; repeated: boolean; children: SynopsisEntry[]}
export interface AncestorPath {notes: SynopsisNote[]; cycle: boolean}
