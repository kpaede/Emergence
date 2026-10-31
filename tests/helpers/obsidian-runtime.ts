/** Minimal host boundary for controller tests; Obsidian itself is verified by native CLI checks. */
export class MarkdownView {}
export class Notice {constructor(public message:string){}}
export function requestUrl():never{throw new Error('Unexpected real network request in unit test.');}
export function setIcon():void{/* Host rendering is exercised by native UI checks. */}
export function setTooltip():void{/* Host rendering is exercised by native UI checks. */}
