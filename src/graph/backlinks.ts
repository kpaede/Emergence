/** Linked mentions from Obsidian's own resolved index, including Properties links. */
export function backlinkSources(index:Record<string,Record<string,number>>,target:string):string[]{
 return Object.entries(index).filter(([source,targets])=>source!==target&&source.endsWith('.md')&&(targets[target]??0)>0).map(([source])=>source);
}
