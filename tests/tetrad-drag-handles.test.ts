// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {Component} from 'obsidian';
import {TestComponent} from './helpers/reader-host';
import {installDomHelpers} from './helpers/dom';
import {dragHandles} from '../src/tetrad/drag-handles';
vi.mock('obsidian',()=>({setIcon:vi.fn(),setTooltip:vi.fn()}));
let lifecycle:TestComponent;
beforeEach(()=>{installDomHelpers();document.body.replaceChildren();lifecycle=new TestComponent();});
afterEach(()=>{lifecycle.unload();vi.restoreAllMocks();vi.useRealTimers();});
describe('Tetrad drag handles on visual lines',()=>{
 it('keeps a pressed grip fixed and reachable while the pointer moves outside the text line',()=>{
  vi.useFakeTimers();const row=document.body.createDiv();row.createEl('p',{text:'Text'});vi.spyOn(row,'getBoundingClientRect').mockReturnValue({left:100,top:200,width:200,height:40} as DOMRect);const create=document.createRange.bind(document);
  vi.spyOn(document,'createRange').mockImplementation(()=>{const range=create();Object.defineProperty(range,'getClientRects',{value:()=>[{left:100,right:220,top:200,bottom:218,width:120,height:18}]});return range;});
  dragHandles(lifecycle as unknown as Component,row,vi.fn(),vi.fn());row.dispatchEvent(new MouseEvent('pointermove',{clientY:205}));const grip=row.querySelector<HTMLElement>('[draggable]')!,actions=row.querySelector('.em-tetrad-row-actions')!,top=grip.style.top;
  grip.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0}));grip.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,clientY:230}));row.dispatchEvent(new MouseEvent('pointerleave'));vi.advanceTimersByTime(300);
  expect(actions.classList.contains('has-line')).toBe(true);expect(grip.style.top).toBe(top);document.dispatchEvent(new MouseEvent('pointerup'));row.dispatchEvent(new MouseEvent('pointerleave'));vi.advanceTimersByTime(130);expect(actions.classList.contains('has-line')).toBe(false);
 });
 it('measures current editor text and invalidates cached line edges even when its dimensions stay the same',async()=>{
  const row=document.body.createDiv({cls:'is-editing'});row.createEl('p',{text:'Old reading text'});const text=row.createDiv({cls:'em-tetrad-edit-overlay'}).createDiv({cls:'cm-content'}).createSpan({text:'New text'});vi.spyOn(row,'getBoundingClientRect').mockReturnValue({left:100,top:200,width:200,height:40} as DOMRect);const create=document.createRange.bind(document);
  vi.spyOn(document,'createRange').mockImplementation(()=>{const range=create();Object.defineProperty(range,'getClientRects',{value:()=>{const left=range.startContainer.parentElement?.closest('.cm-content')?(text.textContent==='New text'?130:160):100;return [{left,right:230,top:200,bottom:218,width:230-left,height:18}];}});return range;});
  dragHandles(lifecycle as unknown as Component,row,vi.fn(),vi.fn());row.dispatchEvent(new MouseEvent('pointermove',{clientY:205}));const grip=row.querySelector<HTMLElement>('[draggable]')!;expect(grip.style.left).toBe('0px');text.setText('Short');await Promise.resolve();row.dispatchEvent(new MouseEvent('pointermove',{clientY:205}));expect(grip.style.left).toBe('30px');
  lifecycle.unload();expect(row.querySelector('.em-tetrad-row-actions')).toBeNull();
 });
 it('places the same two handles at both edges of whichever text line is hovered',()=>{
  const row=document.body.createDiv();row.createEl('p',{text:'Text wrapping into three lines'});vi.spyOn(row,'getBoundingClientRect').mockReturnValue({left:100,top:200,width:300,height:60} as DOMRect);
  const rects=[{left:130,right:250,top:200,bottom:218,width:120,height:18},{left:140,right:280,top:220,bottom:238,width:140,height:18},{left:150,right:280,top:240,bottom:258,width:130,height:18}],create=document.createRange.bind(document);
  vi.spyOn(document,'createRange').mockImplementation(()=>{const range=create();Object.defineProperty(range,'getClientRects',{value:()=>rects});return range;});
  dragHandles(lifecycle as unknown as Component,row,vi.fn(),vi.fn());const handles=row.querySelectorAll<HTMLButtonElement>('[draggable=true]'),actions=row.querySelector('.em-tetrad-row-actions')!;
  expect(handles).toHaveLength(2);expect(actions.classList.contains('has-line')).toBe(false);
  row.dispatchEvent(new MouseEvent('pointermove',{clientY:225}));expect(actions.classList.contains('has-line')).toBe(true);expect([handles[0]!.style.left,handles[1]!.style.left]).toEqual(['10px','180px']);expect(handles[0]!.style.top).toBe('14px');
  row.dispatchEvent(new MouseEvent('pointermove',{clientY:245}));expect(handles[0]!.style.left).toBe('20px');expect(handles[0]!.style.top).toBe('34px');expect(row.querySelectorAll('button')).toHaveLength(2);
  handles[0]!.focus();expect(handles[0]!.style.top).toBe('34px');expect(handles[0]!.style.left).toBe('20px');
  vi.useFakeTimers();row.dispatchEvent(new MouseEvent('pointerleave'));expect(actions.classList.contains('has-line')).toBe(true);vi.advanceTimersByTime(130);expect(actions.classList.contains('has-line')).toBe(false);
 });
});
