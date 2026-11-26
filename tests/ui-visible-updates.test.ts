// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {EmergenceView} from '../src/ui/view';
import {GraphPanel} from '../src/ui/graph-panel';
import {SearchPanel} from '../src/ui/search-panel';
import {defaults} from '../src/config';
import {installDomHelpers} from './helpers/dom';
vi.mock('obsidian',async original=>{const {TestComponent,TestModal}=await import('./helpers/reader-host');return {...await original<Record<string,unknown>>(),Component:TestComponent,ItemView:TestComponent,Modal:TestModal,FuzzySuggestModal:TestModal,SuggestModal:TestModal};});
beforeEach(()=>{installDomHelpers();document.body.empty();});
interface ViewState{tab:string;update(force?:boolean):void;updatePending:boolean;forcePending:boolean}
function fixture(tab:string){
 const graph={update:vi.fn()},search={update:vi.fn()},companion={draggingEntries:false,context:vi.fn()},view=Object.assign(Object.create(EmergenceView.prototype) as ViewState,{tab,interactionHeld:false,updatePending:false,forcePending:false,status:document.body.createDiv(),statusDetails:document.body.createDiv(),graphPanel:graph,searchPanel:search,companionPanel:companion,controller:{activePath:'Main.md',graph:{snapshot:{version:1}},review:{},settings:defaults}});return {view,graph,search,companion};
}
describe('updates belong to the visible editor',()=>{
 it('does not rebuild the hidden graph or search when the companion receives a model update',()=>{const f=fixture('companion');f.view.update();expect(f.graph.update).not.toHaveBeenCalled();expect(f.search.update).not.toHaveBeenCalled();expect(f.companion.context).toHaveBeenCalledOnce();});
 it.each(['graph','search'])('refreshes only %s when returning to that tab',tab=>{const f=fixture(tab);f.view.update();expect(tab==='graph'?f.graph.update:f.search.update).toHaveBeenCalledOnce();expect(tab==='graph'?f.search.update:f.graph.update).not.toHaveBeenCalled();});
 it('retains an update received during an external drag and applies it afterwards',()=>{const f=fixture('companion');f.companion.draggingEntries=true;f.view.update(true);expect(f.view.updatePending).toBe(true);expect(f.view.forcePending).toBe(true);expect(f.companion.context).not.toHaveBeenCalled();f.companion.draggingEntries=false;f.view.update(true);expect(f.companion.context).toHaveBeenCalledOnce();});
 it('does not measure or render a hidden graph through resize or direct callbacks',()=>{const host=document.body.createDiv();host.hidden=true;const semantic={refresh:vi.fn()},nativeViews={resize:vi.fn()},panel=Object.assign(Object.create(GraphPanel.prototype) as {update():void;resize():void},{host,enabled:true,semantic,nativeViews});panel.update();panel.resize();expect(semantic.refresh).not.toHaveBeenCalled();expect(nativeViews.resize).not.toHaveBeenCalled();const search=Object.assign(Object.create(SearchPanel.prototype) as {update():void},{host,enabled:true,state:vi.fn(()=>{throw Error('Hidden search must not draw');})});expect(()=>search.update()).not.toThrow();});
});
