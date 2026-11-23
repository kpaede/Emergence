// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {App} from 'obsidian';
import {installDomHelpers} from './helpers/dom';
import {TetradInlineEditor} from '../src/tetrad/inline-editor';
vi.mock('obsidian',async original=>({...await original<Record<string,unknown>>(),Component:(await import('./helpers/reader-host')).TestComponent}));
vi.mock('../src/mermaid/markdown-editor',async()=>{
 const {TestMarkdownEditor}=await import('./helpers/reader-host');
 return {MermaidMarkdownEditor:class extends TestMarkdownEditor{set(value:string){this.native.editor.setValue(value);}}};
});
let editor:TetradInlineEditor;
beforeEach(()=>{installDomHelpers();document.body.empty();});
afterEach(()=>{editor?.unload();vi.restoreAllMocks();});
function fixture(singleLine=false){const save=vi.fn(async()=>{}),cancel=vi.fn(),app={scope:{},workspace:{}} as unknown as App,host=document.body.createDiv();editor=new TetradInlineEditor(app,host,'Text',undefined,save,cancel,singleLine);return {host,save,cancel,input:host.querySelector('textarea')!};}
function key(input:HTMLElement,value:string,mod=false){input.dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,ctrlKey:mod}));}
describe('direct tetrad Markdown input',()=>{
 it('keeps accepted drag-source DOM mounted without accepting the same edit again on blur',async()=>{const f=fixture();editor.setValue('Accepted');await editor.commit();editor.holdAccepted();f.input.dispatchEvent(new FocusEvent('blur'));await editor.commit();expect(f.save).toHaveBeenCalledOnce();expect(f.host.inert).toBe(true);expect(f.host.isConnected).toBe(true);});
 it('accepts with Ctrl+Enter without opening action bars or dialogs',async()=>{const f=fixture();expect(f.host.querySelector('button')).toBeNull();key(f.input,'Enter',true);await vi.waitFor(()=>expect(f.save).toHaveBeenCalledWith('Text'));});
 it('cancels with Escape without accepting the edit',()=>{const f=fixture();key(f.input,'Escape');expect(f.cancel).toHaveBeenCalledOnce();expect(f.save).not.toHaveBeenCalled();});
 it('accepts on focus leaving the field',async()=>{const f=fixture();f.input.focus();f.input.blur();await vi.waitFor(()=>expect(f.save).toHaveBeenCalledOnce());});
 it('keeps only titles single-line',()=>{const f=fixture(true);expect(()=>editor.setValue('One\nTwo')).toThrow();expect(editor.value).toBe('Text');expect(f.save).not.toHaveBeenCalled();});
 it('allows line breaks and paragraphs without accepting on plain Enter',()=>{const f=fixture();editor.setValue('First line\nSecond line\n\nNext paragraph');key(f.input,'Enter');expect(editor.value).toContain('\n\nNext paragraph');expect(f.save).not.toHaveBeenCalled();});
 it('keeps failed writes visible without publishing the input',async()=>{const f=fixture();f.save.mockRejectedValue(Error('Disk full'));await expect(editor.commit()).rejects.toThrow('Disk full');expect(f.host.querySelector('[role=alert]')!.textContent).toBe('Disk full');expect(f.cancel).not.toHaveBeenCalled();});
});
