import {locale} from '../i18n';
import {FLOW_START, MIND_START} from './types';
/** Only newly opened starter diagrams use these variants; existing source is never translated. */
export const flowStart = (): string => locale() === 'de' ? FLOW_START : 'flowchart TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Result]\n  B -->|No| D[Alternative]\n';
export const mindStart = (): string => locale() === 'de' ? MIND_START : 'mindmap\n  root((Topic))\n    idea[Idea]\n      aspect[Aspect]\n    question[Question]\n';
