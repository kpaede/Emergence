import {selectionRoots,type ThoughtIndex} from './board-model';
import type {Thought} from './model';

/** Structural shortlist only. The chosen placement still uses the common operation validator. */
export function readerMoveTargets(index:ThoughtIndex,selection:ReadonlySet<string>):Thought[]{
 const roots=selectionRoots(index,selection);if(!roots.length)return [];
 let moving=0;
 return index.nodes.filter(node=>{
  while(moving<roots.length&&roots[moving]!.to<=node.from)moving++;
  const root=roots[moving];return !root||node.from<root.from||node.from>=root.to;
 });
}
