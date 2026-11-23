import type {SettingDefinitionItem} from 'obsidian';
import {t} from '../i18n';
import type {TetradStore} from './patterns';
import {DEFAULT_SETTINGS,type TetraderSettings} from './settings-model';

export type DisplayField='centerDisplay'|'legendPosition';
export function displayField(key:string):DisplayField|undefined{
 if(key==='tetrad_centerDisplay')return 'centerDisplay';
 if(key==='tetrad_legendPosition')return 'legendPosition';
 return undefined;
}
export function displayOptions(field:DisplayField):Record<string,string>{
 return field==='centerDisplay'?{none:t('tetrad.none'),labels:t('tetrad.labels'),legend:t('tetrad.legend')}:{none:t('tetrad.none'),'bottom-left':t('tetrad.bottomLeft'),'bottom-right':t('tetrad.bottomRight')};
}
export function appearanceDefinitions(disabled:()=>boolean):SettingDefinitionItem[]{
 return (['centerDisplay','legendPosition'] as const).map(field=>({
  name:t(field==='centerDisplay'?'tetrad.center':'tetrad.legendPosition'),
  desc:t(field==='centerDisplay'?'tetrad.centerHelp':'tetrad.legendHelp'),
  control:{type:'dropdown',key:'tetrad_'+field,defaultValue:DEFAULT_SETTINGS[field],options:displayOptions(field),disabled},
 }));
}
/** Both settings surfaces write the same appearance record; no duplicate defaults. */
export async function setDisplayValue(store:TetradStore,field:DisplayField,value:unknown):Promise<void>{
 if(typeof value!=='string'||!Object.prototype.hasOwnProperty.call(displayOptions(field),value))throw new Error(t('tetrad.invalidDisplay'));
 const display:TetraderSettings=structuredClone(store.display);
 await store.setDisplay({...display,[field]:value});
}
