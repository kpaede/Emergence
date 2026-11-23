// @vitest-environment jsdom
import {beforeEach,describe,expect,it} from 'vitest';
import {applyNativeListMarkers} from '../src/ui/markdown-lists';
import {installDomHelpers} from './helpers/dom';

beforeEach(()=>{installDomHelpers();document.body.replaceChildren();});

describe('native Obsidian list markup in embedded Markdown',()=>{
 it('decorates nested unordered lists once without changing their text or links',()=>{
  const root=document.body.createDiv(),list=root.createEl('ul'),first=list.createEl('li',{text:'First '});first.createEl('a',{text:'Link',attr:{href:'Note'}});first.createEl('ul').createEl('li',{text:'Nested'});list.createEl('li',{text:'Second'});root.createEl('ol').createEl('li',{text:'Numbered'});
  const before=root.textContent,link=root.querySelector('a');applyNativeListMarkers(root);applyNativeListMarkers(root);
  expect(root.querySelectorAll('ul.has-list-bullet')).toHaveLength(2);expect(root.querySelectorAll('.list-bullet')).toHaveLength(3);expect(root.querySelector('ol .list-bullet')).toBeNull();expect(root.textContent).toBe(before);expect(root.querySelector('a')).toBe(link);expect([...root.querySelectorAll('.list-bullet')].every(el=>el.getAttribute('aria-hidden')==='true')).toBe(true);
 });
 it('preserves native task checkboxes and existing native bullet elements',()=>{
  const root=document.body.createDiv(),list=root.createEl('ul'),task=list.createEl('li',{cls:'task-list-item'});task.createEl('input',{type:'checkbox'}).checked=true;task.createSpan({text:'Done'});const plain=list.createEl('li');plain.createSpan({cls:'list-bullet'});plain.createSpan({text:'Plain'});
  const checkbox=root.querySelector('input'),marker=root.querySelector('.list-bullet');applyNativeListMarkers(root);
  expect(root.querySelector('input')).toBe(checkbox);expect(checkbox?.checked).toBe(true);expect(root.querySelector('.task-list-item .list-bullet')).toBeNull();expect(root.querySelectorAll('.list-bullet')).toHaveLength(1);expect(root.querySelector('.list-bullet')).toBe(marker);
 });
});
