import {reindentSubtree,subtreeEnd,indentColumns,childIndent} from '../src/companion/indentation';
import {describe,it,expect} from 'vitest';
import {sourceHeadings,outlineKey} from '../src/companion/headings';
import {emptyCompanion,parseCompanion,serializeCompanion} from '../src/companion/codec';
import {reconcile} from '../src/companion/reconcile';
import {thoughts,markThoughts,validateThoughts,applyThought,restoreThought,locate,type ThoughtOperation} from '../src/companion/thoughts';
import {minimalChange,validPath} from '../src/companion/repository';
import type {CompanionDocument} from '../src/companion/model';
const source='# Einleitung\n\nErster Text.\n\n## Begriffe\n\nZweiter Text.\n\n# Schluss\n\nDritter Text.\n';
function document():CompanionDocument{return reconcile(emptyCompanion('Texte/Arbeit.md'),source).document;}
function add(doc:CompanionDocument,section=doc.sections[0]!.id,text='Gedanke',target?:string,placement:'first'|'last'|'before'|'after'='last'){return applyThought(doc,{kind:'add',section,text,target,placement});}
describe('Companion source outlines',()=>{
 it('recognizes ATX and Setext hierarchy while ignoring fenced examples, YAML, comments, quotes, lists and indented code',()=>{
  const text='---\ntitle: Test\n---\n# A\n\n> # Quote\n\n- # List\n\n    # Code\n\n```md\n# Fenced\n```\n\n<!--\n# Comment\n-->\n\nB\n---\n\n### C\nText\n';const headings=sourceHeadings(text);expect(headings.map(h=>[h.title,h.level,h.parent])).toEqual([['A',1,-1],['B',2,0],['C',3,1]]);expect(headings.every(h=>text.slice(h.from).startsWith(h.title==='B'?'B':'#'))).toBe(true);
 });
 it('distinguishes structure from ordinary text edits and supports empty headings and CRLF',()=>{
  expect(outlineKey(sourceHeadings(source))).toBe(outlineKey(sourceHeadings(source.replace('Erster Text.','Viel längerer neuer Absatz.'))));const headings=sourceHeadings('#\r\n\r\n## B ###\r\nBody\r\n');expect(headings.map(h=>[h.title,h.level,h.line])).toEqual([['',1,0],['B',2,2]]);
 });
});
describe('Companion Markdown identity and preservation',()=>{
 it('stores its source link only in companion YAML and round trips marked thoughts and unrelated YAML',()=>{
  let doc=add(document()).document;doc.header='custom: "untouched"\n# keep this comment\n';const text=serializeCompanion(doc),parsed=parseCompanion(text);expect(parsed.source).toBe('Texte/Arbeit.md');expect(parsed.sections.map(s=>s.id)).toEqual(doc.sections.map(s=>s.id));expect(thoughts(parsed.sections[0]!)[0]?.text).toBe('Gedanke');const next=serializeCompanion(parsed);expect(next).toContain('custom: "untouched"');expect(next).toContain('# keep this comment');expect(next).toBe(text);expect(source).not.toContain('em-section');
 });
 it('preserves blank lines, CRLF and arbitrary non-list content without duplicating source headings',()=>{
  const doc=document();doc.newline='\r\n';doc.sections[0]!.raw='\r\n- A <!-- em-note:n-1 -->\r\n\r\n';const parsed=parseCompanion(serializeCompanion(doc));expect(parsed.sections[0]!.raw).toBe(doc.sections[0]!.raw);expect(serializeCompanion(parsed).replace(/\r\n/gu,'')).not.toContain('\n');
 });
 it('rejects missing or duplicated section identities rather than adopting notes into another section',()=>{
  const text=serializeCompanion(add(document()).document);expect(()=>parseCompanion(text.replace(/<!-- em-section:[^>]+ -->/u,''))).toThrow();const id=document().sections[0]!.id;expect(()=>parseCompanion(text.replace(/em-section:[^ ]+/gu,'em-section:'+id))).toThrow();expect(()=>parseCompanion(text+'\n## Unmanaged\n')).toThrow();
 });
 it('assigns IDs to manually added list lines but refuses duplicated note IDs',()=>{
  const doc=document();doc.sections[0]!.raw='- Original\n\t- Kind\n';const marked=markThoughts(doc);expect(thoughts(marked.sections[0]!)).toHaveLength(2);expect(thoughts(marked.sections[0]!)[1]?.parent).toBe(thoughts(marked.sections[0]!)[0]?.id);expect(markThoughts(marked)).toEqual(marked);marked.sections[1]!.raw=marked.sections[0]!.raw;expect(()=>validateThoughts(marked)).toThrow();
 });
});
describe('One-way outline reconciliation',()=>{
 it('renames and reorders sections with their complete thought trees and never edits the source',()=>{
  const original=source;let doc=add(document()).document;const first=doc.sections[0]!.id;doc=add(doc,first,'Untergedanke',thoughts(doc.sections[0]!)[0]!.id).document;
  const changed='# Schluss\n\nDritter Text.\n\n# Neue Einleitung\n\nErster Text.\n\n## Begriffe\n\nZweiter Text.\n';const result=reconcile(doc,changed);expect(result.document.sections.map(s=>s.title)).toEqual(['Schluss','Neue Einleitung','Begriffe']);expect(result.document.sections[1]!.id).toBe(first);expect(thoughts(result.document.sections[1]!)).toHaveLength(2);expect(source).toBe(original);
 });
 it('does not write for ordinary paragraphs or changes to heading offsets',()=>{const doc=document(),result=reconcile(doc,source.replace('Erster Text.','Ein wesentlich längerer Absatz.'));expect(result.changed).toBe(false);});
 it('retains missing sections with their notes for manual assignment and restores them when their source returns',()=>{
  const doc=add(document()).document,original=doc.sections[0]!.id;const missing=reconcile(doc,'# Schluss\n\nDritter Text.\n').document;const section=missing.sections.find(s=>s.id===original)!;expect(section.state).toBe('review');expect(thoughts(section)[0]?.text).toBe('Gedanke');const restored=reconcile(missing,source).document;expect(restored.sections.find(s=>s.id===original)?.state).toBe('linked');
 });
 it('refuses to guess between duplicate titles and identical bodies',()=>{
  let doc=reconcile(emptyCompanion('Text.md'),'# Gleich\n\nText\n\n# Gleich\n\nText\n').document;doc=add(doc).document;const result=reconcile(doc,'# Neu A\n\nText\n\n# Neu B\n\nText\n');expect(result.review).toBe(2);expect(result.document.sections.filter(s=>s.state==='review').flatMap(s=>thoughts(s))).toHaveLength(1);
 });
 it('uses actual editor-tracked positions for a live rename with simultaneous body edits',()=>{
  const doc=add(document()).document,first=doc.sections[0]!;const result=reconcile(doc,source.replace('Einleitung','Neu').replace('Erster Text.','Komplett anders.'),new Map([[first.id,0]]));expect(result.document.sections[0]?.id).toBe(first.id);expect(result.document.sections[0]?.title).toBe('Neu');
 });
 it('does not mistake a completely replaced section for a rename merely because its line is the same',()=>{
  const doc=add(document()).document,result=reconcile(doc,source.replace('Einleitung','Ganz anderer Abschnitt').replace('Erster Text.','Völlig neuer Inhalt.'));expect(result.document.sections.find(s=>s.id===doc.sections[0]!.id)?.state).toBe('review');
 });
});
describe('Companion thought operations and semantic undo',()=>{
 it('edits only a target thought while preserving an external edit to another thought',()=>{
  let doc=add(document(),undefined,'A').document;doc=add(doc,undefined,'B').document;const [a,b]=thoughts(doc.sections[0]!) as [ReturnType<typeof thoughts>[number],ReturnType<typeof thoughts>[number]];
  const operation:ThoughtOperation={kind:'edit',id:a.id,expected:'A',text:'A changed'},external=applyThought(doc,{kind:'edit',id:b.id,expected:'B',text:'External B'}).document,result=applyThought(external,operation);expect(thoughts(result.document.sections[0]!).map(n=>n.text)).toEqual(['A changed','External B']);const undone=applyThought(result.document,result.inverse!).document;expect(thoughts(undone.sections[0]!).map(n=>n.text)).toEqual(['A','External B']);
 });
 it('preserves a local draft by refusing edits and subtree deletion when their own content changed',()=>{
  const doc=add(document()).document,node=thoughts(doc.sections[0]!)[0]!,changed=applyThought(doc,{kind:'edit',id:node.id,expected:node.text,text:'External'}).document;expect(()=>applyThought(changed,{kind:'edit',id:node.id,expected:'Gedanke',text:'Local'})).toThrow();expect(()=>applyThought(changed,{kind:'remove',id:node.id,expected:doc.sections[0]!.raw.slice(node.from,node.to)})).toThrow();
 });
 it('moves a complete subtree across sections and undoes it without replacing unrelated text',()=>{
  let doc=add(document(),undefined,'Parent').document;const parent=thoughts(doc.sections[0]!)[0]!;doc=add(doc,parent.section,'Child',parent.id).document;const section=doc.sections[1]!.id,result=applyThought(doc,{kind:'move',id:parent.id,section,placement:'last',expectedSection:parent.section});expect(thoughts(result.document.sections[1]!).map(n=>n.text)).toEqual(['Parent','Child']);const undo=applyThought(result.document,result.inverse!);expect(thoughts(undo.document.sections[0]!).map(n=>n.text)).toEqual(['Parent','Child']);
 });
 it('prevents cycles and stale targets, including a target removed while dragging',()=>{
  let doc=add(document()).document;const parent=thoughts(doc.sections[0]!)[0]!;doc=add(doc,parent.section,'Child',parent.id).document;const child=thoughts(doc.sections[0]!)[1]!;expect(()=>applyThought(doc,{kind:'move',id:parent.id,section:parent.section,target:child.id,placement:'last',expectedSection:parent.section})).toThrow();expect(()=>applyThought(doc,{kind:'move',id:child.id,section:parent.section,target:'missing',placement:'after',expectedSection:child.section,expectedParent:parent.id})).toThrow();
 });
 it('removes and restores a subtree with its original IDs and contents',()=>{
  let doc=add(document()).document;const node=thoughts(doc.sections[0]!)[0]!;doc=add(doc,node.section,'Child',node.id).document;const current=locate(doc,node.id),result=applyThought(doc,{kind:'remove',id:node.id,expected:current.section.raw.slice(current.node.from,current.node.to)});expect(thoughts(result.document.sections[0]!)).toHaveLength(0);const undo=restoreThought(result.document,result.restore!);expect(thoughts(undo.document.sections[0]!).map(n=>n.id)).toEqual(thoughts(doc.sections[0]!).map(n=>n.id));
 });
 it('keeps add undo correct when inserting before blank lines',()=>{const doc=document();doc.sections[0]!.raw='\n\n';const result=add(doc,undefined,'A',undefined,'first'),undo=applyThought(result.document,result.inverse!);expect(thoughts(undo.document.sections[0]!)).toHaveLength(0);});
 it('supports arbitrarily long single-line thoughts and preserves Markdown while refusing hard breaks',()=>{
  const text='**Gedanke** [[Quelle]] '+ 'lang '.repeat(15000),doc=add(document(),undefined,text).document;expect(thoughts(doc.sections[0]!)[0]?.text).toBe(text);expect(()=>add(doc,undefined,'A\nB')).toThrow();
 });
});
describe('Companion write boundary',()=>{
 it('computes minimal source patches and rejects outside-vault paths',()=>{const before='AA\r\nOld\r\nZZ',after='AA\r\nNew\r\nZZ',patch=minimalChange(before,after);expect(before.slice(0,patch.from)+patch.insert+before.slice(patch.to)).toBe(after);expect(patch.insert).toBe('New');for(const path of ['/tmp/Paper.md','../Paper.md','.private/x.md','http:foo.md','A/../Paper.md'])expect(validPath(path)).toBe(false);expect(validPath('Texte/Arbeit.md')).toBe(true);});
});

