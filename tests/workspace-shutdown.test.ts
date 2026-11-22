import {beforeEach,describe,it,expect,vi} from 'vitest';
import {EmergenceView} from '../src/ui/view';
const notices=vi.hoisted(()=>[] as string[]);
vi.mock('obsidian',async importOriginal=>({...await importOriginal<Record<string,unknown>>(),ItemView:class{},Notice:class{constructor(text:string){notices.push(text);}}}));
vi.mock('../src/companion/panel',()=>({CompanionPanel:class{}}));
vi.mock('../src/tetrad/panel',()=>({TetradPanel:class{}}));
vi.mock('../src/ui/graph-panel',()=>({GraphPanel:class{}}));
vi.mock('../src/ui/search-panel',()=>({SearchPanel:class{}}));
vi.mock('../src/ui/panels/analysis',()=>({renderAnalysis:()=>{}}));
vi.mock('../src/argdown/panel',()=>({ArgdownPanel:class{}}));
vi.mock('../src/mermaid/panel',()=>({MermaidPanel:class{}}));
beforeEach(()=>{notices.splice(0);});
function fixture(){
 const events:string[]=[],step=(name:string)=>vi.fn(()=>{events.push(name);}),panel=(name:string)=>({run:async(action:()=>unknown)=>{await action();},flush:step(name)});
 const state={unsubscribe:step('unsubscribe'),updateFrame:42,updatePending:true,forcePending:true,mermaidPanel:panel('mermaid'),argdownPanel:panel('argdown'),tetradPanel:panel('tetrad'),companionPanel:{shutdown:step('companion')},searchPanel:{destroy:step('search')},graphPanel:{destroy:step('graph')},controller:{writer:{invalidate:step('invalidate')}},contentEl:{ownerDocument:{defaultView:{cancelAnimationFrame:step('cancelFrame')}},empty:step('empty')}};
 const close=()=>EmergenceView.prototype.onClose.call(state as unknown as EmergenceView);return {state,events,close};
}
describe('workspace closing after errors',()=>{
 it('unsubscribes and cancels pending rendering before saving and releasing the panels',async()=>{
  const f=fixture();await f.close();expect(f.events).toEqual(['unsubscribe','cancelFrame','mermaid','argdown','tetrad','companion','search','graph','invalidate','empty']);expect(notices).toEqual([]);expect(f.state.updateFrame).toBeUndefined();expect(f.state.updatePending).toBe(false);
 });
 it('releases search and graph and invalidates write previews after companion shutdown fails',async()=>{
  const f=fixture();f.state.companionPanel.shutdown.mockImplementation(()=>{throw Error('draft saved; original editor failed');});await expect(f.close()).resolves.toBeUndefined();expect(f.state.searchPanel.destroy).toHaveBeenCalledOnce();expect(f.state.graphPanel.destroy).toHaveBeenCalledOnce();expect(f.state.controller.writer.invalidate).toHaveBeenCalledOnce();expect(f.state.contentEl.empty).toHaveBeenCalledOnce();expect(notices[0]).toContain('wiederherstellbaren Entwürfe');
 });
 it('attempts every remaining editor and cleanup after multiple independent errors',async()=>{
  const f=fixture();f.state.mermaidPanel.flush.mockImplementation(()=>{throw Error('diagram failed');});f.state.graphPanel.destroy.mockImplementation(()=>{throw Error('graph failed');});await f.close();expect(f.state.argdownPanel.flush).toHaveBeenCalledOnce();expect(f.state.tetradPanel.flush).toHaveBeenCalledOnce();expect(f.state.companionPanel.shutdown).toHaveBeenCalledOnce();expect(f.state.controller.writer.invalidate).toHaveBeenCalledOnce();expect(f.state.contentEl.empty).toHaveBeenCalledOnce();expect(notices).toHaveLength(1);expect(notices[0]).toContain('diagram failed');expect(notices[0]).toContain('graph failed');
 });
});
