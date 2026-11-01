/** Obsidian also emits rename for folders; only exact paths and descendants move. */
export function renamedPath(path:string,oldPath:string,newPath:string):string {
 return path===oldPath?newPath:path.startsWith(oldPath+'/')?newPath+path.slice(oldPath.length):path;
}
