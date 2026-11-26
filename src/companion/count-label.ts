import {t} from '../i18n';
import type {CharacterCountOptions} from './character-count';

export function countPolicyLabel(options:CharacterCountOptions):string{return t(options.whitespace?'companion.withWhitespace':'companion.withoutWhitespace')+' · '+t(options.footnotes?'companion.withFootnotes':'companion.withoutFootnotes');}
