import {describe,it,expect} from 'vitest';
import {mergeNativeOutline,projectionText,withoutThoughtIds,nativeBodiesEqual,splitProjection,validateNativeProjection} from '../src/companion/native-projection';
import {thoughts} from '../src/companion/thoughts';
import type {CompanionSection} from '../src/companion/model';
const section=():CompanionSection=>({id:'section',title:'Chapter',level:1,state:'linked',raw:'\n- Root <!-- em-note:root -->\n\t- Child <!-- em-note:child -->\n\t\t- Deep <!-- em-note:deep -->\n- Other <!-- em-note:other -->\n'});
describe('Original-plugin outline projection',()=>{
 it('accepts native version 2 and ordinary view options without requiring a header',()=>{
  for(const header of ['', 'zoom: 0.8', 'eome-outline-format: 2', '"eome-outline-format": "2"'])expect(()=>validateNativeProjection(header?'---\n'+header+'\n---\n- Root':'- Root')).not.toThrow();
 });
 it('rejects an unsupported native format even when its thought body is unchanged',()=>{
  const before=section(),text='---\neome-outline-format: 3\n---\n'+withoutThoughtIds(before.raw);expect(nativeBodiesEqual(before.raw,text)).toBe(true);expect(()=>validateNativeProjection(text)).toThrow('Gedankenformat');expect(()=>mergeNativeOutline(before,text)).toThrow('Gedankenformat');
 });
 it('rejects invalid or duplicate native format metadata before merging thoughts',()=>{
  for(const header of ['eome-outline-format: 2\neome-outline-format: 3','options: [','eome-outline-format: null'])expect(()=>mergeNativeOutline(section(),'---\n'+header+'\n---\n- Root')).toThrow('Metadaten');
 });
 it('exposes only the selected thought tree, with no companion identities',()=>{const text=projectionText(section().raw,'excerpt-outline-mindmap: nodeWidth:300\n');expect(text).not.toContain('em-note:');expect(splitProjection(text).body).toBe('- Root\n\t- Child\n\t\t- Deep\n- Other\n');});
 it('keeps identities while native plugins move and reindent complete branches',()=>{const before=section(),raw=mergeNativeOutline(before,'- Other\n\t- Root\n\t\t- Child\n\t\t\t- Deep\n'),nodes=thoughts({...before,raw});expect(nodes.map(n=>[n.id,n.parent])).toEqual([['other',undefined],['root','other'],['child','root'],['deep','child']]);});
 it('keeps an edited thought identity while indexing genuinely new thoughts',()=>{const before=section(),raw=mergeNativeOutline(before,'- Renamed Root\n\t- Child\n\t\t- Deep\n- Other\n'),nodes=thoughts({...before,raw});expect(nodes[0]!.id).toBe('root');expect(nodes[0]!.text).toBe('Renamed Root');const added=thoughts({...before,raw:mergeNativeOutline(before,withoutThoughtIds(before.raw)+'\t- Added\n')});expect(added[4]!.id).not.toBe('other');expect(added[4]!.parent).toBe('other');});
 it('does not treat a plugin layout header or line-ending normalization as a thought edit',()=>{expect(nativeBodiesEqual(section().raw,'---\nzoom: 0.8\n---\n'+withoutThoughtIds(section().raw).replace(/\n/gu,'\r\n').trim())).toBe(true);});
 it('protects unrepresented content and refuses truncated history or main-document headings',()=>{const before=section();for(const text of ['# New chapter\n- Root','- Root...[truncated]','<!-- section:1 -->\nRoot','<div>Root</div>'])expect(()=>mergeNativeOutline(before,text)).toThrow();expect(()=>mergeNativeOutline({...before,raw:'Protected paragraph\n'+before.raw},withoutThoughtIds(before.raw))).toThrow();});
 it('round-trips large outlines without truncating thought content',()=>{const text='Long thought '.repeat(6000),before={...section(),raw:'- '+text+' <!-- em-note:large -->\n'};const raw=mergeNativeOutline(before,'- '+text+' changed\n');expect(thoughts({...before,raw})[0]!.id).toBe('large');expect(raw).toContain(text+' changed');});
});
