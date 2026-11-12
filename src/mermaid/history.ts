export class MermaidHistory {
 private entries: string[]; private index = 0; private typedAt = 0;
 constructor(source: string) {this.entries = [source];}
 get canUndo(): boolean {return this.index > 0;}
 get canRedo(): boolean {return this.index < this.entries.length - 1;}
 push(source: string, typing = false, now = Date.now()): void {
  if (this.entries[this.index] === source) return;
  const coalesce = typing && this.typedAt > 0 && now - this.typedAt < 500 && this.index === this.entries.length - 1;
  this.entries.splice(this.index + 1);
  if (coalesce) this.entries[this.index] = source; else {this.entries.push(source); this.index++;}
  if (this.entries.length > 250) {this.entries.shift(); this.index--;}
  this.typedAt = typing ? now : 0;
 }
 undo(): string | undefined {this.typedAt = 0; return this.canUndo ? this.entries[--this.index] : undefined;}
 redo(): string | undefined {this.typedAt = 0; return this.canRedo ? this.entries[++this.index] : undefined;}
}
