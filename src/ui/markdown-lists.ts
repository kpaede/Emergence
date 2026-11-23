/** MarkdownRenderer supplies list HTML without the preview view's native bullet
 * decoration. Use Obsidian's own markup so themes control the same markers as
 * in notes. Keep source text, ordered lists and task checkboxes unchanged. */
export function applyNativeListMarkers(root:HTMLElement):void{
 for(const list of root.querySelectorAll<HTMLElement>('ul')){
  list.classList.add('has-list-bullet');
  for(const item of list.children){
   if(item.tagName!=='LI'||item.classList.contains('task-list-item')||item.querySelector(':scope > .list-bullet'))continue;
   const marker=(item as HTMLElement).createSpan({cls:'list-bullet',attr:{'aria-hidden':'true'}});item.prepend(marker);
  }
 }
}
