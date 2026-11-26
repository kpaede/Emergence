// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {CompanionDragActivity} from '../src/companion/drag-activity';
import {installDomHelpers} from './helpers/dom';
vi.mock('obsidian',async original=>({...await original<Record<string,unknown>>(),Component:(await import('./helpers/reader-host')).TestComponent}));
beforeEach(()=>{installDomHelpers();document.body.empty();});
describe('companion native drag activity',()=>{
 it('holds refreshes for a drag started in the main editor, including when moving outside the panel',()=>{
  const host=document.body.createDiv(),main=document.body.createDiv(),changed=vi.fn(),activity=new CompanionDragActivity(host,()=>true,changed);main.dispatchEvent(new Event('dragstart',{bubbles:true}));expect(changed).toHaveBeenCalledWith(true);host.dispatchEvent(new Event('dragenter',{bubbles:true}));host.dispatchEvent(new Event('dragover',{bubbles:true}));host.dispatchEvent(new MouseEvent('dragleave',{bubbles:true,relatedTarget:main}));expect(changed).toHaveBeenCalledTimes(1);main.dispatchEvent(new Event('dragend',{bubbles:true}));expect(changed.mock.calls).toEqual([[true],[false]]);activity.unload();
 });
 it('tracks a drag from another application and ends it on leaving the panel or dropping',()=>{
  const host=document.body.createDiv(),child=host.createDiv(),outside=document.body.createDiv(),changed=vi.fn(),activity=new CompanionDragActivity(host,()=>true,changed);child.dispatchEvent(new Event('dragenter',{bubbles:true}));child.dispatchEvent(new MouseEvent('dragleave',{bubbles:true,relatedTarget:host}));expect(changed.mock.calls).toEqual([[true]]);host.dispatchEvent(new MouseEvent('dragleave',{bubbles:true,relatedTarget:outside}));expect(changed.mock.calls).toEqual([[true],[false]]);host.dispatchEvent(new Event('dragover',{bubbles:true}));child.dispatchEvent(new Event('drop',{bubbles:true}));expect(changed.mock.calls).toEqual([[true],[false],[true],[false]]);activity.unload();
 });
 it('ignores a hidden panel and removes all listeners on unload',()=>{
  const host=document.body.createDiv(),changed=vi.fn();let enabled=false;const activity=new CompanionDragActivity(host,()=>enabled,changed);host.dispatchEvent(new Event('dragstart',{bubbles:true}));expect(changed).not.toHaveBeenCalled();enabled=true;host.dispatchEvent(new Event('dragstart',{bubbles:true}));activity.unload();expect(changed.mock.calls).toEqual([[true],[false]]);host.dispatchEvent(new Event('dragover',{bubbles:true}));expect(changed).toHaveBeenCalledTimes(2);
 });
});
