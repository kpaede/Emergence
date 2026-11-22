import {Modal,FuzzySuggestModal,type App} from 'obsidian';
import {t} from '../i18n';
import type {Thought} from './model';

export class ReaderDeleteModal extends Modal {
 constructor(app:App,private count:number,private apply:()=>void){super(app);}
 onOpen():void{
  this.setTitle(t('companion.readerDeleteTitle'));this.contentEl.createEl('p',{text:t('companion.readerDeleteHelp',{count:this.count})});
  const actions=this.contentEl.createDiv({cls:'modal-button-container'});actions.createEl('button',{text:t('companion.cancel')}).onclick=()=>this.close();
  actions.createEl('button',{text:t('companion.deleteThought'),cls:'mod-warning'}).onclick=()=>{this.close();this.apply();};
 }
}
export class ReaderMoveModal extends FuzzySuggestModal<Thought> {
 constructor(app:App,private nodes:Thought[],private choose:(node:Thought)=>void){super(app);this.setPlaceholder(t('companion.readerMoveTitle'));}
 getItems():Thought[]{return this.nodes;}
 getItemText(node:Thought):string{return node.text;}
 onChooseItem(node:Thought):void{this.choose(node);}
}
