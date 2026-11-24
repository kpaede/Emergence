import {parser,GFM} from '@lezer/markdown';

export interface ReaderPointer {x:number;y:number;offset?:number}
const markdown=parser.configure(GFM);
interface Projection {text:string;from:number[];to:number[]}
/** A temporary text map for mouse activation only; nothing is written to Markdown. */
function projection(source:string,doc:Document):Projection{
 const hidden=new Uint8Array(source.length),literal=new Uint8Array(source.length);
 markdown.parse(source).iterate({enter(node){
  if(['InlineCode','FencedCode','CodeBlock'].includes(node.name))literal.fill(1,node.from,node.to);
  if(/Mark$/u.test(node.name)||['CodeInfo','LinkLabel','LinkReference','Comment','CommentBlock','HTMLTag','Image'].includes(node.name)||node.name==='URL'&&node.node.parent?.name!=='Autolink')hidden.fill(1,node.from,node.to);
 }});
 for(const match of source.matchAll(/!?\[\[([^\]\n]+)\]\]/gu)){
  const start=match.index;if(literal[start]||hidden[start])continue;const pipe=match[0].indexOf('|');
  hidden.fill(1,start,start+(pipe>=0?pipe+1:match[0].startsWith('!')?3:2));hidden.fill(1,start+match[0].length-2,start+match[0].length);
 }
 const result:Projection={text:'',from:[],to:[]},append=(text:string,from:number,to:number)=>{result.text+=text;for(let i=0;i<text.length;i++){result.from.push(from);result.to.push(to);}};
 const Parser=doc.defaultView?.DOMParser,entities=new Map<string,string>();
 for(let at=0;at<source.length;at++){
  if(hidden[at])continue;
  if(!literal[at]&&source[at]==='\\'&&/[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/u.test(source[at+1]??'')){append(source[at+1]!,at,at+2);at++;continue;}
  if(!literal[at]&&source[at]==='&'&&Parser){
   const entity=/^&(?:#[xX][\da-fA-F]+|#\d+|[a-zA-Z][a-zA-Z\d]+);/u.exec(source.slice(at))?.[0];
   if(entity){let value=entities.get(entity);if(value===undefined){value=new Parser().parseFromString(entity,'text/html').body.textContent??entity;entities.set(entity,value);}append(value,at,at+entity.length);at+=entity.length-1;continue;}
  }
  append(source[at]!,at,at+1);
 }
 return result;
}

/** Match rendered text in document order, including repeated words and hidden Markdown syntax. */
export function readerTextOffset(content:HTMLElement,source:string,target:Node,offset:number):number|undefined{
 if(target.nodeType!==3||!content.contains(target))return;
 const map=projection(source,content.ownerDocument),walker=content.ownerDocument.createTreeWalker(content,4);let cursor=0;
 for(let node=walker.nextNode();node;node=walker.nextNode()){
  if(node.parentElement?.closest('.list-bullet,button,.copy-code-button,.code-block-flair,.em-sr-only'))continue;
  const text=node.textContent??'';if(!text.trim()&&node!==target)continue;
  const at=map.text.indexOf(text,cursor);if(at<0){if(node===target)return;continue;}cursor=at+text.length;
  if(node===target){const end=Math.min(text.length,Math.max(0,offset));return end===text.length&&end>0?map.to[at+end-1]:map.from[at+end];}
 }
 return;
}

/** Capture before replacing the rendered card with Obsidian's editor. */
export function readerPointer(content:HTMLElement,source:string,event:MouseEvent,prefix=0):ReaderPointer{
 const doc=content.ownerDocument as Document&{caretPositionFromPoint?(x:number,y:number):{offsetNode:Node;offset:number}|null},point={x:event.clientX,y:event.clientY};
 const caret=doc.caretPositionFromPoint?.(point.x,point.y);
 // Older webviews and non-text widgets fall back to CodeMirror's own coordinate mapping.
 const position=caret?readerTextOffset(content,source,caret.offsetNode,caret.offset):undefined;
 return {...point,offset:position===undefined?undefined:position+prefix};
}
