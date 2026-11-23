import type {LawId} from './render/laws';

export type TetradFormat = 'headings' | 'bold';
export interface TetradBlock {from:number; to:number; line:number; index:number; type:string; source:string}
export interface TetradSection {from:number; to:number; headingFrom:number; label:string; body:string}
export interface TetradDocument {
 title:string;
 sections:Map<LawId,TetradSection>;
 preamble:string;
 newline:string;
 format:TetradFormat;
 level?:number;
}
