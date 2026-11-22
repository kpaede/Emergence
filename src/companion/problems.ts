import {t} from '../i18n';

export class MissingSectionFileError extends Error {
 constructor(readonly path:string){super(t('companion.sectionFileMissing')+(path?'\n'+path:''));this.name='MissingSectionFileError';}
}
