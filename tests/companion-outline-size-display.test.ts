import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import type {CompanionService} from '../src/companion/service';
import type {CompanionNavigation} from '../src/companion/navigation';
import type {OutlineSizeMode} from '../src/companion/outline-size';
import {OutlineSizeDisplay} from '../src/companion/outline-size-display';
vi.mock('obsidian',async importOriginal=>({...await importOriginal<Record<string,unknown>>(),Component:(await import('./helpers/reader-host')).TestComponent}));
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('window',{setTimeout,clearTimeout});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
function fixture(){
 let mode:OutlineSizeMode='off',target:number|undefined,whitespace=true,listener:((source:string)=>void)|undefined;const unsubscribe=vi.fn(()=>{listener=undefined;}),read=vi.fn(()=>new Map([['a',{characters:10,percentage:20}]])),sourceCharacters=vi.fn<()=>number|undefined>(()=>20),showTotal=vi.fn(),subscribe=vi.fn((callback:(source:string)=>void)=>{listener=callback;return unsubscribe;}),navigation={setSizes:vi.fn()},service={characterTarget:()=>target,outlineSizeMode:()=>mode,outlineCountOptions:()=>({whitespace,footnotes:true}),sectionSizes:read,sourceCharacters,subscribeSourceSizes:subscribe,pair:(path:string)=>({source:path==='Other.md'?'Other source.md':'Main.md'})},display=new OutlineSizeDisplay(service as unknown as CompanionService,navigation as unknown as CompanionNavigation,showTotal);
 return {setTarget:(value:number|undefined)=>{target=value;},setWhitespace:(value:boolean)=>{whitespace=value;},display,navigation,read,sourceCharacters,showTotal,subscribe,unsubscribe,setMode:(value:OutlineSizeMode)=>{mode=value;},changed:(source='Main.md')=>listener?.(source)};
}
describe('optional outline size display lifecycle',()=>{
 it('does not subscribe, count or start work while disabled or hidden',async()=>{
  const f=fixture();f.display.render('Companion.md',true);f.changed();await vi.advanceTimersByTimeAsync(1000);expect(f.read).not.toHaveBeenCalled();expect(f.subscribe).not.toHaveBeenCalled();f.setMode('subtree');f.display.render('Companion.md',false);expect(f.read).not.toHaveBeenCalled();expect(f.subscribe).not.toHaveBeenCalled();f.display.unload();
 });
 it('coalesces typing without reloading the outline, and bounds the delay during sustained typing',async()=>{
  const f=fixture();f.setMode('section');f.display.render('Companion.md',true);expect(f.read).toHaveBeenCalledOnce();for(let i=0;i<100;i++)f.display.render('Companion.md',true);expect(f.read).toHaveBeenCalledOnce();for(let i=0;i<20;i++)f.changed();await vi.advanceTimersByTimeAsync(159);expect(f.read).toHaveBeenCalledOnce();await vi.advanceTimersByTimeAsync(1);expect(f.read).toHaveBeenCalledTimes(2);
  for(let i=0;i<8;i++){f.changed();await vi.advanceTimersByTimeAsync(100);}expect(f.read.mock.calls.length).toBeGreaterThanOrEqual(3);expect(f.subscribe).toHaveBeenCalledOnce();f.display.unload();
 });
 it('cancels pending work and unsubscribes on disable, hide and unload',async()=>{
  const f=fixture();f.setMode('subtree');f.display.render('Companion.md',true);f.changed();f.setMode('off');f.display.render('Companion.md',true);await vi.advanceTimersByTimeAsync(1000);expect(f.read).toHaveBeenCalledOnce();expect(f.unsubscribe).toHaveBeenCalledOnce();expect(f.navigation.setSizes).toHaveBeenLastCalledWith(undefined,'off');f.setMode('subtree');f.display.render('Companion.md',true);f.changed();f.display.unload();await vi.advanceTimersByTimeAsync(1000);expect(f.read).toHaveBeenCalledTimes(2);expect(f.unsubscribe).toHaveBeenCalledTimes(2);
 });
 it('ignores unrelated source events and does not apply an old pending update after a source switch',async()=>{
  const f=fixture();f.setMode('section');f.display.render('Companion.md',true);f.changed('Unrelated.md');await vi.advanceTimersByTimeAsync(200);expect(f.read).toHaveBeenCalledOnce();f.changed();f.display.render('Other.md',true);await vi.advanceTimersByTimeAsync(200);expect(f.read).toHaveBeenCalledTimes(2);expect(f.read).toHaveBeenLastCalledWith('Other.md','section');f.display.unload();
 });
 it('refreshes values when counting options change without changing the display mode or source',()=>{const f=fixture();f.setMode('section');f.display.render('Companion.md',true);f.setWhitespace(false);f.sourceCharacters.mockReturnValue(15);f.display.render('Companion.md',true);expect(f.read).toHaveBeenCalledTimes(2);expect(f.showTotal).toHaveBeenLastCalledWith(15);expect(f.navigation.setSizes).toHaveBeenLastCalledWith(expect.any(Map),'section',{whitespace:false,footnotes:true});f.display.unload();});
 it('shows an explicit document goal with section sizes off, without calculating section bars',()=>{const f=fixture();f.setTarget(100);f.display.render('Companion.md',true);expect(f.showTotal).toHaveBeenLastCalledWith(20,100);expect(f.read).not.toHaveBeenCalled();expect(f.subscribe).toHaveBeenCalledOnce();f.setTarget(undefined);f.display.render('Companion.md',true);expect(f.showTotal).toHaveBeenLastCalledWith(undefined);expect(f.unsubscribe).toHaveBeenCalledOnce();f.display.unload();});
 it('updates the document total with the same debounce and clears it when disabled, hidden or unloaded',async()=>{
  const f=fixture();f.display.render('Companion.md',true);expect(f.sourceCharacters).not.toHaveBeenCalled();expect(f.showTotal).toHaveBeenLastCalledWith(undefined);f.setMode('section');f.display.render('Companion.md',true);expect(f.showTotal).toHaveBeenLastCalledWith(20);
  f.sourceCharacters.mockReturnValue(25);f.changed();await vi.advanceTimersByTimeAsync(160);expect(f.showTotal).toHaveBeenLastCalledWith(25);f.display.render('Companion.md',false);expect(f.showTotal).toHaveBeenLastCalledWith(undefined);f.setMode('subtree');f.display.render('Companion.md',true);expect(f.showTotal).toHaveBeenLastCalledWith(25);f.sourceCharacters.mockReturnValue(0);f.changed();await vi.advanceTimersByTimeAsync(160);expect(f.showTotal).toHaveBeenLastCalledWith(0);f.display.unload();expect(f.showTotal).toHaveBeenLastCalledWith(undefined);
 });
});
