import {describe,it,expect} from 'vitest';
import {multilineOutline} from '../src/companion/multiline';
import {mergeNativeOutline,projectionFromBody,sectionOutline} from '../src/companion/native-projection';
import {thoughts,markThoughts,applyThought} from '../src/companion/thoughts';
import {emptyCompanion,serializeCompanion,parseCompanion} from '../src/companion/codec';
import {lineageDocument,lineageOutline} from '../src/companion/lineage-adapter';
import type {CompanionSection} from '../src/companion/model';
const section=(raw=''):CompanionSection=>({id:'chapter',title:'Chapter',level:1,state:'linked',format:2,raw});
const body='- [ ] First paragraph\n  \n  Second paragraph  \n  - Internal list\n    - Nested content\n  ## Heading within content <!-- em-section:literal -->\n  ```html\n  <!--section: 1-->\n  - Code sample\n  ```\n  \n\t- Actual child\n\t  \n\t  > Quotation\n- Another thought\n';
describe('Multiline companion boundary',()=>{
 it('counts only real thoughts and preserves the full native text, including marker-like examples',()=>{
  const before=section(),raw=mergeNativeOutline(before,projectionFromBody(body,'')),current={...before,raw},nodes=thoughts(current);
  expect(nodes).toHaveLength(3);expect(nodes[1]!.parent).toBe(nodes[0]!.id);expect(nodes[2]!.parent).toBeUndefined();expect(sectionOutline(current)).toBe(body);
  expect(nodes[0]!.text).toContain('Second paragraph  \n- Internal list');expect(nodes[0]!.text).toContain('<!--section: 1-->');
 });
 it('retains literal companion identity examples in content and on the first line',()=>{
  const text='- Literal <!-- em-note:example -->\n  - More <!-- em-note:another -->\n',s=section(),raw=mergeNativeOutline(s,text);
  expect(sectionOutline({...s,raw})).toBe(text);expect(thoughts({...s,raw})).toHaveLength(1);
 });
 it('persists its format without interpreting content headings as companion chapters',()=>{
  const doc=emptyCompanion('Main.md');doc.sections=[section(mergeNativeOutline(section(),body))];const serialized=serializeCompanion(doc),restored=parseCompanion(serialized);
  expect(serialized).toContain('eome-outline-format: 2');expect(restored.sections).toHaveLength(1);expect(restored.sections[0]!.format).toBe(2);expect(sectionOutline(restored.sections[0]!)).toBe(body);
 });
 it('recognizes an external EOME whole-file migration from its format header',()=>{const doc=emptyCompanion('Main.md');doc.sections=[section(mergeNativeOutline(section(),body))];const text=serializeCompanion(doc).replace(/ {4}format: 2\n/gu,'').replace(/ {2}format: 2\n/gu,'');const parsed=parseCompanion(text);expect(parsed.sections[0]!.format).toBe(2);expect(thoughts(parsed.sections[0]!)).toHaveLength(3);});
 it('rejects unsupported future outline formats before normalization',()=>{const doc=emptyCompanion('Main.md');doc.sections=[section(mergeNativeOutline(section(),body))];expect(()=>parseCompanion(serializeCompanion(doc).replace('eome-outline-format: 2','eome-outline-format: 3'))).toThrow();});
 it('converts legacy space-indented children according to the old tree',()=>{
  const legacy:CompanionSection={...section(),format:undefined,raw:'- Root <!-- em-note:root -->\n  - Child <!-- em-note:child -->\n    - Grandchild <!-- em-note:grandchild -->\n'};
  expect(sectionOutline(legacy)).toBe('- Root\n\t- Child\n\t\t- Grandchild\n');const raw=mergeNativeOutline(legacy,sectionOutline(legacy));expect(thoughts({...legacy,format:2,raw}).map(n=>n.id)).toEqual(['root','child','grandchild']);
 });
 it('moves complete multiline subtrees and their empty paragraphs, then undoes the move',()=>{
  let doc=emptyCompanion('Main.md');doc.sections=[section(body)];doc=markThoughts(doc);const [root,,other]=thoughts(doc.sections[0]!);
  const result=applyThought(doc,{kind:'move',id:root!.id,section:'chapter',target:other!.id,placement:'last',expectedSection:'chapter'});
  const nodes=thoughts(result.document.sections[0]!);expect(nodes.map(n=>n.id)).toEqual([other!.id,root!.id,thoughts(doc.sections[0]!)[1]!.id]);expect(nodes[1]!.text).toBe(root!.text);
  expect(sectionOutline(applyThought(result.document,result.inverse!).document.sections[0]!)).toBe(body);
 });
 it('edits a complete body without consuming its actual children',()=>{
  let doc=emptyCompanion('Main.md');doc.sections=[section(body)];doc=markThoughts(doc);const [root,child]=thoughts(doc.sections[0]!);
  const text='\nReplacement\n- list\n\n',result=applyThought(doc,{kind:'edit',id:root!.id,expected:root!.text,text});
  const nodes=thoughts(result.document.sections[0]!);expect(nodes[0]!.text).toBe(text);expect(nodes[1]!.id).toBe(child!.id);expect(nodes[1]!.parent).toBe(root!.id);
 });
 it('rejects orphan indentation and outside headings before any native replacement',()=>{
  for(const input of ['\t- No parent','- Root\n    - ambiguous indentation\n\t\t- skipped depth','# Outside chapter\n- Root'])expect(()=>mergeNativeOutline(section(),input)).toThrow();
 });
});
describe('Lossless boundary to the original Lineage model',()=>{
 it('preserves paragraphs, code markers, tasks and all content whitespace',()=>{
  const model=lineageDocument(body),saved=lineageOutline(model);expect(multilineOutline(saved,false).map(n=>[n.text,n.indent])).toEqual(multilineOutline(body,false).map(n=>[n.text,n.indent]));
 });
 it('preserves long excerpts after a native-model move',()=>{
  const long='\n  '+('Quotation - > **value**\n'.repeat(6000))+'\n',input='- '+long.split('\n').map((line,i)=>i?'  '+line:line).join('\n')+'\n- Target',model=lineageDocument(input),root=model.columns[0]!.groups[0]!,moved=root.nodes.shift()!,target=root.nodes[0]!;
  model.columns.push({id:'child-column',groups:[{parentId:target,nodes:[moved]}]});const saved=lineageOutline(model),parsed=multilineOutline(saved,false);
  expect(parsed).toHaveLength(2);expect(parsed[1]!.text).toBe(long);expect(parsed[1]!.parent).toBe(parsed[0]);
 });
 it('rejects unreachable native groups instead of silently omitting them',()=>{
  const model=lineageDocument('- Root');model.columns.push({id:'broken',groups:[{parentId:'missing',nodes:['orphan']}]});model.content.orphan={content:'Protected text'};expect(()=>lineageOutline(model)).toThrow();
 });
});
