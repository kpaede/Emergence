// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {App} from 'obsidian';
import {installDomHelpers} from './helpers/dom';
import {DEFAULT_PATTERN} from '../src/tetrad/patterns';
import {editSection,parseSource,starter} from '../src/tetrad/source';
import {tetradEntries} from '../src/tetrad/entries';
import {TetradGraphEditor} from '../src/tetrad/graph-editor';

const state=vi.hoisted(()=>({throwMount:false,editors:[] as {value:string;commit():Promise<void>;cancel():void}[]}));
vi.mock('obsidian',async original=>({...await original<Record<string,unknown>>(),Component:(await import('./helpers/reader-host')).TestComponent}));
vi.mock('../src/tetrad/inline-editor',async()=>{
 const {TestComponent}=await import('./helpers/reader-host');
 return {TetradInlineEditor:class extends TestComponent{
  pending?:Promise<void>;
  constructor(_app:unknown,readonly host:HTMLElement,public value:string,_file:unknown,private save:(value:string)=>Promise<void>,readonly cancel:()=>void){super();if(state.throwMount)throw Error('Native editor unavailable');state.editors.push(this);this.register(()=>host.remove());}
  focus(){}holdAccepted(){this.host.inert=true;}setValue(value:string){this.value=value;}
  commit():Promise<void>{const task=Promise.resolve().then(()=>this.save(this.value));this.pending=task;return task.finally(()=>{this.pending=undefined;});}
 }};
});

beforeEach(()=>{installDomHelpers();document.body.empty();state.throwMount=false;state.editors=[];});
afterEach(()=>vi.restoreAllMocks());
function fixture(persist=false,content='Core\n\n- One\n- Two'){
 const host=document.body.createDiv(),wing=host.createEl('section',{attr:{'data-em-law':'enhances'}}),core=wing.createDiv({attr:{'data-em-core':'true'}}),statement=core.createDiv({cls:'tetrader-statement'}),glosses=wing.createDiv({cls:'tetrader-glosses'});statement.createEl('p',{text:'Core'});for(const [index,text]of [[2,'Two'],[1,'One']] as const)glosses.createDiv({cls:'tetrader-gloss',attr:{'data-em-entry-index':String(index)}}).createEl('p',{text});
 const source=editSection(starter(DEFAULT_PATTERN),DEFAULT_PATTERN,'enhances',content);let current=source;
 const change=vi.fn(async(next:string)=>{if(persist)current=next;}),selected=vi.fn(),ended=vi.fn(),graph=new TetradGraphEditor({scope:{},workspace:{}} as unknown as App,host,source,DEFAULT_PATTERN,undefined,()=>current,change,selected,undefined,undefined,ended);return {host,source,graph,change,selected,ended,get current(){return current;},accept(next:string){current=next;}};
}
const body=(source:string)=>parseSource(source,DEFAULT_PATTERN).sections.get('enhances')!.body;
function transfer(){const data=new Map<string,string>();return {types:[] as string[],setData(type:string,value:string){this.types.push(type);data.set(type,value);},getData(type:string){return data.get(type)??'';},effectAllowed:'',dropEffect:''};}
function dragEvent(target:Element,type:string,data:ReturnType<typeof transfer>,y=0){const event=new MouseEvent(type,{bubbles:true,cancelable:true,clientY:y});Object.defineProperty(event,'dataTransfer',{value:data});target.dispatchEvent(event);return event;}

