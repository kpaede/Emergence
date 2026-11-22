import {MarkdownView,type App,type Editor,type TFile} from 'obsidian';
/** A reading view may retain an inactive editor containing an older note snapshot. */
export function noteEditor(app:App,path:string):Editor|undefined{
 for(const leaf of app.workspace.getLeavesOfType('markdown'))if(leaf.view instanceof MarkdownView&&leaf.view.file?.path===path&&leaf.view.getMode()==='source')return leaf.view.editor;
 return undefined;
}
export async function noteText(app:App,file:TFile):Promise<string>{return noteEditor(app,file.path)?.getValue()??await app.vault.read(file);}
