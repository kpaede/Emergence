// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {EditorView} from '@codemirror/view';
import {installDomHelpers} from './helpers/dom';
import {TetradEditGeometry} from '../src/tetrad/edit-geometry';
import {solveFlowHeight} from '../src/tetrad/render/flow-metrics';
const measured=vi.hoisted(()=>vi.fn());
vi.mock('../src/tetrad/edit-measure',()=>({measureEdit:measured}));
let frames:Map<number,FrameRequestCallback>;const geometries:TetradEditGeometry[]=[];
beforeEach(()=>{
 installDomHelpers();document.body.replaceChildren();frames=new Map();let id=0;
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frames.set(++id,callback);return id;});vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
 measured.mockReset().mockReturnValue({height:72,projection:0,content:0,offset:0,inset:0,single:true});
});
afterEach(()=>{for(const geometry of geometries.splice(0))geometry.destroy();vi.unstubAllGlobals();});
function fixture(visible=true){const target=document.body.createDiv();vi.spyOn(target,'getBoundingClientRect').mockReturnValue({width:visible?200:0,height:18} as DOMRect);target.createEl('p',{text:'Original'});const content=document.body.createDiv(),dispatch=vi.fn(),view={dom:content,contentDOM:content,dispatch} as unknown as EditorView,geometry=new TetradEditGeometry(target,'Original');geometries.push(geometry);geometry.attach(view);return {target,geometry,view,dispatch};}
describe('Tetrad native layout lifecycle',()=>{
 it('coalesces rapid keystrokes into one current-content solve and applies the result in one frame',()=>{
  const f=fixture();for(let n=0;n<20;n++)f.geometry.changed(f.view);expect(frames.size).toBe(1);expect(measured).not.toHaveBeenCalled();const [id,frame]=[...frames][0]!;frames.delete(id);frame(0);expect(measured).toHaveBeenCalledOnce();expect(f.dispatch).toHaveBeenCalledOnce();expect(f.target.style.height).toBe('72px');expect(f.geometry.pending).toBe(false);f.geometry.destroy();expect(f.target.style.height).toBe('');
 });
 it('does not run a queued solve after the input closes',()=>{const f=fixture();f.geometry.changed(f.view);expect(frames.size).toBe(1);f.geometry.destroy();expect(frames.size).toBe(0);expect(measured).not.toHaveBeenCalled();expect(f.dispatch).not.toHaveBeenCalled();});
 it('does not derive a new layout from zero width when the tab is hidden',()=>{const f=fixture(false);f.geometry.changed(f.view);const [id,frame]=[...frames][0]!;frames.delete(id);frame(0);expect(measured).not.toHaveBeenCalled();expect(f.dispatch).not.toHaveBeenCalled();expect(f.geometry.pending).toBe(false);});
 it('cannot oscillate between wrap heights when a larger projection needs fewer lines',()=>{
  const heights:number[]=[],result=solveFlowHeight(18,height=>{heights.push(height);return height<72?72:54;});expect(result).toEqual({height:72,content:54});expect(heights).toEqual([18,72]);
 });
});
