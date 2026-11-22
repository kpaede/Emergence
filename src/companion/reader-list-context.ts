/*! Adapted from EOME 0.2.4, Copyright (c) 2025 Kornelius Paede.
 * MIT; third-party/companion-outline-LICENSE.txt. */
import type {EditorState} from '@codemirror/state';
import {ensureSyntaxTree} from '@codemirror/language';
import {t} from '../i18n';

/** Ask Obsidian's syntax tree, so escaped dashes and fenced code stay ordinary text. */
export function cursorIsInMarkdownList(state:EditorState):boolean|null {
 const cursor=Math.max(...state.selection.ranges.map(range=>range.head)),tree=ensureSyntaxTree(state,cursor,20);if(!tree)return null;
 return state.selection.ranges.some(range=>{
  const line=state.doc.lineAt(range.head),end=line.from+line.text.replace(/[ \t]+$/u,'').length;if(end===line.from)return false;
  const position=Math.min(range.head,end);let node=tree.resolveInner(position,position===line.from?1:-1);
  for(;;){if(node.name==='ListItem'||/(?:^|_)HyperMD-list-line(?:_|$)/u.test(node.name))return true;if(!node.parent)return false;node=node.parent;}
 });
}
export async function waitForListContext(read:()=>EditorState,active:()=>boolean):Promise<boolean|undefined>{
 const initial=read();for(let attempt=0;attempt<100;attempt++){
  if(!active())return;const state=read();if(state.doc!==initial.doc||!state.selection.eq(initial.selection))return;
  const context=cursorIsInMarkdownList(state);if(context!==null)return context;
  await new Promise<void>(resolve=>window.setTimeout(resolve,0));
 }
 throw new Error(t('companion.readerParsing'));
}
