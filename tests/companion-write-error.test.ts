import {afterEach,describe,expect,it} from 'vitest';
import {initializeLanguage,t} from '../src/i18n';
import {rejectedChangeMessage} from '../src/companion/write-error';

afterEach(()=>initializeLanguage('de'));
describe('rejected companion changes',()=>{
 for(const language of ['de','en'] as const){
  it(`reports each native or reader conflict once in ${language}`,()=>{
   initializeLanguage(language);
   for(const key of ['companion.nativeConflict','companion.conflict'] as const){
    const message=rejectedChangeMessage(Error(t(key)));
    expect(message).toBe(t('companion.nativeConflict'));
    expect(message.split(t('companion.nativeConflict'))).toHaveLength(2);
   }
  });
  it(`retains the concrete save failure in ${language}`,()=>{
   initializeLanguage(language);expect(rejectedChangeMessage(Error('disk full'))).toBe(t('companion.saveFailed',{reason:'disk full'}));
  });
 }
});
