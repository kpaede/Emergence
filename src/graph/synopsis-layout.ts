import type {Settings} from '../types';
import {synopsisLabels, synopsisRelations, type SynopsisRelation} from './synopsis-types';

export const synopsisPositions = ['top', 'left', 'right', 'bottom', 'list', 'hidden'] as const;
export type SynopsisPosition = typeof synopsisPositions[number];
export interface SynopsisPlacement {position: SynopsisPosition; order: number}
const defaultPositions: Record<SynopsisRelation, SynopsisPosition> = {broader:'top', similar:'left', friction:'right', narrower:'bottom', examples:'list', literature:'list', links:'list'};
export function synopsisLabel(settings: Settings, relation: SynopsisRelation): string {return settings.synopsis?.labels?.[relation]?.trim() || synopsisLabels[relation];}
export function synopsisPlacement(settings: Settings, relation: SynopsisRelation): SynopsisPlacement {
 return {position: defaultPositions[relation], order: synopsisRelations.indexOf(relation), ...settings.synopsis?.placements?.[relation]};
}
export function synopsisAt(settings: Settings, position: SynopsisPosition): SynopsisRelation[] {
 return synopsisRelations.filter(relation=>synopsisPlacement(settings,relation).position===position)
  .sort((a,b)=>synopsisPlacement(settings,a).order-synopsisPlacement(settings,b).order || synopsisRelations.indexOf(a)-synopsisRelations.indexOf(b));
}
/** Changing visual placement never changes fields, inverse relations or stored note properties. */
export function placeSynopsis(settings: Settings, relation: SynopsisRelation, position: SynopsisPosition, before?: SynopsisRelation): void {
 const others=synopsisAt(settings,position).filter(item=>item!==relation),index=before?others.indexOf(before):-1;
 others.splice(index<0?others.length:index,0,relation);
 const placements={...settings.synopsis?.placements};
 for(const [order,item]of others.entries())placements[item]={position,order};
 settings.synopsis={...settings.synopsis,placements};
}
export function reorderSynopsis(settings: Settings, relation: SynopsisRelation, offset: -1|1): void {
 const position=synopsisPlacement(settings,relation).position,items=synopsisAt(settings,position),index=items.indexOf(relation),target=items[index+offset];
 if(!target)return;
 const placements={...settings.synopsis?.placements};[items[index],items[index+offset]]=[target,relation];
 for(const [order,item]of items.entries())placements[item]={position,order};
 settings.synopsis={...settings.synopsis,placements};
}
