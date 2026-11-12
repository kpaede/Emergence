import {t as tr} from '../i18n';
import {mermaidExamples} from './examples';
import {flowStart,mindStart} from './starters';

export interface MermaidTemplate {id: string; name: string; source: string; path?:string; line?:number}
export interface TemplateFolderStore {enabled():boolean;refresh():Promise<void>;add(name:string,source:string):Promise<void>;open(item:MermaidTemplate):Promise<void>}
export interface MermaidLibraryData {hidden: string[]; custom: MermaidTemplate[]; favorites: string[]}
const defaultFavorites = ['starter-flowchart', 'starter-mindmap'];
const defaultPresets: MermaidTemplate[] = [
 {id: defaultFavorites[0]!, name: 'Flowchart', get source() {return flowStart();}},
 {id: defaultFavorites[1]!, name: 'Mindmap', get source() {return mindStart();}},
 ...mermaidExamples.map((item, index) => ({...item, id: 'pele-' + index})),
];
const presetIds = new Set(defaultPresets.map(item => item.id));
function readLibrary(value: unknown, validPresets = presetIds, favorites = defaultFavorites): MermaidLibraryData {
 const data = value && typeof value === 'object' ? value as Partial<MermaidLibraryData> : {};
 const external=(id:string)=>id.startsWith('folder:');
 const seen = new Set<string>(), hidden = Array.isArray(data.hidden) ? [...new Set(data.hidden.filter(id => typeof id === 'string' && (validPresets.has(id)||external(id))))] : [];
 const custom = Array.isArray(data.custom) ? data.custom.filter((item): item is MermaidTemplate => {
  if (!item || typeof item.id !== 'string' || !item.id.startsWith('custom-') || seen.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || typeof item.source !== 'string' || !item.source.trim()) return false;
  seen.add(item.id); return true;
 }).map(item => ({id: item.id, name: item.name.trim(), source: item.source})) : [];
 const valid = new Set([...validPresets, ...custom.map(item => item.id)]);
 return {hidden, custom, favorites: [...new Set((Array.isArray(data.favorites) ? data.favorites : favorites).filter(id => typeof id === 'string' && (valid.has(id)||external(id)) && !hidden.includes(id)))]};
}
/** The library is plugin data. Diagram drafts keep their existing lifecycle. */
export class MermaidLibrary {
 private data: MermaidLibraryData;
 private previous?: MermaidLibraryData;
 private listeners = new Set<() => void>();
 private pending: Promise<void> = Promise.resolve();
 private presetIds: Set<string>;
 private folderItems:MermaidTemplate[]=[];
 private folderStore?:TemplateFolderStore;
 folderStatus='';
 constructor(value: unknown, private persist: () => Promise<void>, private presets: MermaidTemplate[] = defaultPresets, favorites: string[] = presets === defaultPresets ? defaultFavorites : presets.slice(0, 1).map(item => item.id)) {this.presetIds = new Set(this.presets.map(item => item.id)); this.data = readLibrary(value, this.presetIds, favorites);}
 snapshot(): MermaidLibraryData {return {favorites: [...this.data.favorites], hidden: [...this.data.hidden], custom: this.data.custom.map(item => ({...item}))};}
 list(): MermaidTemplate[] {return [...this.data.custom,...this.folderItems, ...this.presets].filter(item=>!this.data.hidden.includes(item.id)).map(item => ({...item}));}
 connectFolder(store:TemplateFolderStore):void{this.folderStore=store;}
 setFolderTemplates(items:MermaidTemplate[],status=''):void{this.folderItems=items.map(item=>({...item}));this.folderStatus=status;this.notify();}
 refresh():Promise<void>{return this.folderStore?.refresh()??Promise.resolve();}
 openTemplate(item:MermaidTemplate):Promise<void>{return this.folderStore?.open(item)??Promise.resolve();}
 isFavorite(id: string): boolean {return this.data.favorites.includes(id);}
 favorite(id: string): Promise<void> {return this.update(() => {if (!this.list().some(item => item.id === id)) throw new Error(tr("mermaid.the_template_no_longer_exists")); return {...this.snapshot(), favorites: this.isFavorite(id) ? this.data.favorites.filter(value => value !== id) : [...this.data.favorites, id]};});}
 get canUndo(): boolean {return !!this.previous;}
 subscribe(listener: () => void): () => void {this.listeners.add(listener); return () => this.listeners.delete(listener);}
 private notify(): void {for (const listener of this.listeners) listener();}
 private update(change: () => MermaidLibraryData, undo = false): Promise<void> {
  const next = this.pending.catch(() => {}).then(async () => {
   const before = this.snapshot(), previous = this.previous; this.data = change();
   try {await this.persist(); this.previous = undo ? undefined : before; this.notify();}
   catch (error) {this.data = before; this.previous = previous; this.notify(); throw error;}
  });
  this.pending = next; return next;
 }
 add(name: string, source: string): Promise<void> {
  if (!name.trim() || !source.trim()) return Promise.reject(new Error(tr("mermaid.name_and_diagram_cannot_be_empty")));
  if(this.folderStore?.enabled()){const store=this.folderStore,next=this.pending.catch(()=>{}).then(()=>store.add(name.trim(),source));this.pending=next;return next;}
  const item = {id: 'custom-' + crypto.randomUUID(), name: name.trim(), source};
  return this.update(() => ({...this.snapshot(), custom: [...this.data.custom, item]}));
 }
 remove(id: string): Promise<void> {return this.update(() => ({favorites: this.data.favorites.filter(value => value !== id), hidden: this.presetIds.has(id)||id.startsWith('folder:') ? [...new Set([...this.data.hidden, id])] : [...this.data.hidden], custom: this.data.custom.filter(item => item.id !== id)}));}
 rename(id: string, name: string): Promise<void> {
  if (!name.trim()) return Promise.reject(new Error(tr("mermaid.enter_a_name")));
  return this.update(() => ({...this.snapshot(), custom: this.data.custom.map(item => item.id === id ? {...item, name: name.trim()} : item)}));
 }
 undo(): Promise<void> {return this.update(() => this.previous ? {favorites: [...this.previous.favorites], hidden: [...this.previous.hidden], custom: this.previous.custom.map(item => ({...item}))} : this.snapshot(), true);}
 flush(): Promise<void> {return this.pending;}
}
