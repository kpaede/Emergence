/** Small Obsidian DOM boundary for jsdom component regression tests. */
export function installDomHelpers():void{
 const options=(element:HTMLElement,opts?:DomElementInfo)=>{if(opts?.cls)element.className=Array.isArray(opts.cls)?opts.cls.join(' '):opts.cls;if(typeof opts?.text==='string')element.textContent=opts.text;else if(opts?.text)element.append(opts.text);for(const [key,value]of Object.entries(opts?.attr??{}))element.setAttribute(key,String(value));return element;};
 Object.defineProperties(HTMLElement.prototype,{
  createEl:{configurable:true,value:function(this:HTMLElement,tag:string,opts?:DomElementInfo){const child=options(this.ownerDocument.createElement(tag),opts);this.append(child);return child;}},
  createDiv:{configurable:true,value:function(this:HTMLElement,opts?:DomElementInfo){return this.createEl('div',opts);}},
  createSpan:{configurable:true,value:function(this:HTMLElement,opts?:DomElementInfo){return this.createEl('span',opts);}},
  empty:{configurable:true,value:function(this:HTMLElement){this.replaceChildren();}},
  appendText:{configurable:true,value:function(this:HTMLElement,text:string){this.append(this.ownerDocument.createTextNode(text));}},
  setText:{configurable:true,value:function(this:HTMLElement,text:string){this.textContent=text;}},
 });
}
