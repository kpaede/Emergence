import {describe,it,expect,vi} from 'vitest';
import {adaptLineage,lineageDocument,type LineageDocument} from '../src/companion/lineage-adapter';
import {encodeOutlineText} from '../src/companion/multiline';
import {splitProjection} from '../src/companion/native-projection';
import type {NativeStore,NativeView} from '../src/companion/native-types';

function fixture(body=''){
 let stored='---\neome-outline-format: 2\nview-option: original\n---\n'+body;
 const state={file:{frontmatter:''},document:lineageDocument('- ')},original:NativeStore={getValue:()=>state,set:value=>{Object.assign(state,value);},subscribe:()=>()=>{},dispatch(action){if(action.type==='document/file/load-from-disk')state.document=(action.payload as {__test_document__:LineageDocument}).__test_document__;},constructor:Object};
 const save=vi.fn(async()=>{stored=view.data;}),report=vi.fn(),view={data:'',documentStore:original,save} as unknown as NativeView,session=adaptLineage(view,()=>stored,report);
 view.documentStore!.dispatch({type:'document/file/load-from-disk',payload:{}});
 return {state,view,save,report,session,read:()=>stored,replace:(text:string)=>{stored=text;},first:()=>Object.keys(state.document.content)[0]!};
}
describe('Lineage empty-section placeholder boundary',()=>{
 it.each(['','\n\n','\r\n \r\n\t\r\n'])('does not store its untouched start node for body %j',async body=>{
  const f=fixture(body),before=f.read();expect(Object.keys(f.state.document.content)).toHaveLength(1);await f.session.save();await f.session.save();expect(f.read()).toBe(before);expect(splitProjection(f.read()).body).toBe(body);expect(f.report).not.toHaveBeenCalled();
 });
 it('saves changed header options while preserving an untouched empty body',async()=>{
  const f=fixture('\n');f.replace(f.read().replace('view-option: original','view-option: updated'));await f.session.save();expect(f.read()).toContain('view-option: updated');expect(splitProjection(f.read()).body).toBe('\n');expect(f.save).toHaveBeenCalledOnce();
 });
 it('keeps whitespace and complete Markdown when the placeholder is actually edited',async()=>{
  const f=fixture(),text='\n  Leading whitespace\n\n- Internal list\n\nTrailing spaces  \n';f.state.document.content[f.first()]!.content=text;await f.session.save();const reloaded=lineageDocument(splitProjection(f.read()).body);expect(Object.values(reloaded.content)[0]!.content).toBe(text);expect(f.report).not.toHaveBeenCalled();
 });
 it('keeps deliberately added blank entries rather than treating the changed tree as untouched',async()=>{
  const f=fixture();f.state.document.content.added={content:''};f.state.document.columns[0]!.groups[0]!.nodes.push('added');await f.session.save();expect(Object.keys(lineageDocument(splitProjection(f.read()).body).content)).toHaveLength(2);
 });
 it('does not restore old text when a real saved entry is later cleared',async()=>{
  const f=fixture(),id=f.first();f.state.document.content[id]!.content='A real entry';await f.session.save();f.state.document.content[id]!.content='';await f.session.save();expect(splitProjection(f.read()).body).toBe('- ');
 });
 it('preserves an intentionally stored blank entry when loading an existing outline',async()=>{
  const f=fixture(encodeOutlineText('')+'\n');await f.session.save();expect(splitProjection(f.read()).body).toBe('- ');
 });
 it('retains the placeholder distinction when a save is rejected',async()=>{
  const f=fixture(),id=f.first(),before=f.read();f.save.mockRejectedValueOnce(Error('cannot save'));f.state.document.content[id]!.content='Rejected';await f.session.save();expect(f.read()).toBe(before);f.state.document.content[id]!.content='';await f.session.save();expect(f.read()).toBe(before);expect(f.report).toHaveBeenCalledOnce();
 });
});
