import {MarkdownView,type App,type Editor,type EditorPosition} from 'obsidian';
import type {EditorView} from '@codemirror/view';
import {ensureSyntaxTree} from '@codemirror/language';
import {t} from '../i18n';
import {validMarkerLevel} from './outline-preferences';

/** Prefer the last active source editor; a click in the sidebar must not change the insertion point. */
export function markerEditor(app:App,source:string):Editor|undefined{
 const views=app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).filter((view):view is MarkdownView=>view instanceof MarkdownView&&view.file?.path===source&&view.getMode()==='source');
 const active=app.workspace.activeEditor;return views.find(view=>view.editor===active?.editor)?.editor??views[0]?.editor;
}

export function markerInsertion(editor:Pick<Editor,'getCursor'|'getLine'|'lastLine'>,title:string,level:number){
 if(!title.trim()||/[\r\n]/u.test(title)||!validMarkerLevel(level))throw new Error(t('companion.invalidOutlineRules'));
 const at=editor.getCursor(),line=editor.getLine(at.line),prefix=at.ch>0?'\n':'',suffix=at.ch<line.length||at.line===editor.lastLine()?'\n':'';
 const text=prefix+'#'.repeat(level)+' '+title+suffix,heading:EditorPosition={line:at.line+(prefix?1:0),ch:0},cursor:EditorPosition={line:heading.line+1,ch:0};
 return {at,text,heading,cursor};
}

/** One ordinary editor transaction, with native Undo. No background edits or companion metadata. */
export function insertPositionMarker(app:App,source:string,title:string,level:number):void{
 const editor=markerEditor(app,source);if(!editor)throw new Error(t('companion.markerEditorRequired'));
 const text=editor.getValue();for(const leaf of app.workspace.getLeavesOfType('markdown')){const view=leaf.view;if(view instanceof MarkdownView&&view.file?.path===source&&view.getMode()==='source'&&view.editor.getValue()!==text)throw new Error(t('companion.editorConflict'));}
 const cm=(editor as Editor&{cm?:EditorView}).cm;if(!cm)throw new Error(t('companion.markerParsing'));
 const plan=markerInsertion(editor,title,level),from=editor.posToOffset(plan.at);
 if(cm.state.readOnly||cm.state.doc.toString()!==text)throw new Error(t('companion.editorConflict'));
 // A non-dispatched state reuses Obsidian's parser and rejects code/YAML/comment contexts.
 if(cm.state.doc.line(1).text==='---'){let closed=false;for(let line=2;line<=plan.at.line;line++){if(/^(?:---|\.\.\.)[ \t]*$/u.test(cm.state.doc.line(line).text)){closed=true;break;}}if(!closed)throw new Error(t('companion.markerContextInvalid'));}
 const next=cm.state.update({changes:{from,insert:plan.text},filter:false}).state,offset=from+(plan.at.ch?1:0),end=offset+level+1+title.length;
 const tree=ensureSyntaxTree(next,end,50);if(!tree)throw new Error(t('companion.markerParsing'));
 let heading=false;tree.iterate({from:offset,to:end,enter(node){if(/(?:ATXHeading|header[-_]?)[1-6]/iu.test(node.name))heading=true;}});
 if(!heading)throw new Error(t('companion.markerContextInvalid'));
 editor.transaction({changes:[{from:plan.at,to:plan.at,text:plan.text}],selection:{from:plan.cursor}},'emergence-position-marker');editor.focus();
}
