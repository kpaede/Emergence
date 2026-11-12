import {t as tr} from '../i18n';
import {Component, Modal, type App, type TFile} from 'obsidian';
import {MermaidMarkdownEditor} from '../mermaid/markdown-editor';
import type {ArgdownNodeDraft} from './node-edit';
export class ArgdownNodeModal extends Modal {
 private lifecycle = new Component(); private titleInput?: HTMLInputElement; private markdown?: MermaidMarkdownEditor; private input?: HTMLTextAreaElement;
 private value: string;
 constructor(app: App, private kind: 'statement' | 'argument', private draft: ArgdownNodeDraft, private apply: (draft: ArgdownNodeDraft) => void | Promise<void>, private file?: TFile) {super(app); this.value = draft.text; this.setTitle(kind === 'argument' ? tr("argdown.edit_argument") : tr("argdown.edit_statement"));}
 setValue(value: string): void {this.value=value;if(this.markdown)this.markdown.set(value);else if(this.input)this.input.value=value;}
 setNodeTitle(title: string): void {this.draft.title=title;if(this.titleInput)this.titleInput.value=title;}
 onOpen(): void {
  this.lifecycle.load();this.modalEl.addClass('em-mm-text-modal');const title=this.contentEl.createEl('label',{text:tr("argdown.title"),cls:'em-ad-edit-title'});this.titleInput=title.createEl('input',{type:'text',value:this.draft.title,attr:{'aria-label':tr("argdown.title")}});
  this.contentEl.createEl('label',{text:this.kind==='argument'?tr("labels.description"):tr("argdown.text")});const host=this.contentEl.createDiv({cls:'em-mm-label-editor'}),hint=this.contentEl.createDiv({text:tr("argdown.argdown_supports_bold_italic_and_markdown_links_wiki_links_are_converted"),cls:'em-muted'}),error=this.contentEl.createDiv({cls:'em-error',attr:{role:'status'}}),save=this.contentEl.createEl('button',{text:tr("argdown.apply"),cls:'mod-cta'});
  const done=():void=>{save.disabled=true;error.empty();void Promise.resolve().then(()=>this.apply({title:this.titleInput?.value??this.draft.title,text:this.markdown?.value??this.input?.value??this.value})).then(()=>this.close()).catch((issue:unknown)=>{error.setText(issue instanceof Error?issue.message:String(issue));}).finally(()=>{save.disabled=false;});};save.onclick=done;
  try {this.markdown=this.lifecycle.addChild(new MermaidMarkdownEditor(this.app,host,this.value,this.file,this.scope,done,()=>this.close()));this.markdown.focus();}
  catch {host.empty();hint.setText(tr("argdown.markdown_can_be_edited_as_source_wiki_links_are_converted_when"));this.input=host.createEl('textarea',{cls:'em-mm-text-input',attr:{'aria-label':tr("argdown.text")}});this.input.value=this.value;this.input.focus();}
 }
 onClose():void {this.lifecycle.unload();this.markdown=undefined;this.contentEl.empty();}
}
