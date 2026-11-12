import {describe,expect,it} from 'vitest';
import {ArgdownEngine} from '../src/argdown/engine';
import {readNodeDraft,editNodeDraft} from '../src/argdown/node-edit';
import {argdownLabelSource} from '../src/argdown/label-source';
const engine=new ArgdownEngine();
describe('Argdown combined title and text editing',()=>{
 it('changes canonical text and all references together while preserving data and relations',()=>{
  const source='[A]: Earlier wording\n\n[A]: **Current wording** {color: "#ff0000", custom: 42}\n  +> <B>: Description\n\n[A]\n\nMention @[A].',model=engine.parse(source);
  expect(readNodeDraft(model,'s:A')).toEqual({title:'A',text:'**Current wording**'});
  const changed=editNodeDraft(engine,model,'s:A',{title:'Renamed',text:'New *wording*'}),next=engine.parse(changed.source);
  expect(changed.key).toBe('s:Renamed');expect(changed.source).toContain('[Renamed]: Earlier wording');expect(changed.source).toContain('[Renamed]: New *wording* {color: "#ff0000", custom: 42}');expect(changed.source).toContain('Mention @[Renamed]');expect(next.edges).toHaveLength(model.edges.length);expect(changed.source).toContain('+> <B>: Description');
 });
 it('renames an argument including its reconstruction without touching statement titles of the same name',()=>{
  const source='<A>: Description\n  +> [A]: Statement\n\n<A>\n\n(1) [P]: Premise\n----\n(2) [C]: Conclusion\n\n<B>: Mention @<A>.\n  +> <A>',model=engine.parse(source),changed=editNodeDraft(engine,model,'a:A',{title:'Reason',text:'New description'}),next=engine.parse(changed.source);
  expect(changed.source).toContain('<Reason>: New description');expect(changed.source).toContain('@<Reason>');expect(next.response.arguments?.Reason?.pcs).toHaveLength(2);expect(next.response.statements?.A).toBeDefined();
 });
 it('names and edits an anonymous reconstruction premise without losing numbering or metadata',()=>{
  const model=engine.parse('<A>\n\n(1) Anonymous premise {custom: 7}\n----\n(2) Conclusion'),title=model.response.arguments!.A!.pcs[0]!.title;
  expect(readNodeDraft(model,'s:'+title)).toEqual({title:'',text:'Anonymous premise'});
  const changed=editNodeDraft(engine,model,'s:'+title,{title:'Premise',text:'New premise'});expect(changed.source).toContain('(1) [Premise]: New premise {custom: 7}');expect(engine.parse(changed.source).response.arguments!.A!.pcs[0]!.title).toBe('Premise');
 });
 it('edits an untitled statement without exposing its generated title',()=>{const model=engine.parse('===\nselection:\n  statementSelectionMode: all\n===\n\nAnonymous text'),title=Object.keys(model.response.statements!)[0]!;const changed=editNodeDraft(engine,model,'s:'+title,{title:'',text:'Changed'});expect(changed.source).toContain('\n\nChanged');expect(changed.source).not.toContain('[');});
 it('edits shared statements even when their map node is hidden',()=>{const model=engine.parse('<A>\n\n(1) [P]: Premise\n----\n(2) [C]: Conclusion\n\n<B>\n\n(1) [P]\n----\n(2) Other');const changed=editNodeDraft(engine,model,'s:P',{title:'Shared',text:'Revised'});expect(changed.source).toContain('(1) [Shared]: Revised');expect(changed.source).toContain('(1) [Shared]\n');});
 it('creates content for a title-only reference and allows title-only elements without a dangling colon',()=>{const model=engine.parse('[A]');expect(editNodeDraft(engine,model,'s:A',{title:'B',text:'Caption'}).source).toBe('[B]: Caption');const filled=engine.parse('[A]: Caption');expect(editNodeDraft(engine,filled,'s:A',{title:'A',text:''}).source).toBe('[A]');});
 it('rejects hidden structural changes in a text field even when no extra elements are created',()=>{const model=engine.parse('[A]: Caption\n\n[B]: Other');expect(()=>editNodeDraft(engine,model,'s:A',{title:'A',text:'Changed\n  -> [B]'})).toThrow('Beziehungen');expect(()=>editNodeDraft(engine,model,'s:A',{title:'A',text:'Changed\n\n# New section'})).toThrow('Abschnitte');});
 it('keeps a no-op byte-identical, rejects collisions and unintended extra blocks',()=>{const model=engine.parse('[A]: Text\n\n[B]: Other');expect(editNodeDraft(engine,model,'s:A',readNodeDraft(model,'s:A')).source).toBe(model.source);expect(()=>editNodeDraft(engine,model,'s:A',{title:'B',text:'Text'})).toThrow('bereits');expect(()=>editNodeDraft(engine,model,'s:A',{title:'A',text:'First\n\nSecond'})).toThrow();expect(()=>editNodeDraft(engine,model,'s:A',{title:'Bad]',text:'Text'})).toThrow();});
});
describe('Native Argdown Markdown serialization for Obsidian links',()=>{
 const context={vault:'My Vault',sourcePath:'Current.md',resolve:(path:string)=>path==='Note'? 'Folder/Note.md':undefined};
 it('converts wiki aliases and heading/block targets to native parseable Markdown links',()=>{
  const text=argdownLabelSource('**Text** [[Note#Heading|Alias]] [[#^block]]',context);expect(text).toContain('[Alias](obsidian://open?vault=My%20Vault&file=Folder%2FNote.md%23Heading)');expect(text).toContain('[#^block](obsidian://open?vault=My%20Vault&file=Current.md%23%5Eblock)');
  for(const source of ['[A]: '+text,'<A>: '+text,'<A>\n\n(1) '+text+'\n----\n(2) Conclusion'])expect(()=>engine.parse(source)).not.toThrow();
 });
 it('encodes parentheses and unicode while preserving standard Markdown and escaped wiki syntax',()=>{const text=argdownLabelSource('[Web](https://example.org) [[Ü (test)|Link]] \\[[Literal]]',context);expect(text).toContain('%C3%9C%20%28test%29');expect(text).toContain('[Web](https://example.org)');expect(text).toContain('\\[[Literal]]');expect(()=>engine.parse('[A]: '+text.split(' \\[[')[0])).not.toThrow();});
 it('allows shared named reconstruction statements to receive wiki text through the same edit operation',()=>{const model=engine.parse('<A>\n\n(1) [P]: Premise\n----\n(2) Conclusion'),text=argdownLabelSource('See [[Note]]',context),changed=editNodeDraft(engine,model,'s:P',{title:'Linked',text});expect(engine.parse(changed.source).response.statements?.Linked?.members[0]?.text).toBe('See Note');});
});
