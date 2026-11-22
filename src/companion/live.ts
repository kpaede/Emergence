import {editorInfoField,type Plugin} from 'obsidian';
import {MapMode,type ChangeDesc, type Text} from '@codemirror/state';
import {ViewPlugin,type ViewUpdate} from '@codemirror/view';
export interface LiveSink {tracks(path:string):boolean;live(path:string,before:Text,after:Text,changes:ChangeDesc,structural:boolean):void;position?(path:string,line:number):void}
export function headingChange(before:Text,after:Text,changes:ViewUpdate['changes']):boolean{
 let relevant=false;const syntax=/^ {0,3}(?:#{1,6}(?:\s|$)|[-=]{2,}\s*$|`{3,}|~{3,})/mu;
 changes.iterChangedRanges((fromA,toA,fromB,toB)=>{
  if(relevant)return;
  const context=(doc:Text,from:number,to:number)=>{const first=doc.lineAt(Math.max(0,Math.min(from,doc.length))),last=doc.lineAt(Math.min(to,doc.length));let end=last.to;if(last.number<doc.lines&&/^ {0,3}(?:=+|-+)[ \t]*$/u.test(doc.line(last.number+1).text))end=doc.line(last.number+1).to;return doc.sliceString(first.from,end);};
  const old=context(before,fromA,toA),next=context(after,fromB,toB);relevant=syntax.test(old)||syntax.test(next)||/<!--|-->/u.test(old+next);
 });return relevant;
}
export function registerCompanionLive(plugin:Plugin,sink:LiveSink):void{
 plugin.registerEditorExtension(ViewPlugin.fromClass(class{update(update:ViewUpdate):void{if(!update.docChanged&&!update.selectionSet&&!update.focusChanged)return;const file=update.state.field(editorInfoField,false)?.file;if(!file||!sink.tracks(file.path))return;if(update.docChanged)sink.live(file.path,update.startState.doc,update.state.doc,update.changes,headingChange(update.startState.doc,update.state.doc,update.changes));if(update.view.hasFocus&&(update.selectionSet||update.docChanged||update.focusChanged))sink.position?.(file.path,update.state.doc.lineAt(update.state.selection.main.head).number-1);}}));
}
export function mapAnchors(anchors:Map<string,number>,changes:ChangeDesc):void{for(const [id,from]of anchors){let removed=false;changes.iterChangedRanges((a,b)=>{if(a<=from&&b>from)removed=true;});const next=removed?null:changes.mapPos(from,1,MapMode.TrackDel);if(next===null)anchors.delete(id);else anchors.set(id,next);}}
