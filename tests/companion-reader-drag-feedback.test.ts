// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {ReaderDrag} from '../src/companion/reader-drag';
import {thoughtIndex} from '../src/companion/board-model';
import {thoughts} from '../src/companion/thoughts';
import type {CompanionDocument} from '../src/companion/model';
import {installDomHelpers} from './helpers/dom';
import {TestComponent} from './helpers/reader-host';
vi.mock('obsidian',async original=>({...await original<Record<string,unknown>>(),Component:(await import('./helpers/reader-host')).TestComponent}));
beforeEach(()=>{installDomHelpers();document.body.empty();});
function fixture(){
 const document:CompanionDocument={id:'pair',source:'Main.md',preamble:'',newline:'\n',header:'',original:'',sections:[{id:'s',title:'Section',level:1,state:'linked',format:2,raw:'- A <!-- em-note:a -->\n- B <!-- em-note:b -->\n'}]},index=thoughtIndex(thoughts(document.sections[0]!)),host=window.document.body.createDiv(),list=host.createDiv(),row=list.createDiv({cls:'em-reader-node'}),lifecycle=new TestComponent(),apply=vi.fn(async()=>{}),drag=new ReaderDrag(host,list,()=>({path:'Companion.md',document,section:'s',index,selected:new Set(['a']),blocked:false}),vi.fn(),apply);
 list.getBoundingClientRect=()=>new DOMRect(0,0,300,300);row.getBoundingClientRect=()=>new DOMRect(0,50,300,60);drag.target(lifecycle as never,row,'b');const event=(type:string)=>{const e=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:225,clientY:80});Object.defineProperty(e,'dataTransfer',{configurable:true,value:{types:['text/plain'],dropEffect:'copy',getData:()=>''}});return e;};
 return {host,list,row,drag,lifecycle,event,apply};
}
describe('stable reader hover feedback',()=>{
 it('shows a target on dragenter, before a browser has delivered its first dragover',()=>{const f=fixture();f.row.dispatchEvent(f.event('dragenter'));expect(f.row.dataset.readerDrop).toBe('last');expect(f.apply).not.toHaveBeenCalled();f.drag.unload();f.lifecycle.unload();});
 it('keeps the same visible target without rewriting its classes, attributes or grid on repeated hover',()=>{
  const f=fixture(),observer=new MutationObserver(()=>{});observer.observe(f.host,{attributes:true,subtree:true});f.row.dispatchEvent(f.event('dragover'));expect(f.row.dataset.readerDrop).toBe('last');observer.takeRecords();for(let n=0;n<20;n++)f.row.dispatchEvent(f.event('dragover'));expect(observer.takeRecords()).toHaveLength(0);expect(f.apply).not.toHaveBeenCalled();f.drag.unload();f.lifecycle.unload();observer.disconnect();
 });
 it('clears feedback on cancellation and can restart without stale targets',()=>{
  const f=fixture();f.row.dispatchEvent(f.event('dragover'));window.document.dispatchEvent(new Event('dragend'));expect(f.row.dataset.readerDrop).toBeUndefined();expect(f.host.classList.contains('is-dragging')).toBe(false);f.row.dispatchEvent(f.event('dragover'));expect(f.row.dataset.readerDrop).toBe('last');f.drag.unload();expect(f.row.dataset.readerDrop).toBeUndefined();f.lifecycle.unload();
 });
 it('clears external drag styles when the pointer leaves, even when Zotero owns dragend',()=>{const f=fixture();f.row.dispatchEvent(f.event('dragenter'));expect(f.host.classList.contains('is-dragging')).toBe(true);f.host.dispatchEvent(new MouseEvent('dragleave',{bubbles:true,clientX:400,clientY:0,relatedTarget:window.document.body}));expect(f.row.dataset.readerDrop).toBeUndefined();expect(f.host.classList.contains('is-dragging')).toBe(false);f.drag.unload();f.lifecycle.unload();});
});
