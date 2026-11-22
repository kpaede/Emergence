import {Notice, type Plugin,type TFile} from 'obsidian';
import {localizedCommand} from '../i18n/commands';
import {tetradBlocks,createInsertion} from './source';
import {DEFAULT_PATTERN} from './patterns';
import {t} from '../i18n';
import {TetradProcessor} from './processor';
import type {TetradStore} from './patterns';
import type {EmergenceView} from '../ui/view';

export function registerTetrad(plugin:Plugin,store:TetradStore,enabled:()=>boolean,open:(file:TFile,index:number)=>Promise<void>,workspace:()=>Promise<EmergenceView|undefined>):TetradProcessor{
 const processor=new TetradProcessor(store,enabled);
 plugin.register(()=>processor.destroy());plugin.register(store.subscribe(()=>processor.update()));
 plugin.registerMarkdownPostProcessor((element,context)=>processor.process(element,context,open,plugin),100);
 localizedCommand(plugin,'tetrad.open',{id:'open-tetrad-editor',checkCallback:checking=>{if(!enabled())return false;if(!checking)void workspace().then(view=>view?.switchTab('tetrad')).catch((error:unknown)=>new Notice(String(error)));return true;}});
 localizedCommand(plugin,'tetrad.insertCommand',{id:'insert-tetrad',editorCheckCallback:(checking,editor,view)=>{
  if(!enabled()||!view.file)return false;if(!checking){const cursor=editor.getCursor('from'),offset=editor.posToOffset(cursor),note=editor.getValue(),title=t('tetrad.subject'),insertion=createInsertion(note.slice(0,offset),note.slice(offset),DEFAULT_PATTERN,title);editor.replaceRange(insertion.text,cursor);const from=offset+insertion.titleOffset;editor.setSelection(editor.offsetToPos(from),editor.offsetToPos(from+title.length));}return true;
 }});
 localizedCommand(plugin,'tetrad.openAtCursor',{id:'edit-tetrad-at-cursor',editorCheckCallback:(checking,editor,view)=>{
  if(!enabled()||!view.file)return false;const block=tetradBlocks(editor.getValue(),store.list()).find(item=>editor.posToOffset(editor.getCursor())>=item.from&&editor.posToOffset(editor.getCursor())<=item.to);
  if(!block)return false;if(!checking)void open(view.file,block.index).catch((error:unknown)=>new Notice(String(error)));return true;
 }});
 return processor;
}
