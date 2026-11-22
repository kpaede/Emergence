// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {installDomHelpers} from './helpers/dom';
import {CompanionNavigation} from '../src/companion/navigation';
import type {CompanionDocument,CompanionSection} from '../src/companion/model';

vi.mock('obsidian',async importOriginal=>({
 ...await importOriginal<Record<string,unknown>>(),Component:(await import('./helpers/reader-host')).TestComponent,
}));
beforeEach(()=>{
 installDomHelpers();document.body.empty();Object.defineProperties(HTMLElement.prototype,{
  addClasses:{configurable:true,value:function(this:HTMLElement,names:string[]){this.classList.add(...names);}},
  toggleClass:{configurable:true,value:function(this:HTMLElement,name:string,on:boolean){this.classList.toggle(name,on);}},
  scrollIntoView:{configurable:true,value:vi.fn()},
 });
});
function fixture(files=false){
 const make=(id:string,index:number,level:number,parent:number):CompanionSection=>({id,title:id.toUpperCase(),level,state:'linked',raw:'',base:{index,title:id.toUpperCase(),level,parent,from:index,line:index,body:''}}),sections=[make('a',0,1,-1),make('b',1,2,0),make('c',2,3,1),make('d',3,1,-1)];
 const doc:CompanionDocument={id:'companion',source:'Main.md',sections,preamble:'',newline:'\n',original:'',header:'',...(files?{storage:{mode:'sections' as const,location:'beside' as const,folder:''},files:Object.fromEntries(sections.map(section=>[section.id,section.id+'.md']))}:{})};
 const host=document.body.createDiv(),choose=vi.fn(),move=vi.fn(),open=vi.fn(),navigation=new CompanionNavigation(host,choose,move,open),row=(id:string)=>host.querySelector<HTMLElement>('[data-em-section="'+id+'"]')!,key=(id:string,key:string)=>row(id).dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
 return {doc,host,choose,move,open,navigation,row,key};
}
describe('Companion outline keyboard navigation',()=>{
 it('has one row tab stop and does not steal focus from the main editor on render',()=>{
  const f=fixture(),outside=document.body.createEl('input');outside.focus();f.navigation.render(f.doc,'d','Companion.md');expect(document.activeElement).toBe(outside);expect([...f.host.querySelectorAll<HTMLElement>('[data-em-section]')].filter(row=>row.tabIndex===0)).toEqual([f.row('d')]);f.navigation.unload();
 });
 it('uses up/down and home/end for visible heading focus, then Enter or Space to choose',()=>{
  const f=fixture();f.navigation.render(f.doc,'a','Companion.md');f.row('a').focus();for(const id of ['b','c','d']){f.key((document.activeElement as HTMLElement).dataset.emSection!,'ArrowDown');expect(document.activeElement).toBe(f.row(id));}f.key('d','ArrowDown');expect(document.activeElement).toBe(f.row('d'));f.key('d','Home');expect(document.activeElement).toBe(f.row('a'));f.key('a','End');expect(document.activeElement).toBe(f.row('d'));expect(f.choose).not.toHaveBeenCalled();f.key('d','Enter');expect(f.choose).toHaveBeenLastCalledWith(f.doc.sections[3]);f.key('d',' ');expect(f.choose).toHaveBeenCalledTimes(2);f.navigation.unload();
 });
 it('uses left/right to collapse, expand and move between immediate parents and children',()=>{
  const f=fixture();f.navigation.render(f.doc,'a','Companion.md');f.row('a').focus();f.key('a','ArrowLeft');expect(f.row('a').parentElement!.getAttribute('aria-expanded')).toBe('false');f.key('a','ArrowDown');expect(document.activeElement).toBe(f.row('d'));f.key('d','ArrowUp');expect(document.activeElement).toBe(f.row('a'));f.key('a','ArrowRight');expect(f.row('a').parentElement!.getAttribute('aria-expanded')).toBe('true');expect(document.activeElement).toBe(f.row('a'));f.key('a','ArrowRight');expect(document.activeElement).toBe(f.row('b'));f.key('b','ArrowRight');expect(document.activeElement).toBe(f.row('c'));f.key('c','ArrowLeft');expect(document.activeElement).toBe(f.row('b'));f.key('b','ArrowLeft');expect(f.row('b').parentElement!.getAttribute('aria-expanded')).toBe('false');f.key('b','ArrowLeft');expect(document.activeElement).toBe(f.row('a'));f.navigation.unload();
 });
 it('retains focused heading after rerender and uses a visible fallback if that heading disappears',()=>{
  const f=fixture();f.navigation.render(f.doc,'a','Companion.md');f.row('c').focus();const before=f.row('c');f.navigation.render(f.doc,'a','Companion.md');expect(f.row('c')).not.toBe(before);expect(document.activeElement).toBe(f.row('c'));expect(f.row('c').tabIndex).toBe(0);f.doc.sections=f.doc.sections.filter(section=>section.id!=='c');f.navigation.render(f.doc,'a','Companion.md');expect(document.activeElement).toBe(f.row('a'));f.navigation.unload();
 });
 it.each(['a','b'])('keeps the selected heading %s manually collapsed after a repaint',id=>{
  const f=fixture();f.navigation.render(f.doc,id,'Companion.md');f.row(id).focus();f.key(id,'ArrowLeft');expect(f.row(id).parentElement!.getAttribute('aria-expanded')).toBe('false');f.navigation.render(f.doc,id,'Companion.md');expect(f.row(id).parentElement!.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(f.row(id));f.key(id,'ArrowDown');expect(document.activeElement).toBe(f.row('d'));f.navigation.unload();
 });
 it('does not restore outline focus after the user has returned to the main editor',()=>{
  const f=fixture();f.navigation.render(f.doc,'a','Companion.md');f.row('b').focus();const outside=document.body.createEl('input');outside.focus();f.navigation.render(f.doc,'b','Companion.md');expect(document.activeElement).toBe(outside);f.navigation.unload();
 });
 it('retains keyboard access to the focused chapter file action without selecting its heading',()=>{
  const f=fixture(true);f.navigation.render(f.doc,'a','Companion.md');const file=f.row('b').querySelector<HTMLButtonElement>('button')!;file.focus();expect(file.tabIndex).toBe(0);expect(f.row('a').querySelector<HTMLButtonElement>('button')!.tabIndex).toBe(-1);f.navigation.render(f.doc,'a','Companion.md');const restored=f.row('b').querySelector<HTMLButtonElement>('button')!;expect(document.activeElement).toBe(restored);restored.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));expect(f.choose).not.toHaveBeenCalled();restored.click();expect(f.open).toHaveBeenCalledWith(f.doc.sections[1]);expect(f.choose).not.toHaveBeenCalled();f.navigation.unload();
 });
 it('includes unassigned rows only when their group is open and retains that state on render',()=>{
  const f=fixture();f.doc.sections.push({id:'free',title:'Unassigned',level:1,state:'detached',raw:''});f.navigation.render(f.doc,'d','Companion.md');f.row('d').focus();f.key('d','ArrowDown');expect(document.activeElement).toBe(f.row('d'));f.host.querySelector('details')!.open=true;f.key('d','ArrowDown');expect(document.activeElement).toBe(f.row('free'));f.navigation.render(f.doc,'d','Companion.md');expect(f.host.querySelector('details')!.open).toBe(true);expect(document.activeElement).toBe(f.row('free'));f.navigation.unload();
 });
});
