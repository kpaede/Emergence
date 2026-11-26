// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {CompanionPanel} from '../src/companion/panel';
import type {CompanionDocument} from '../src/companion/model';
import {installDomHelpers} from './helpers/dom';
vi.mock('obsidian',async original=>{const {TestComponent,TestModal}=await import('./helpers/reader-host');return {...await original<Record<string,unknown>>(),Component:TestComponent,Modal:TestModal,FuzzySuggestModal:TestModal};});
beforeEach(()=>{installDomHelpers();document.body.empty();});
interface PanelState{dragging:boolean;held:boolean;active:boolean;enabled:boolean;pending:boolean;document:CompanionDocument;loadDocument(force:boolean):Promise<void>;refresh(force?:boolean):Promise<void>}
function fixture(){
 const root=document.body.createDiv(),old={id:'pair',source:'Main.md',original:'Old',sections:[]} as unknown as CompanionDocument,next={...old,original:'New'},paint=vi.fn(),viewDocument=vi.fn(async()=>next),panel=Object.assign(Object.create(CompanionPanel.prototype) as PanelState,{root,path:'Companion.md',readPath:'Companion.md',readRevision:0,generation:0,document:old,selected:'s',fingerprint:'old',active:true,enabled:true,dragging:false,held:false,pending:false,service:{pair:()=>({revision:1}),viewDocument},app:{vault:{getFileByPath:()=>({})}},selectPosition:vi.fn(),paint,updateControls:vi.fn(),empty:root.createDiv(),splitHost:root.createDiv(),thoughtTools:root.createDiv(),message:root.createDiv()});return {panel,old,next,viewDocument,paint};
}
describe('companion refresh during native drag',()=>{
 it('shows heading navigation while the initial chapter bodies are still loading',async()=>{
  const f=fixture(),panel=f.panel as unknown as Record<string,unknown>,root=document.body.createDiv(),outline={...f.next,storage:{mode:'sections'},sections:[{id:'s',title:'A',state:'linked'}]},render=vi.fn();let release!:(doc:CompanionDocument)=>void;
  Object.assign(panel,{readPath:'',navigation:{render},nativeHost:root.createDiv(),readerHost:root.createDiv(),sectionProblem:root.createDiv(),service:{pair:()=>({revision:1}),readOutline:async()=>outline,viewDocument:f.viewDocument}});f.viewDocument.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));const loading=f.panel.loadDocument(true);await vi.waitFor(()=>expect(f.viewDocument).toHaveBeenCalledOnce());expect(render).toHaveBeenCalledWith(outline,'s','Companion.md',true);expect(f.paint).not.toHaveBeenCalled();release(f.next);await loading;expect(f.paint).toHaveBeenCalledWith(f.next);
 });
 it('does not start a file reload while a drag from another surface is active',async()=>{const f=fixture();f.panel.dragging=true;await f.panel.refresh(true);expect(f.viewDocument).not.toHaveBeenCalled();expect(f.paint).not.toHaveBeenCalled();expect(f.panel.pending).toBe(true);});
 it.each(['dragging','held','active','enabled'] as const)('does not repaint an in-flight read after %s changes, and applies it after the interaction',async property=>{
  const f=fixture();let release!:(doc:CompanionDocument)=>void;f.viewDocument.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));const loading=f.panel.loadDocument(true);await vi.waitFor(()=>expect(f.viewDocument).toHaveBeenCalledOnce());f.panel[property]=property==='dragging'||property==='held';release(f.next);await loading;expect(f.paint).not.toHaveBeenCalled();expect(f.panel.document).toBe(f.old);expect(f.panel.pending).toBe(true);f.panel[property]=property==='active'||property==='enabled';await f.panel.loadDocument(true);expect(f.paint).toHaveBeenCalledWith(f.next);expect(f.panel.document).toBe(f.next);
 });
});
