import {describe,it,expect} from 'vitest';
import {EditorState,Text} from '@codemirror/state';
import {CharacterCountCache,type CharacterCountOptions} from '../src/companion/character-count';
const options=(whitespace=true,footnotes=true):CharacterCountOptions=>({whitespace,footnotes});
const count=(text:string,whitespace=true,footnotes=true)=>new CharacterCountCache().get(text,options(whitespace,footnotes)).count(0,text.length);

describe('companion character counting rules',()=>{
 it('preserves the exact Obsidian source-length default, including UTF-16 and whitespace',()=>{
  const text='---\naliases: [Example]\n---\n# Heading 😀\n  Text.\t\n';expect(count(text)).toBe(text.length);expect(count(text,false)).toBe(text.replace(/\s/gu,'').length);
 });
 it.each(['\n','\r\n'])('excludes reference definitions, continuations and inline footnotes (%j)',nl=>{
  const source=['# Heading','Body[^a] and ^[inline *note* with [a link](url)].','', '[^a]: Footnote text.','    Continued.','','    Second paragraph.','','End.'].join(nl),expected=['# Heading','Body and .','', 'End.'].join(nl);
  expect(count(source,true,false)).toBe(expected.length);expect(count(source,false,false)).toBe(expected.replace(/\s/gu,'').length);
 });
 it('matches Obsidian’s lazy footnote paragraphs, quoted definitions and adjacent definitions',()=>{
  const lazy='A[^n]\n\n[^n]: first\ncontinued\n\nBody.';expect(count(lazy,true,false)).toBe('A\n\nBody.'.length);
  const quoted='A[^n]\n\n> [^n]: first\n>     continued\n\nBody.';expect(count(quoted,true,false)).toBe('A\n\nBody.'.length);
  const adjacent='A[^a][^b]\n\n[^a]: First\n[^b]: Second\n';expect(count(adjacent,true,false)).toBe('A\n\n'.length);
  const noBlank='A[^n]\n[^n]: first\n\nBody.';expect(count(noBlank,true,false)).toBe(noBlank.length);
 });
 it('reuses Markdown fragments across edits and agrees with a fresh count after reference, definition and body changes',()=>{
  let state=EditorState.create({doc:('# Heading\n\nBody text.\n\n'.repeat(80))+'A[^a] ^[inline].\n\n[^a]: First\ncontinued\n\nEnd.'});const cache=new CharacterCountCache(),opts=options(false,false);cache.get(state.doc,opts);
  for(const find of ['Body text.','[^a]:','inline','continued']){const at=state.doc.toString().indexOf(find),change=state.update({changes:{from:at,to:at+find.length,insert:find==='[^a]:'?'[^b]:':find+' changed'}});cache.update(state.doc,change.state.doc,change.changes);state=change.state;const live=cache.get(state.doc,opts),fresh=new CharacterCountCache().get(state.doc,opts);expect(live.count(0,state.doc.length)).toBe(fresh.count(0,state.doc.length));}
 });
 it('handles nested links, escaped brackets and closing brackets inside inline code in inline notes',()=>{
  const text='A ^[a [link](target) and `]` plus \\] more] B ^[next] C';expect(count(text,true,false)).toBe('A  B  C'.length);
 });
 it('keeps unresolved or malformed references and incomplete inline notes as literal text',()=>{
  const text='A[^missing] [^] ^[unfinished\n\nAnother paragraph.';expect(count(text,true,false)).toBe(text.length);
 });
 it('does not interpret code, escaped syntax, frontmatter, HTML or math as footnotes',()=>{
  const source=['---','example: "^[literal]"','---','`^[code] [^a]` \\^[escaped]','', '```md','[^a]: literal definition','^[literal]','```','', '    [^a]: indented code','', '<!-- ^[comment] -->','', '$x^{[1]} + ^[math]$','', '$$','^[math block]','$$','', 'Actual^[remove].'].join('\n');expect(count(source,true,false)).toBe(source.replace('^[remove]','').length);
 });
 it('recognizes footnotes inside blockquotes and lists while preserving surrounding prose',()=>{
  const source='> Quote^[note].\n\n- List[^a].\n\n[^a]: Definition\n';expect(count(source,true,false)).toBe('> Quote.\n\n- List.\n\n'.length);
 });
 it('returns consistent interval and total counts at chunk boundaries, even inside a long footnote',()=>{
  const text='x'.repeat(1020)+' ^['+'a '.repeat(2000)+'] '+'z'.repeat(2100),cache=new CharacterCountCache(),counter=cache.get(text,options(false,false)),start=text.indexOf('^['),end=text.indexOf(']')+1;
  for(const from of [0,512,1023,1024,1500,3000,end,end+10])for(const to of [from,Math.max(from,1024),Math.max(from,end+100),text.length]){const expected=Array.from({length:to-from},(_,i)=>i+from).filter(at=>(at<start||at>=end)&&!/\s/u.test(text[at]!)).length;expect(counter.count(from,to)).toBe(expected);}
 });
 it('reuses counts for the same source and options, and updates only when either changes',()=>{
  const cache=new CharacterCountCache(),source=Text.of(['# Heading','Text ^[note] here.']);cache.get(source,options());expect(cache.scans).toBe(0);const first=cache.get(source,options(false,false));expect(cache.get(source,options(false,false))).toBe(first);expect(cache.scans).toBe(1);cache.get(source,options(true,false));expect(cache.scans).toBe(2);const changed=source.replace(0,0,Text.of(['More ']));expect(cache.get(changed,options(false,false)).count(0,changed.length)).toBe(first.count(0,source.length)+4);expect(cache.scans).toBe(3);
 });
});
