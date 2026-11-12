import {Component, Modal, type App} from 'obsidian';
import {sanitizeDiagram} from './native';
import type {Pele} from './types';

import type {DiagramChoice} from './choice-presets';
export {shapeChoices,edgeChoices} from './choice-presets';

/** Every preview is rendered by the host's Pele, using the real Mermaid syntax. */
export class MermaidChoiceModal extends Modal {
 private lifecycle = new Component();
 constructor(app: App, title: string, private pele: Pele, private choices: DiagramChoice[], private choose: (value: string) => void) {super(app); this.setTitle(title);}
 onOpen(): void {
  this.lifecycle.load(); this.modalEl.addClass('em-mm-choice-modal'); const grid = this.contentEl.createDiv({cls: 'em-mm-choice-grid'});
  for (const choice of this.choices) {
   const button = grid.createEl('button', {cls: 'em-mm-choice', attr: {type: 'button', 'aria-label': choice.label, title: choice.label, 'data-value': choice.value}});
   const preview = button.createDiv({cls: 'em-mm-preview em-mm-choice-preview', attr: {'aria-hidden': 'true'}});
   preview.append(sanitizeDiagram(this.pele.render(choice.source).svg));
   this.lifecycle.registerDomEvent(button, 'click', () => {this.choose(choice.value); this.close();});
  }
 }
 onClose(): void {this.lifecycle.unload(); this.contentEl.empty();}
}
