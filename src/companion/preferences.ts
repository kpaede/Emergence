import type {Settings} from '../types';
import type {StorageOptions} from './model';
import {validPath} from './repository';
import {companionViews,type CompanionViewMode} from './native-types';

export function validCompanionView(value:unknown):value is CompanionViewMode{return companionViews.some(mode=>mode===value);}
export function defaultCompanionView(settings:Settings):CompanionViewMode{return validCompanionView(settings.companion?.defaultView)?settings.companion.defaultView:'reader';}

export const defaultCompanionStorage=():StorageOptions=>({mode:'document',location:'subfolder',folder:'Companions',subfolder:'Companions'});
export function validSubfolder(value:unknown):value is string{return typeof value==='string'&&!!value.trim()&&!value.includes('/')&&validPath(value+'/note.md');}
export function validStorage(value:unknown):value is StorageOptions{
 if(!value||typeof value!=='object')return false;const item=value as StorageOptions;
 return ['document','sections'].includes(item.mode)&&['beside','folder','subfolder'].includes(item.location)&&typeof item.folder==='string'&&(!item.folder||validPath(item.folder+'/note.md'))&&(item.subfolder===undefined||validSubfolder(item.subfolder))&&(item.location!=='subfolder'||validSubfolder(item.subfolder));
}
/** Creation defaults are copied into the pair, so changing preferences does not relocate existing notes. */
export function companionStorageDefaults(settings:Settings):StorageOptions{return {...defaultCompanionStorage(),...settings.companion?.storage};}
