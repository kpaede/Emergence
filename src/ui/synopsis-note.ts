import type {SynopsisNote} from '../graph/synopsis-types';

export interface SynopsisLinkActions {run?:(action:()=>unknown)=>void;referenceActions?(reference:import('../types').LiteratureReference,source:string):Promise<import('../graph/zotlit-actions').LiteratureActions>;backlinks?(path:string):readonly string[];bibliography?(reference:import('../types').LiteratureReference,source:string):Promise<import('../graph/zotlit-bibliography').FormattedReference>; activate(note: SynopsisNote, event: MouseEvent): void; inspect(note: SynopsisNote): void; literature?(target: {path?: string; citekey?: string; indexedKey?: string}): void; hover?(note: SynopsisNote, event: MouseEvent, anchor: HTMLElement): void}
/** The sole visual note component used in all seven relations and the focus. */
export function synopsisNote(parent: HTMLElement, note: SynopsisNote, actions: SynopsisLinkActions): HTMLAnchorElement {
 const anchor=parent.createEl('a',{cls:`em-syn-note internal-link${note.exists?'':' is-unresolved'}`,text:note.title,
  attr:{href:'./'+encodeURI(note.linktext),'data-href':note.linktext,'data-em-note':note.id}});
 anchor.id=`em-syn-note-${crypto.randomUUID()}`;
 if(!note.exists)anchor.setAttribute('aria-description','Noch nicht angelegt');
 anchor.onclick=event=>{event.preventDefault();event.stopPropagation();actions.activate(note,event);};
 anchor.onauxclick=event=>{if(event.button===1){event.preventDefault();actions.activate(note,event);}};
 anchor.oncontextmenu=event=>{event.preventDefault();actions.inspect(note);};
 anchor.onmouseover=event=>actions.hover?.(note,event,anchor);
 return anchor;
}
