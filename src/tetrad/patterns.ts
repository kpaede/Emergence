import {t} from '../i18n';
import {LAWS, identifyLaw, type LawId} from './render/laws';
import {loadSettings, type TetraderSettings} from './settings-model';

export interface TetradPattern {
 id: string;
 name: string;
 headings: Record<LawId, string>;
 level: number;
}
export const DEFAULT_PATTERN: TetradPattern = {
 id: 'tetrad', name: 'McLuhan', level: 2,
 headings: {enhances: 'Enhances', reverses: 'Reverses into', retrieves: 'Retrieves', obsolesces: 'Obsolesces'},
};
export const normalizeHeading = (text: string): string => text.trim().toLowerCase().replace(/\s+/gu, ' ').replace(/\s*:\s*$/u, '');
export function patternLaw(pattern: TetradPattern, heading: string): LawId | undefined {
 return LAWS.find(law => normalizeHeading(pattern.headings[law.id]) === normalizeHeading(heading))?.id
  ?? (pattern.id === 'tetrad' ? identifyLaw(heading) : undefined);
}
export function validatePattern(pattern: TetradPattern): void {
 if (!/^[a-z][a-z0-9-]{0,49}$/u.test(pattern.id) || !pattern.name.trim() || pattern.name.length > 80
  || !Number.isInteger(pattern.level) || pattern.level < 1 || pattern.level > 6
  || LAWS.some(law => typeof pattern.headings[law.id] !== 'string' || !pattern.headings[law.id].trim()
   || pattern.headings[law.id].length > 100 || /[\r\n#*_[\]`<>\\]/u.test(pattern.headings[law.id]))
  || new Set(LAWS.map(law => normalizeHeading(pattern.headings[law.id]))).size !== 4) throw new Error(t('tetrad.invalidPattern'));
}
function readPattern(value: unknown): TetradPattern | undefined {
 try {
  if (!value || typeof value !== 'object') return;
  const p = value as TetradPattern;
  validatePattern(p);
  return {id:p.id, name:p.name.trim(), level:p.level, headings:Object.fromEntries(LAWS.map(law=>[law.id,p.headings[law.id].trim()])) as Record<LawId,string>};
 } catch {return undefined;}
}
export class TetradStore {
 private custom: TetradPattern[] = [];
 private labels:Record<string,TetraderSettings['lawText']>={};
 display: TetraderSettings;
 private listeners = new Set<() => void>();
 private queue: Promise<void> = Promise.resolve();
 constructor(data: unknown, private persist: () => Promise<void>) {
  const saved = data && typeof data === 'object' ? data as {patterns?:unknown[]; display?:unknown;labels?:Record<string,unknown>} : {};
  const ids = new Set(['tetrad']);
  for (const value of Array.isArray(saved.patterns) ? saved.patterns : []) {
   const p = readPattern(value); if (p && !ids.has(p.id)) {ids.add(p.id); this.custom.push(p);}
  }
  this.display = loadSettings(saved.display);
  for(const [id,value]of Object.entries(saved.labels??{}))if(this.custom.some(p=>p.id===id))this.labels[id]=loadSettings({lawText:value}).lawText;
 }
 list(): TetradPattern[] {return structuredClone([DEFAULT_PATTERN, ...this.custom]);}
 pattern(id: string): TetradPattern | undefined {return this.list().find(p=>p.id === id.toLowerCase());}
 snapshot(): unknown {return structuredClone({patterns:this.custom,display:this.display,...Object.keys(this.labels).length?{labels:this.labels}:{}});}
 subscribe(listener: () => void): () => void {this.listeners.add(listener); return ()=>this.listeners.delete(listener);}
 add(pattern: TetradPattern): Promise<void> {
  validatePattern(pattern);
  const copy = structuredClone(pattern);
  return this.change(async()=>{if(this.pattern(copy.id)) throw new Error(t('tetrad.patternExists')); this.custom.push(copy);});
 }
 setDisplay(display: TetraderSettings): Promise<void> {return this.change(async()=>{this.display=loadSettings(display);});}
 setAppearance(pattern:TetradPattern,display:TetraderSettings):Promise<void>{return this.change(async()=>{const next=loadSettings(display);this.display={...next,lawText:pattern.id==='tetrad'?next.lawText:this.display.lawText};if(pattern.id!=='tetrad')this.labels[pattern.id]=next.lawText;});}
 private change(apply:()=>Promise<void>):Promise<void>{
  const job=this.queue.then(async()=>{
   const previous=structuredClone({custom:this.custom,display:this.display,labels:this.labels});
   try{await apply();await this.persist();}catch(error){this.custom=previous.custom;this.display=previous.display;this.labels=previous.labels;throw error;}
   for(const listener of this.listeners)listener();
  });this.queue=job.catch(()=>{});return job;
 }
 settings(pattern: TetradPattern): TetraderSettings {
  return structuredClone({...this.display,lawText: pattern.id === 'tetrad' ? this.display.lawText : this.labels[pattern.id]??Object.fromEntries(LAWS.map(law=>[law.id,{label:pattern.headings[law.id],abbreviation:pattern.headings[law.id].slice(0,4)}])) as TetraderSettings['lawText']});
 }
}
