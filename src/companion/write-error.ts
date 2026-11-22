import {t} from '../i18n';
import {errorMessage} from '../util';

/** One actionable message; never concatenate the same conflict explanation twice. */
export function rejectedChangeMessage(error:unknown):string{
 const reason=errorMessage(error),conflict=reason===t('companion.nativeConflict')||reason===t('companion.conflict');
 return t(conflict?'companion.nativeConflict':'companion.saveFailed',{reason});
}
