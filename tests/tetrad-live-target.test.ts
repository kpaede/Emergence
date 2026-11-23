import {describe,it,expect} from 'vitest';
import {MarkdownView,TFile,type App,type WorkspaceLeaf} from 'obsidian';
import {tetradDom} from './helpers/tetrad-dom';
import {DEFAULT_PATTERN} from '../src/tetrad/patterns';
import {starter,tetradBlocks} from '../src/tetrad/source';
import {liveTetradTarget} from '../src/tetrad/live-target';

function fixture(){const dom=tetradDom('<div id="cm"><div id="widget"></div></div>'),cmRoot=dom.window.document.querySelector<HTMLElement>('#cm')!,widget=dom.window.document.querySelector<HTMLElement>('#widget')!,file=new TFile();file.path='Note.md';const view=new MarkdownView({} as WorkspaceLeaf),source=starter(DEFAULT_PATTERN,'First')+'\n'+starter(DEFAULT_PATTERN,'Second'),blocks=tetradBlocks(source,[DEFAULT_PATTERN]);Object.assign(view,{file,getMode:()=>'source',editor:{cm:{dom:cmRoot,state:{doc:{toString:()=>source}},posAtDOM:()=>blocks[1]!.from}}});const app={workspace:{getLeavesOfType:()=>[{view}]}} as unknown as App;return {dom,app,view,widget,source};}
describe('live tetrad targets',()=>{
 it('uses the current widget position for the correct block after earlier content grows',()=>{const f=fixture();expect(liveTetradTarget(f.app,f.widget,'Note.md',[DEFAULT_PATTERN])?.block.source).toContain('Second');f.dom.window.close();});
 it('does not use an inactive source editor for a reading-view callout',()=>{const f=fixture();Object.assign(f.view,{getMode:()=>'preview'});expect(liveTetradTarget(f.app,f.widget,'Note.md',[DEFAULT_PATTERN])).toBeUndefined();f.dom.window.close();});
 it('does not guess another block when a matching widget no longer maps to a callout',()=>{const f=fixture();Object.assign(f.view,{editor:{cm:{dom:f.widget,state:{doc:{toString:()=>'No tetrad'}},posAtDOM:()=>0}}});expect(()=>liveTetradTarget(f.app,f.widget,'Note.md',[DEFAULT_PATTERN])).toThrow();f.dom.window.close();});
});
