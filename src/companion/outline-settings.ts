import type {SettingDefinitionItem} from 'obsidian';
import type {Settings} from '../types';
import {locale,t} from '../i18n';
import {markerRefreshSeconds} from './outline-preferences';

export function outlineSettingDefinitions(settings:Settings,disabled:()=>boolean):SettingDefinitionItem[]{
 const seconds=new Intl.NumberFormat(locale(),{style:'unit',unit:'second',unitDisplay:'long'}),intervals=[...new Set([1,5,10,30,60,300,markerRefreshSeconds(settings)])].sort((a,b)=>a-b);
 return [
  {name:t('companion.outlineDefaults'),desc:t('companion.outlineDefaultsHelp')},
  {name:t('companion.defaultIgnoredHeadings'),desc:t('companion.defaultIgnoredHeadingsHelp'),control:{type:'textarea',key:'companion_defaultIgnoredHeadings',defaultValue:'',rows:3,placeholder:t('companion.ignoredHeadingsExample'),disabled}},
  {name:t('companion.defaultPositionMarkers'),desc:t('companion.defaultPositionMarkersHelp'),control:{type:'textarea',key:'companion_defaultMarkers',defaultValue:'',rows:3,placeholder:t('companion.positionMarkersExample'),disabled}},
  {name:t('companion.markerHeadingLevel'),desc:t('companion.markerHeadingLevelHelp'),control:{type:'dropdown',key:'companion_markerHeadingLevel',defaultValue:'6',options:Object.fromEntries(Array.from({length:6},(_,i)=>[String(i+1),'#'.repeat(i+1)])),disabled}},
  {name:t('companion.markerRefreshInterval'),desc:t('companion.markerRefreshIntervalHelp'),control:{type:'dropdown',key:'companion_markerRefreshSeconds',defaultValue:'5',options:Object.fromEntries(intervals.map(value=>[String(value),seconds.format(value)])),disabled}},
  {name:t('companion.defaultCharacterTarget'),desc:t('companion.defaultCharacterTargetHelp'),control:{type:'text',key:'companion_defaultCharacterTarget',defaultValue:'',placeholder:'300000',disabled}},
 ];
}
