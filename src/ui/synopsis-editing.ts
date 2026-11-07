import type {SynopsisGraph} from '../graph/synopsis';
import type {Settings} from '../types';
import {SynopsisAssignmentIndex} from '../graph/synopsis-assignments';
import {termDrop, termHandle} from './term-drag';
import {Menu} from 'obsidian';
import {fieldAllowedForSource} from '../graph/field-scope';

export interface SynopsisEditingActions {
 move(focus: string, source: string, target: string, fields: string[], property: string): void;
 ready(): boolean;
}

/** Editing decorates the existing anchors, keeping navigation and SVG endpoints intact. */
export class SynopsisEditing {
 private assignments: SynopsisAssignmentIndex;
 private tags: Map<string, string[]>;
 constructor(private model: SynopsisGraph, settings: Settings, private focus: string, private actions?: SynopsisEditingActions) {this.assignments = new SynopsisAssignmentIndex(model.snapshot, settings);this.tags = new Map(model.snapshot.nodes.map(note => [note.id, note.tags]));}
 section(section: HTMLElement, fields: string[]): void {
  fields = fields.filter(field => fieldAllowedForSource(field, this.tags.get(this.focus) ?? [], this.model.snapshot));
  if (!this.actions || !fields.length || !this.model.notes.get(this.focus)?.exists) return;
  section.addClass('em-term-drop');
  const available = (term: Extract<import('./term-drag').TermDrag, {kind: 'relation'}>) => {
   const origins = this.assignments.get(term.source, term.target, term.fields);
   return origins.length ? fields.filter(field => !origins.some(origin => origin.source === this.focus && origin.target === term.target && origin.field === field)) : [];
  };
  termDrop(section, term => term.kind === 'relation' && term.focus === this.focus && this.actions!.ready() && !!available(term).length, (term, event) => {
   if (term.kind !== 'relation') return;
   const fields = available(term), move = (field: string) => {if (this.actions!.ready()) this.actions!.move(this.focus, term.source, term.target, term.fields, field);};
   if (fields.length === 1) move(fields[0]!);
   else {const menu = new Menu();for (const field of fields) menu.addItem(item => item.setTitle(field).onClick(() => move(field)));menu.showAtMouseEvent(event);}
  });
 }
 term(anchor: HTMLElement, source: string, target: string, fields: string[]): void {
  if (!fields.length) return;
  const origins = this.assignments.get(source, target, fields);
  if (!origins.length || !this.actions) return;
  anchor.draggable = false;
  const wrapper = anchor.parentElement!.createSpan({cls: 'em-syn-term'}); anchor.before(wrapper);
  termHandle(wrapper, `Begriff verschieben: ${anchor.textContent}`, {kind: 'relation', focus: this.focus, source, target, fields}, () => this.actions!.ready());
  wrapper.append(anchor);
 }
}
