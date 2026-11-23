// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {installDomHelpers} from './helpers/dom';
import {mountLineFlow,refreshTetradFlow} from '../src/tetrad/render/line-flow';
let frames:Map<number,FrameRequestCallback>,disconnect:()=>void,cancel:(id:number)=>void;
beforeEach(()=>{
 installDomHelpers();Object.defineProperty(document,'win',{value:window,configurable:true});vi.stubGlobal('createEl',(tag:keyof HTMLElementTagNameMap)=>{const element=document.body.createEl(tag);element.remove();return element;});document.body.replaceChildren();frames=new Map();disconnect=vi.fn();cancel=vi.fn((id:number)=>{frames.delete(id);});let id=0;
 vi.stubGlobal('CSS',{supports:()=>true});vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){disconnect();}});
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frames.set(++id,callback);return id;});vi.stubGlobal('cancelAnimationFrame',cancel);
});
afterEach(()=>{vi.unstubAllGlobals();Reflect.deleteProperty(document,'win');});
function fixture(){const grid=document.body.createDiv({cls:'tetrader-grid'}),wing=grid.createEl('section',{cls:'tetrader-enhances'}),root=wing.createDiv({cls:'tetrader-glosses'}),gloss=root.createDiv({cls:'tetrader-gloss'}),paragraph=gloss.createEl('p');paragraph.append('One ');const link=paragraph.createEl('a',{text:'Native link',attr:{href:'Target.md'}});paragraph.append(' in a paragraph.');return {grid,root,link};}

describe('tetrad line flow lifecycle',()=>{
 it('adds only empty presentation edges and preserves native Markdown nodes and link behavior',()=>{
  const f=fixture(),text=f.grid.textContent,clicked=vi.fn();f.link.addEventListener('click',event=>{event.preventDefault();clicked();});const flow=mountLineFlow(f.grid);
  expect(f.root.querySelectorAll('[aria-hidden=true]')).toHaveLength(2);expect(f.grid.textContent).toBe(text);expect(f.root.querySelector('a')).toBe(f.link);f.link.click();expect(clicked).toHaveBeenCalledOnce();flow.destroy();expect(f.root.querySelector('.tetrader-flow-edge')).toBeNull();expect(f.root.querySelector('a')).toBe(f.link);
 });
 it('cancels its observer and pending frame when the diagram is removed',()=>{
  const f=fixture(),flow=mountLineFlow(f.grid);expect(frames.size).toBe(1);flow.destroy();expect(disconnect).toHaveBeenCalledOnce();expect(frames.size).toBe(0);refreshTetradFlow(f.grid);expect(frames.size).toBe(0);
 });
 it('coalesces explicit refresh requests instead of starting a permanent update loop',()=>{
  const f=fixture(),flow=mountLineFlow(f.grid);for(let i=0;i<20;i++)refreshTetradFlow(f.grid);expect(frames.size).toBe(1);flow.destroy();
 });
});
