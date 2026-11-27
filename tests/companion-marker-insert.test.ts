import {describe,it,expect,vi} from 'vitest';
import {EditorState} from '@codemirror/state';
import {parser} from '@lezer/markdown';
import {MarkdownView,type App} from 'obsidian';
import {markerInsertion,insertPositionMarker} from '../src/companion/outline-marker-insert';
vi.mock('@codemirror/language',()=>({ensureSyntaxTree:(state:EditorState)=>parser.parse(state.doc.toString())}));
function fixture(text:string,line:number,ch:number){
 const state=EditorState.create({doc:text}),editor={cm:{state},getValue:()=>text,getCursor:()=>({line,ch}),getLine:(line:number)=>state.doc.line(line+1).text,lastLine:()=>state.doc.lines-1,posToOffset:(pos:{line:number;ch:number})=>state.doc.line(pos.line+1).from+pos.ch,transaction:vi.fn(),focus:vi.fn()},view=Object.assign(Object.create(MarkdownView.prototype) as MarkdownView,{file:{path:'Main.md'},getMode:()=>'source',editor});
 const app={workspace:{getLeavesOfType:()=>[{view}],activeEditor:view}} as unknown as App;return {app,editor};
}
describe('explicit position marker insertion',()=>{
 it.each([
  ['Text',0,2,'\n###### Work here\n',{line:2,ch:0}],
  ['Text\nNext',0,4,'\n###### Work here',{line:2,ch:0}],
  ['Text\n\nNext',1,0,'###### Work here',{line:2,ch:0}],
  ['',0,0,'###### Work here\n',{line:1,ch:0}],
 ] as const)('inserts at the caret without replacing existing content: %s', (text,line,ch,insert,cursor)=>{const f=fixture(text,line,ch),plan=markerInsertion(f.editor,'Work here',6);expect(plan.text).toBe(insert);expect(plan.cursor).toEqual(cursor);insertPositionMarker(f.app,'Main.md','Work here',6);expect(f.editor.transaction).toHaveBeenCalledOnce();expect(f.editor.transaction).toHaveBeenCalledWith({changes:[{from:{line,ch},to:{line,ch},text:insert}],selection:{from:cursor}},'emergence-position-marker');expect(f.editor.focus).toHaveBeenCalledOnce();});
 it.each([['```md\nText\n```',1],['---\ntitle: Text\n---\nBody',1],['<!--\nText\n-->',1]] as const)('rejects insertion where Markdown would hide the marker: %s',(text,line)=>{const f=fixture(text,line,0);expect(()=>insertPositionMarker(f.app,'Main.md','Work here',6)).toThrow();expect(f.editor.transaction).not.toHaveBeenCalled();});
 it('allows ordinary text after frontmatter but requires the matching source editor',()=>{const f=fixture('---\ntitle: Text\n---\nBody',3,0);insertPositionMarker(f.app,'Main.md','Work here',4);expect(f.editor.transaction).toHaveBeenCalledOnce();expect(()=>insertPositionMarker(f.app,'Other.md','Work here',4)).toThrow();expect(f.editor.transaction).toHaveBeenCalledOnce();});
 it('rejects malformed marker names without a mutation',()=>{const f=fixture('Body',0,0);for(const title of ['', 'Bad\nname'])expect(()=>insertPositionMarker(f.app,'Main.md',title,6)).toThrow();expect(f.editor.transaction).not.toHaveBeenCalled();});
});
