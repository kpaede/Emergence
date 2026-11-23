// @vitest-environment jsdom
import {beforeEach,describe,expect,it} from 'vitest';
import {installDomHelpers} from './helpers/dom';
import {nameByVisibleElement,nameWithoutTooltip,tooltipForClippedText} from '../src/ui/accessibility';
beforeEach(()=>{installDomHelpers();document.body.replaceChildren();});
describe('accessible names without redundant hover text',()=>{
 it('keeps an accessible name while removing the attribute Obsidian turns into a hover tooltip',()=>{
  const host=document.body.createDiv(),region=host.createDiv({attr:{'aria-label':'Old'}});nameWithoutTooltip(region,'Tetrade');const id=region.getAttribute('aria-labelledby')!;expect(document.getElementById(id)?.textContent).toBe('Tetrade');expect(region.hasAttribute('aria-label')).toBe(false);
  nameWithoutTooltip(region,'Tetrad');expect(region.getAttribute('aria-labelledby')).toBe(id);expect(host.querySelectorAll('.em-sr-only')).toHaveLength(1);expect(document.getElementById(id)?.textContent).toBe('Tetrad');
 });
 it('uses an existing visible caption without adding duplicate diagram text',()=>{
  const region=document.body.createDiv(),caption=region.createSpan({text:'Topic'}),before=region.textContent;nameByVisibleElement(region,caption);expect(region.textContent).toBe(before);expect(region.getAttribute('aria-labelledby')).toBe(caption.id);
 });
 it('shows the complete caption only when its displayed text is clipped',()=>{
  const caption=document.body.createSpan({text:'Long section title',attr:{title:'Old'}});let clipped=false;Object.defineProperty(caption,'scrollWidth',{get:()=>clipped?150:100});Object.defineProperty(caption,'clientWidth',{value:100});tooltipForClippedText(caption,'Long section title');caption.dispatchEvent(new MouseEvent('mouseenter'));expect(caption.hasAttribute('title')).toBe(false);clipped=true;caption.dispatchEvent(new MouseEvent('mouseenter'));expect(caption.title).toBe('Long section title');clipped=false;caption.dispatchEvent(new MouseEvent('mouseenter'));expect(caption.hasAttribute('title')).toBe(false);
 });
});
