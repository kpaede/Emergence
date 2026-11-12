import {t as tr} from '../i18n';
import type {CslInline,FormattedReference} from '../graph/zotlit-bibliography';
/** Render ZotLit's already formatted Pandoc inline AST. Text is never interpreted as HTML. */
export function cslContent(host:HTMLElement,entry:FormattedReference):void{
 const append=(parent:HTMLElement,nodes:readonly CslInline[])=>{
  for(const node of nodes){const value=node.c;
   if(node.t==='Str'&&typeof value==='string'){parent.appendText(value);continue;}
   if(node.t==='Space'||node.t==='SoftBreak'){if(parent.lastChild?.textContent?.endsWith(' ')!==true)parent.appendText(' ');continue;}
   if(node.t==='LineBreak'){parent.createEl('br');continue;}
   const wrappers:Record<string,keyof HTMLElementTagNameMap>={Emph:'em',Strong:'strong',Underline:'u',Strikeout:'del',Superscript:'sup',Subscript:'sub'};
   if(typeof wrappers[node.t]==='string'&&Array.isArray(value)){append(parent.createEl(wrappers[node.t]!),value as CslInline[]);continue;}
   if(node.t==='SmallCaps'&&Array.isArray(value)){append(parent.createSpan({cls:'em-csl-small-caps'}),value as CslInline[]);continue;}
   if(!Array.isArray(value))continue;
   if(node.t==='Quoted'){const quote=(value[0] as {t?:string})?.t==='SingleQuote'?['‘','’']:['“','”'];parent.appendText(quote[0]!);append(parent,value[1] as CslInline[]);parent.appendText(quote[1]!);}
   else if(node.t==='Span'){const display=((value[0] as [string,string[]])?.[1]??[]).some(cls=>['csl-block','csl-indent','csl-left-margin','csl-right-inline'].includes(cls));if(display&&parent.textContent&&!parent.textContent.endsWith(' '))parent.appendText(' ');append(parent,value[1] as CslInline[]);if(display)parent.appendText(' ');}
   else if(node.t==='Link'||node.t==='Image'||node.t==='Cite')append(parent,value[1] as CslInline[]);
   else if(node.t===tr("common.source"))parent.createEl('code',{text:String(value[1]??'')});
   else if(node.t==='Math')parent.appendText(String(value[1]??''));
   // Raw HTML and citation notes are not bibliography inline content.
  }
 };
 if(entry.marker?.length){append(host,entry.marker);host.appendText(' ');}append(host,entry.content);
}
