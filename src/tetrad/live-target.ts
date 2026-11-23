import {MarkdownView,type App,type TFile} from 'obsidian';
import type {EditorView} from '@codemirror/view';
import {t} from '../i18n';
import {tetradBlocks,type TetradBlock} from './source';
import type {TetradPattern} from './patterns';

/** Live Preview widgets must use the current CodeMirror position, not stale
 * postprocessor line ranges from before a growing section was edited. */
export function liveTetradTarget(app:App,callout:HTMLElement,path:string,patterns:readonly TetradPattern[]):{file:TFile;block:TetradBlock}|undefined{
 for(const leaf of app.workspace.getLeavesOfType('markdown')){
  const view=leaf.view;if(!(view instanceof MarkdownView)||view.file?.path!==path||view.getMode()!=='source')continue;
  const cm=(view.editor as {cm?:EditorView}).cm;if(!cm?.dom.contains(callout))continue;
  const position=cm.posAtDOM(callout),block=tetradBlocks(cm.state.doc.toString(),patterns).find(candidate=>position>=candidate.from&&position<candidate.to);
  if(!block)throw new Error(t('tetrad.useCursor'));return {file:view.file,block};
 }
 return undefined;
}
