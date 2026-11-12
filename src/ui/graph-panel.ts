import {t as tr} from '../i18n';
import {Keymap, type WorkspaceLeaf} from 'obsidian';
import type {EmergenceController} from '../controller';
import {button} from './helpers';
import {disclosure, iconButton, labelWithoutTooltip} from './panel';
import {RelationsSynopsis} from './relations-synopsis';
import {SynopsisAddModal} from './synopsis-add';
import {synopsisSourceSettings,type SynopsisSourceControls} from './synopsis-settings';
import {openSynopsisNote} from './graph-navigation';
import type {SynopsisDepth, SynopsisNote, SynopsisRelation} from '../graph/synopsis-types';
import {formatZotlitReference} from '../graph/zotlit-bibliography';
import {NativeViews} from './native-views';
import {renamedPath} from '../graph/rename';
import {backlinkSources} from '../graph/backlinks';
import {literatureActions} from '../graph/zotlit-actions';

/** The synopse and original plugin views share one scrollable side panel. */
export class GraphPanel {
 private semantic!:RelationsSynopsis;private semanticHost!:HTMLElement;private canvas!:HTMLElement;private details!:HTMLElement;
 private addModal?:SynopsisAddModal;private nativeViews!:NativeViews;private refreshSources?:SynopsisSourceControls;private observer?:ResizeObserver;
 private explore=false;private exploreBox!:HTMLInputElement;private focusPath='';private lastActive='';private follow=true;private version=-1;
 private depthSave=Promise.resolve();private selectedView='synopsis';private viewSelect!:HTMLSelectElement;private synopsisControls!:HTMLElement;private nativeHost!:HTMLElement;private viewChoices='';
 private relabel:()=>void=()=>{};
 private enabled=true;
 constructor(private controller:EmergenceController,private host:HTMLElement,private leaf:WorkspaceLeaf){}
 mount():void{
  const c=this.controller,label=this.host.createEl('label',{cls:'em-field'});label.createSpan({text:tr("graph.view")});this.viewSelect=label.createEl('select',{attr:{'aria-label':tr("graph.graph_view")}});this.viewSelect.onchange=()=>{this.refreshSources?.closeMenu();this.selectedView=this.viewSelect.value;this.version=-1;this.update();this.resize();};
  this.synopsisControls=this.host.createDiv({cls:'em-synopsis-controls'});const heading=this.synopsisControls.createDiv({cls:'em-synopsis-heading'});
  iconButton(heading,'locate-fixed',tr("labels.go_to_current_note"),()=>{this.follow=true;this.focus(c.activePath);this.semantic.center();});
  const row=this.synopsisControls.createEl('label',{cls:'em-check-row em-graph-explore'});this.exploreBox=row.createEl('input',{type:'checkbox'});row.appendText(tr("graph.explore_in_graph"));
  this.exploreBox.onchange=()=>{this.explore=this.exploreBox.checked;if(!this.explore){this.follow=true;this.focus(c.activePath);}};
  const controls=disclosure(this.synopsisControls,tr("graph.fields_and_sources"));controls.addEventListener('toggle',()=>this.resize());this.refreshSources=synopsisSourceSettings(controls,c,()=>{this.semantic.invalidate();this.renderStructure();});
  this.canvas=this.host.createDiv({cls:'em-graph em-synopsis-canvas',attr:{role:'region'}});labelWithoutTooltip(this.canvas,tr("graph.context"));
  this.semanticHost=this.canvas.createDiv();
  this.semantic=new RelationsSynopsis(this.semanticHost,c.settings,(relation,depth)=>this.setDepth(relation,depth),{
   referenceActions:(reference,source)=>literatureActions(c.app,reference,source),
   run:action=>{void c.run(action);},
   backlinks:path=>backlinkSources(c.app.metadataCache.resolvedLinks,path),
   bibliography:(reference,source)=>formatZotlitReference(c.app,source,reference),
   activate:(note,event)=>this.activateSynopsisNote(note,event),inspect:note=>this.inspectSynopsisNote(note),
   literature:target=>{void c.run(()=>import('../graph/zotlit').then(m=>m.openZotlitLibrary(c.app,target)));},
   hover:(note,event,anchor)=>c.app.workspace.trigger('hover-link',{event,source:'emergence-synopsis',hoverParent:{hoverPopover:null},targetEl:anchor,linktext:note.linktext,sourcePath:note.sourcePath}),
  },(relation,source)=>this.add(relation,source),(field,source)=>this.add('examples',source,field),{
   ready:()=>!c.applyingIdea&&!c.abort&&!c.profilePromptSave,
   move:(focus,source,target,fields,property)=>{void c.run(()=>c.moveSynopsisLink(focus,source,target,fields,property));},
  });
  this.details=this.host.createDiv({cls:'em-details'});this.details.hidden=true;
  this.nativeHost=this.host.createDiv({cls:'em-native-views'});this.nativeViews=new NativeViews(c.app,this.leaf,this.nativeHost);
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.canvas);this.observer.observe(this.host);this.update();
  this.relabel=()=>{label.querySelector('span')?.setText(tr('graph.view'));this.viewSelect.setAttribute('aria-label',tr('graph.graph_view'));row.lastChild!.textContent=tr('graph.explore_in_graph');controls.querySelector('summary')?.setText(tr('graph.fields_and_sources'));this.canvas.querySelector('.em-sr-only')?.setText(tr('graph.context'));const locate=heading.querySelector('button');if(locate)locate.setAttribute('aria-label',tr('labels.go_to_current_note'));this.refreshSources?.refresh();this.version=-1;this.semantic.invalidate();this.update();};
 }
 refreshLanguage():void{this.relabel();}
 onNoteRename(oldPath:string,newPath:string):void{this.focusPath=renamedPath(this.focusPath,oldPath,newPath);this.lastActive=renamedPath(this.lastActive,oldPath,newPath);this.version=-1;this.semantic?.invalidate();}
 update():void{
  if(!this.enabled)return;
  const c=this.controller,g=c.graph.snapshot;this.refreshSources?.refresh();
  const changed=this.lastActive!==c.activePath;this.lastActive=c.activePath;
  if(!this.focusPath||changed&&this.follow){this.focusPath=c.activePath;this.details.hidden=true;this.version=-1;}
  if(this.version!==g.version){this.version=g.version;this.renderStructure();}
  const choices=[{type:'synopsis',label:tr("graph.context")},...this.nativeViews.choices(c.activePath)],fingerprint=JSON.stringify(choices);
  if(fingerprint!==this.viewChoices){this.viewChoices=fingerprint;this.viewSelect.empty();for(const choice of choices)this.viewSelect.createEl('option',{value:choice.type,text:choice.label});}
  if(!choices.some(choice=>choice.type===this.selectedView)){this.selectedView='synopsis';this.version=-1;this.semantic.invalidate();this.renderStructure();}this.viewSelect.value=this.selectedView;
  const synopsis=this.selectedView==='synopsis';this.synopsisControls.hidden=!synopsis;this.canvas.hidden=!synopsis;this.nativeHost.hidden=synopsis;if(!synopsis)this.details.hidden=true;
  this.nativeViews.sync(c.activePath,synopsis?undefined:this.selectedView);
 }
 private renderStructure():void{if(this.selectedView!=='synopsis')return;this.semantic.render(this.controller.graph.snapshot,this.focusPath);}
 private add(relation:SynopsisRelation,source:string,field?:string):void{this.addModal?.close();this.addModal=new SynopsisAddModal(this.controller,relation,source,field);this.addModal.open();}
 private setDepth(relation:SynopsisRelation,depth:SynopsisDepth):void{
  const settings=this.controller.settings();settings.synopsis={...settings.synopsis,depths:{...settings.synopsis?.depths,[relation]:depth}};this.renderStructure();
  this.depthSave=this.depthSave.catch(()=>{}).then(()=>this.controller.persist());void this.controller.run(()=>this.depthSave);
 }
 exploreNote(path:string):void{this.selectedView='synopsis';this.version=-1;this.update();this.explore=true;this.exploreBox.checked=true;this.follow=false;this.focus(path);}
 private focus(path:string):void{
  if(!this.controller.graph.snapshot.nodes.some(n=>n.id===path)&&!this.semantic.model?.notes.has(path))return;this.focusPath=path;this.follow=path===this.controller.activePath;this.details.hidden=true;this.renderStructure();
 }
 private activateSynopsisNote(note:SynopsisNote,event?:MouseEvent):void{
  if(this.explore&&!event?.metaKey&&!event?.ctrlKey&&event?.button!==1){this.follow=false;this.focus(note.id);return;}
  this.follow=true;void this.controller.run(()=>openSynopsisNote(this.controller,note,event?.button===1?'tab':event?Keymap.isModEvent(event):false));
 }
 private inspectSynopsisNote(note:SynopsisNote):void{
  this.details.empty();this.details.hidden=false;const line=this.details.createDiv({cls:'em-details-heading'});line.createEl('h4',{text:note.title});
  iconButton(line,'x',tr("graph.close_details"),()=>{this.details.hidden=true;});this.details.createDiv({text:note.path??note.linktext,cls:'em-path'});
  button(this.details,tr("graph.open_note"),()=>{void this.controller.run(()=>openSynopsisNote(this.controller,note));});
 }
 resize():void{this.semantic?.refresh();this.nativeViews?.resize();}
 refreshTheme():void{this.resize();}
 setEnabled(value:boolean):void{if(this.enabled===value)return;this.enabled=value;this.version=-1;if(value)this.update();else this.nativeViews.sync(this.controller.activePath,undefined);}
 async destroy():Promise<void>{this.addModal?.close();this.refreshSources?.destroy();this.observer?.disconnect();this.semantic?.destroy();await this.nativeViews?.destroy();}
}
