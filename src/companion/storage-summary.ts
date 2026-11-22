import {t} from '../i18n';
import {targetFolder} from './storage';
import type {StorageOptions} from './model';
export function storageSummary(options:StorageOptions,source:string):{description:string;folder:string}{
 const folder=targetFolder(source,options);
 const description=options.location==='beside'?t('companion.defaultsBeside'):options.location==='subfolder'?t('companion.defaultsSubfolder',{name:options.subfolder??'Companions'}):t('companion.defaultsFolder',{folder:options.folder||t('companion.vaultRoot')});
 return {description,folder:folder||t('companion.vaultRoot')};
}