describe('tetrad graphical entry transactions',()=>{
 it('releases a pressed grip when the window loses focus before a drag starts',()=>{
  const f=fixture(),grip=f.host.querySelector('[draggable]')!;grip.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0}));expect(f.graph.interacting).toBe(true);window.dispatchEvent(new Event('blur'));expect(f.graph.interacting).toBe(false);expect(f.ended).toHaveBeenCalledOnce();document.dispatchEvent(new MouseEvent('pointerup'));expect(f.ended).toHaveBeenCalledOnce();f.graph.unload();
 });
 it('uses one marker for row halves and their shared insertion gap',()=>{
  const f=fixture(),data=transfer(),row=f.host.querySelector<HTMLElement>('[data-em-entry-index="2"].tetrader-gloss')!,next=f.host.querySelector<HTMLElement>('[data-em-entry-index="1"].tetrader-gloss')!;
  vi.spyOn(row,'getBoundingClientRect').mockReturnValue({top:100,bottom:120,height:20} as DOMRect);vi.spyOn(next,'getBoundingClientRect').mockReturnValue({top:140,bottom:160,height:20} as DOMRect);
  dragEvent(row.querySelector('[draggable]')!,'dragstart',data);
  dragEvent(row,'dragover',data,119);const marked=f.host.querySelector('.em-tetrad-drop-indicator:not([hidden])');expect((marked as HTMLElement).dataset.emSlot).toBe('2');
  dragEvent(next,'dragover',data,141);expect(f.host.querySelector('.em-tetrad-drop-indicator:not([hidden])')).toBe(marked);expect(f.host.querySelectorAll('.em-tetrad-drop-indicator:not([hidden])')).toHaveLength(1);
  dragEvent(f.host.querySelector('.em-tetrad-gap[data-em-slot="2"] button')!,'dragover',data,130);expect(f.host.querySelectorAll('.em-tetrad-drop-indicator:not([hidden])')).toHaveLength(1);
  dragEvent(next,'dragover',data,159);expect((f.host.querySelector('.em-tetrad-drop-indicator:not([hidden])') as HTMLElement).dataset.emSlot).toBe('1');expect(f.host.querySelectorAll('.em-tetrad-drop-indicator:not([hidden])')).toHaveLength(1);expect(f.host.querySelector('[data-em-drop]')).toBeNull();
  dragEvent(row,'dragend',data);expect(f.host.querySelector('.em-tetrad-drop-indicator:not([hidden])')).toBeNull();expect(f.graph.interacting).toBe(false);f.graph.unload();
 });
 it('starts without a preparatory click and saves an active field before moving',async()=>{
  const f=fixture(true);await f.graph.editRow('enhances',1);state.editors.at(-1)!.value='Updated one';
  const data=transfer(),row=f.host.querySelector('.tetrader-gloss[data-em-entry-index="2"]')!,gap=f.host.querySelector('.em-tetrad-gap[data-em-slot="1"]')!;
  expect(dragEvent(row.querySelector('[draggable]')!,'dragstart',data).defaultPrevented).toBe(false);dragEvent(gap,'drop',data);
  await vi.waitFor(()=>expect(f.graph.interacting).toBe(false));expect(f.change).toHaveBeenCalledTimes(2);expect(tetradEntries(body(f.current)).glosses.map(e=>e.content)).toEqual(['Two','Updated one']);expect(f.ended).toHaveBeenCalled();f.graph.unload();
 });
 it('moves all paragraphs of the active edited entry without losing text',async()=>{
  const f=fixture(true,'Core\n\nOne\n\nTwo');await f.graph.editRow('enhances',1);state.editors.at(-1)!.value='First part\n\nSecond part';const data=transfer();dragEvent(f.host.querySelector('.tetrader-gloss[data-em-entry-index="1"] [draggable]')!,'dragstart',data);dragEvent(f.host.querySelector('.em-tetrad-gap[data-em-slot="3"]')!,'drop',data);
  await vi.waitFor(()=>expect(f.graph.interacting).toBe(false));expect(tetradEntries(body(f.current)).glosses.map(e=>e.content)).toEqual(['Two','First part','Second part']);expect(f.host.querySelector('.em-tetrad-graph-error')).toBeNull();f.graph.unload();
 });
 it('can drag a new entry directly from its editor and removes temporary grips when canceled',async()=>{
  const f=fixture(true);f.host.querySelector<HTMLButtonElement>('.em-tetrad-gap[data-em-slot="2"] button')!.click();await vi.waitFor(()=>expect(f.graph.editing).toBe(true));state.editors.at(-1)!.value='Added';const row=f.host.querySelector('.is-new')!,data=transfer();expect(row.querySelectorAll('[draggable]')).toHaveLength(2);
  dragEvent(row.querySelector('[draggable]')!,'dragstart',data);dragEvent(f.host.querySelector('.em-tetrad-gap[data-em-slot="1"]')!,'drop',data);await vi.waitFor(()=>expect(f.graph.interacting).toBe(false));expect(tetradEntries(body(f.current)).glosses.map(e=>e.content)).toEqual(['Added','One','Two']);expect(f.host.querySelector('.is-new')).toBeNull();f.graph.unload();
 });
 it('drops at the indicated slot even when the final event targets a neighboring element',async()=>{
  const f=fixture(true),data=transfer();dragEvent(f.host.querySelector('.tetrader-gloss[data-em-entry-index="2"] [draggable]')!,'dragstart',data);dragEvent(f.host.querySelector('.em-tetrad-gap[data-em-slot="1"]')!,'dragover',data);
  dragEvent(f.host.querySelector('.em-tetrad-gap[data-em-slot="3"]')!,'drop',data);
  await vi.waitFor(()=>expect(f.graph.interacting).toBe(false));expect(tetradEntries(body(f.current)).glosses.map(e=>e.content)).toEqual(['Two','One']);f.graph.unload();expect(f.host.querySelector('.em-tetrad-drop-indicator')).toBeNull();
 });
 it('keeps the interaction alive until the pending edit is saved and the drop completes',async()=>{
  const f=fixture(true);let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  f.change.mockImplementationOnce(async next=>{await gate;f.accept(next);});await f.graph.editRow('enhances',1);state.editors.at(-1)!.value='Updated one';
  const data=transfer(),row=f.host.querySelector('.tetrader-gloss[data-em-entry-index="2"]')!;dragEvent(row.querySelector('[draggable]')!,'dragstart',data);dragEvent(f.host.querySelector('.em-tetrad-gap[data-em-slot="1"]')!,'drop',data);dragEvent(row,'dragend',data);
  await vi.waitFor(()=>expect(f.change).toHaveBeenCalledOnce());expect(f.graph.interacting).toBe(true);expect(f.ended).not.toHaveBeenCalled();release();await vi.waitFor(()=>expect(f.graph.interacting).toBe(false));expect(tetradEntries(body(f.current)).glosses.map(e=>e.content)).toEqual(['Two','Updated one']);f.graph.unload();
 });
 it('cancels the drop and preserves the saved file when accepting the field fails',async()=>{
  const f=fixture(true);f.change.mockRejectedValue(Error('Disk full'));await f.graph.editRow('enhances',1);state.editors.at(-1)!.value='Changed';const data=transfer();dragEvent(f.host.querySelector('.tetrader-gloss[data-em-entry-index="2"] [draggable]')!,'dragstart',data);dragEvent(f.host.querySelector('.em-tetrad-gap[data-em-slot="1"]')!,'drop',data);
  await vi.waitFor(()=>expect(f.graph.interacting).toBe(false));expect(f.change).toHaveBeenCalledOnce();expect(f.current).toBe(f.source);expect(f.host.querySelectorAll('.em-tetrad-graph-error')).toHaveLength(1);expect(f.host.querySelector('.em-tetrad-drop-indicator:not([hidden])')).toBeNull();f.graph.unload();
 });
 it('finishes a successful unchanged inline edit, including when a context switch flushes it',async()=>{const f=fixture();await f.graph.editCore('enhances');expect(f.graph.editing).toBe(true);await f.graph.flush();expect(f.graph.editing).toBe(false);expect(f.change).not.toHaveBeenCalled();expect(f.host.querySelector('.tetrader-statement')?.textContent).toBe('Core');f.graph.unload();});
 it('restores the original core when the native editor cannot mount',async()=>{const f=fixture();state.throwMount=true;await expect(f.graph.editCore('enhances')).rejects.toThrow('Native editor unavailable');expect(f.host.querySelector('.tetrader-statement')?.textContent).toBe('Core');expect(f.host.querySelector('.is-editing')).toBeNull();expect(f.graph.editing).toBe(false);f.graph.unload();});
 it('restores the original glossary row after a failed editor mount',async()=>{const f=fixture(),row=f.host.querySelector('[data-em-entry-index="1"]')!,paragraph=row.querySelector('p');state.throwMount=true;await expect(f.graph.editRow('enhances',1)).rejects.toThrow();expect(row.querySelector('p')).toBe(paragraph);expect(row.classList.contains('is-editing')).toBe(false);f.graph.unload();});
 it('closes a rejected edit, restores the accepted content and reports the failure once',async()=>{const f=fixture();f.change.mockRejectedValue(Error('Disk full'));await f.graph.editRow('enhances',1);state.editors[0]!.value='Changed';await expect(f.graph.flush()).rejects.toThrow('Disk full');expect(f.graph.editing).toBe(false);expect(body(f.source)).toContain('- One');expect(f.host.querySelectorAll('.em-tetrad-graph-error')).toHaveLength(1);state.editors[0]!.cancel();expect(f.graph.editing).toBe(false);f.graph.unload();});
 it('places insertion slots in reversed visual order in upper wings',()=>{const f=fixture();expect([...f.host.querySelectorAll<HTMLElement>('.em-tetrad-gap')].map(g=>g.dataset.emSlot)).toEqual(['3','2','1']);f.graph.unload();});
 it('moves one whole list entry while preserving the core and remaining entry',async()=>{const f=fixture();await f.graph.move('enhances',2,'enhances',1);const changed=f.change.mock.calls[0]![0],model=tetradEntries(body(changed));expect(model.core?.content).toBe('Core');expect(model.glosses.map(e=>e.content)).toEqual(['Two','One']);f.graph.unload();});
 it('selects rows and removes only that selection using the real source writer',async()=>{const f=fixture(),row=f.host.querySelector<HTMLElement>('[data-em-entry-index="1"]')!;row.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));expect(f.graph.count).toBe(1);await f.graph.removeSelected();const model=tetradEntries(body(f.change.mock.calls[0]![0]));expect(model.core?.content).toBe('Core');expect(model.glosses.map(e=>e.content)).toEqual(['Two']);f.graph.unload();});
 it('edits existing text with one click and has no per-row edit or delete buttons',async()=>{const f=fixture(),row=f.host.querySelector<HTMLElement>('[data-em-entry-index="1"]')!;expect(row.querySelectorAll('button')).toHaveLength(2);expect(row.querySelectorAll('button[draggable=true]')).toHaveLength(2);row.click();await vi.waitFor(()=>expect(f.graph.editing).toBe(true));expect(state.editors[0]!.value).toBe('One');state.editors[0]!.cancel();f.graph.unload();});
 it('opens the existing outermost upper insertion slot instead of creating empty intermediate rows',async()=>{const f=fixture(),outer=f.host.querySelector<HTMLElement>('.em-tetrad-gap.is-outer')!;expect(outer.dataset.emSlot).toBe('3');expect(f.host.querySelectorAll('.is-outer')).toHaveLength(1);outer.querySelector<HTMLButtonElement>('button')!.click();await vi.waitFor(()=>expect(f.graph.editing).toBe(true));expect(f.host.querySelectorAll('.is-new')).toHaveLength(1);state.editors[0]!.value='Three';await f.graph.flush();expect(tetradEntries(body(f.change.mock.calls[0]![0])).glosses.map(e=>e.content)).toEqual(['One','Two','Three']);f.graph.unload();});
 it('discards an untouched new line without an error or write',async()=>{const f=fixture();f.host.querySelector<HTMLButtonElement>('.em-tetrad-gap.is-outer button')!.click();await vi.waitFor(()=>expect(f.graph.editing).toBe(true));await f.graph.flush();expect(f.graph.editing).toBe(false);expect(f.host.querySelector('.is-new')).toBeNull();expect(f.change).not.toHaveBeenCalled();f.graph.unload();});
 it('treats clearing an existing gloss as deletion and allows editing another field afterwards',async()=>{const f=fixture();await f.graph.editRow('enhances',1);state.editors.at(-1)!.value='';await f.graph.flush();expect(f.graph.editing).toBe(false);expect(tetradEntries(body(f.change.mock.calls[0]![0])).glosses.map(entry=>entry.content)).toEqual(['Two']);expect(f.host.querySelector('.em-tetrad-graph-error')).toBeNull();await f.graph.editRow('enhances',2);expect(state.editors.at(-1)!.value).toBe('Two');f.graph.unload();});
 it('replaces a cleared core with its law text and keeps all glosses',async()=>{const f=fixture();await f.graph.editCore('enhances');state.editors.at(-1)!.value='';await f.graph.flush();const model=tetradEntries(body(f.change.mock.calls[0]![0]));expect(model.core?.content).toBe('Enhances');expect(model.glosses.map(entry=>entry.content)).toEqual(['One','Two']);expect(f.graph.editing).toBe(false);f.graph.unload();});
 it('can move directly to another text field after accepting the current edit',async()=>{const f=fixture();await f.graph.editCore('enhances');await f.graph.editRow('enhances',2);expect(state.editors.at(-1)!.value).toBe('Two');expect(f.graph.editing).toBe(true);f.graph.unload();});
 it('does not leave a phantom insertion while another mutation is saving',async()=>{const f=fixture();let release!:()=>void;f.change.mockImplementation(()=>new Promise<void>(resolve=>{release=resolve;}));const moving=f.graph.move('enhances',2,'enhances',1);await vi.waitFor(()=>expect(f.change).toHaveBeenCalled());f.host.querySelector<HTMLButtonElement>('.em-tetrad-gap button')!.click();await Promise.resolve();expect(f.host.querySelector('.is-new')).toBeNull();release();await moving;f.graph.unload();});
 it('removes a new placeholder when mounting its editor fails',async()=>{const f=fixture();state.throwMount=true;f.host.querySelector<HTMLButtonElement>('.em-tetrad-gap button')!.click();await vi.waitFor(()=>expect(f.host.querySelector('.em-tetrad-graph-error')?.textContent).toContain('Native editor unavailable'));expect(f.host.querySelector('.is-new')).toBeNull();f.graph.unload();});
});
