import type {ArgdownModel} from './model';

export const graphDirections = ['TB','BT','LR','RL'] as const;
export type GraphDirection = typeof graphDirections[number];
/** Read the native exporter's resolved settings, including defaults and temporary view overrides. */
export function effectiveGraphDirection(model?:ArgdownModel):GraphDirection|undefined{
 const value=model?.request.dot?.graphVizSettings?.rankdir;
 return graphDirections.includes(value as GraphDirection)?value as GraphDirection:undefined;
}
