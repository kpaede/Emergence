import type {Settings} from './types';
export const features=['graph','fieldIdeas','mermaid','argdown','search'] as const;
export type Feature=typeof features[number];
export function featureEnabled(settings:Settings,feature:Feature):boolean{return settings.features?.[feature]!==false;}
export function anyFeatureEnabled(settings:Settings):boolean{return features.some(feature=>featureEnabled(settings,feature));}
export function knowledgeFeaturesEnabled(settings:Settings):boolean{return (['graph','fieldIdeas','search'] as const).some(feature=>featureEnabled(settings,feature));}
export function featureForTab(tab:'graph'|'analysis'|'mermaid'|'argdown'|'search'):Feature{return tab==='analysis'?'fieldIdeas':tab;}
