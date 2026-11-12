import {createInstance} from 'i18next';
import {en} from './locales/en';
import {de} from './locales/de';
export type InterfaceLanguage = 'auto' | 'de' | 'en';
export type Locale = 'de' | 'en';
type PluralKey<K> = K extends `${infer Base}_one` | `${infer Base}_other` ? Base : never;
export type TranslationKey = keyof typeof en | PluralKey<keyof typeof en>;
const instance = createInstance();
// All resources are bundled: no detector, backend, requests or translation services.
void instance.init({lng:'en',fallbackLng:'en',supportedLngs:['en','de'],load:'languageOnly',initAsync:false,keySeparator:false,nsSeparator:false,resources:{en:{translation:en},de:{translation:de}},interpolation:{escapeValue:false}});
export function resolveLocale(preference: InterfaceLanguage, obsidianLanguage = 'en'): Locale {
 if (preference !== 'auto') return preference;
 return /^de(?:-|_|$)/iu.test(obsidianLanguage) ? 'de' : 'en';
}
/** Resources are bundled, so language changes resolve synchronously without rebuilding editors. */
export function initializeLanguage(preference: InterfaceLanguage, obsidianLanguage = 'en'): void {void instance.changeLanguage(resolveLocale(preference,obsidianLanguage));}
export function locale(): Locale {return instance.resolvedLanguage === 'de' ? 'de' : 'en';}
export function t(key: TranslationKey, values?: Readonly<Record<string,string|number|boolean>>): string {return instance.t(key,values ?? {});}
export const number = (value: number, options?: Intl.NumberFormatOptions): string => new Intl.NumberFormat(locale(),options).format(value);
export const dateTime = (value: Date | number): string => new Intl.DateTimeFormat(locale(),{dateStyle:'short',timeStyle:'short'}).format(value);