describe('EOME subtree rules adapted for companion IDs',()=>{
 it('preserves relative indentation with mixed tabs and spaces and keeps metadata intact',()=>{
  const raw='    - Parent <!-- em-note:a -->\r\n\t    - Child <!-- em-note:b -->\r\n';const moved=reindentSubtree(raw,'    ','\t\t');expect(moved).toBe('\t\t- Parent <!-- em-note:a -->\r\n\t\t    - Child <!-- em-note:b -->\r\n');expect(subtreeEnd(raw,0,'    ')).toBe(raw.length);
 });
 it('never takes an unrelated following paragraph along with a thought',()=>{
  const doc=document();doc.sections[0]!.raw='- Parent <!-- em-note:a -->\n\t- Child <!-- em-note:b -->\n\nUnrelated paragraph\n';const next=applyThought(doc,{kind:'move',id:'a',section:doc.sections[1]!.id,placement:'last',expectedSection:doc.sections[0]!.id}).document;expect(next.sections[0]!.raw).toContain('Unrelated paragraph');expect(next.sections[1]!.raw).not.toContain('Unrelated paragraph');expect(thoughts(next.sections[1]!).map(n=>n.id)).toEqual(['a','b']);
 });
});

describe('Mixed Markdown tab stops',()=>{
 it('keeps visual indentation depth when spaces precede a tab',()=>{expect(indentColumns('  \t')).toBe(4);expect(reindentSubtree('  - A\n  \t- B\n','  ','')).toBe('- A\n  - B\n');expect(indentColumns(childIndent('   '))-3).toBe(4);});
});

describe('Opaque Markdown preservation',()=>{
 it('does not turn code examples or comments into identified thoughts',()=>{const doc=document();doc.sections[0]!.raw='```md\n- Example\n```\n<!--\n- Comment\n-->\n- Actual thought\n';const marked=markThoughts(doc);expect(marked.sections[0]!.raw).toContain('- Example\n');expect(marked.sections[0]!.raw).toContain('- Comment\n');expect(thoughts(marked.sections[0]!).map(n=>n.text)).toEqual(['Actual thought']);});
});
