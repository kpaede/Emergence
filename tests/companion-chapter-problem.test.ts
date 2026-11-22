// @vitest-environment jsdom
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {installDomHelpers} from './helpers/dom';
import {renderChapterFileProblem} from '../src/companion/chapter-file-problem';
import {storageSummary} from '../src/companion/storage-summary';
beforeEach(()=>{installDomHelpers();document.body.empty();});
describe('chapter-specific recovery controls',()=>{
 it('offers file selection, explicit empty-file creation and retry directly instead of another list of paths',()=>{
  const host=document.body.createDiv(),actions={retry:vi.fn(),choose:vi.fn(),create:vi.fn(async()=>{}),open:vi.fn()};renderChapterFileProblem(host,{reason:'missing',path:'Chapters/A.md',reference:''},actions);
  expect(host.querySelectorAll('button')).toHaveLength(3);expect(host.querySelector('[data-companion-action=missing-files]')).toBeNull();host.querySelector<HTMLButtonElement>('[data-companion-action=choose-chapter-file]')!.click();expect(actions.choose).toHaveBeenCalledOnce();expect(host.textContent).toContain('Chapters/A.md');expect(host.textContent).toContain('leere Kapiteldatei');
 });
 it('keeps an existing invalid file inspectable and offers replacement selection without overwriting it',()=>{
  const host=document.body.createDiv(),actions={retry:vi.fn(),choose:vi.fn(),create:vi.fn(async()=>{}),open:vi.fn()};renderChapterFileProblem(host,{reason:'invalid',path:'Chapters/B.md',reference:'',message:'Wrong chapter assignment'},actions);
  expect(host.textContent).not.toContain('Diese Kapiteldatei fehlt');expect(host.querySelector('[data-companion-action=create-chapter-file]')).toBeNull();expect(host.querySelector('details')?.textContent).toContain('Wrong chapter assignment');
 });
 it('prevents a second create request while the first request is running',async()=>{
  const host=document.body.createDiv();let finish!:()=>void;const create=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));renderChapterFileProblem(host,{reason:'missing',path:'A.md',reference:''},{retry:()=>{},choose:()=>{},create,open:()=>{}});
  const button=host.querySelector<HTMLButtonElement>('[data-companion-action=create-chapter-file]')!;button.click();button.click();expect(create).toHaveBeenCalledOnce();expect(button.disabled).toBe(true);finish();await Promise.resolve();expect(button.disabled).toBe(false);
 });
});
describe('visible storage defaults',()=>{
 it('describes the actual default folder relative to the main document for each storage mode',()=>{
  expect(storageSummary({mode:'sections',location:'subfolder',folder:'',subfolder:'My companions'},'Research/Book.md')).toEqual({description:'Unterordner „My companions“ neben dem Hauptdokument',folder:'Research/My companions'});
  expect(storageSummary({mode:'document',location:'beside',folder:''},'Research/Book.md').folder).toBe('Research');
  expect(storageSummary({mode:'document',location:'folder',folder:'All companions'},'Research/Book.md').folder).toBe('All companions');
  expect(storageSummary({mode:'document',location:'beside',folder:''},'Book.md').folder).toBe('Vault-Hauptordner');
 });
});
