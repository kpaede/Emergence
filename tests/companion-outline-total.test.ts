// @vitest-environment jsdom
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {installDomHelpers} from './helpers/dom';
import {initializeLanguage} from '../src/i18n';
import {OutlineTotal} from '../src/companion/outline-total';
vi.mock('obsidian',async importOriginal=>({...await importOriginal<Record<string,unknown>>(),Component:(await import('./helpers/reader-host')).TestComponent}));
beforeEach(()=>{initializeLanguage('de');installDomHelpers();document.body.empty();});
describe('whole-document target progress',()=>{
 it('uses the configured target as denominator, updates in place and keeps actual over-target counts',()=>{const click=vi.fn(),total=new OutlineTotal(document.body,click),options={whitespace:true,footnotes:true};total.render(100000,200000,options);const bar=total.root.querySelector<HTMLElement>('.em-companion-total-fill')!,button=total.root.querySelector('button')!;expect(bar.style.width).toBe('50%');expect(button.textContent).toBe('100.000 / 200.000 Z.');button.click();expect(click).toHaveBeenCalledOnce();total.render(300000,200000,options);expect(total.root.querySelector('.em-companion-total-fill')).toBe(bar);expect(bar.style.width).toBe('100%');expect(button.textContent).toContain('300.000');expect(total.root.querySelector('[role=progressbar]')!.getAttribute('aria-valuetext')).toContain('150');total.render(300000,undefined,options);expect(total.root.querySelector<HTMLElement>('[role=progressbar]')!.hidden).toBe(true);expect(total.root.dataset.emCharacterTarget).toBeUndefined();total.unload();expect(document.body.children).toHaveLength(0);});
});
