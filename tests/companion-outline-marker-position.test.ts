import {describe,expect,it} from 'vitest';
import {Text} from '@codemirror/state';
import {emptyCompanion,serializeCompanion} from '../src/companion/codec';
import {withOutlineRules} from '../src/companion/outline-rules';
import {reconcile} from '../src/companion/reconcile';
import {outlineMarkerPositions} from '../src/companion/outline-marker-position';

function document(source:string){return reconcile(withOutlineRules(emptyCompanion('Main.md'),{ignore:['Ignored'],markers:['Here']}),source).document;}
function positions(source:string){const doc=document(source);return {doc,values:[...outlineMarkerPositions(doc.outline!,new Map(),source).values()]};}
describe('proportional position within the actual section text',()=>{
 it.each([0,.25,.5,.75,1])('uses the actual %s text fraction, excluding the marker heading itself',fraction=>{const source='# Before\n'+'x\n'.repeat(fraction*100)+'###### Here\n'+'y\n'.repeat((1-fraction)*100)+'# After\n',f=positions(source);expect(f.values[0]?.fraction).toBe(fraction);expect(f.values[0]?.previous).toBe(f.doc.sections[0]!.id);expect(f.values[0]?.next).toBe(f.doc.sections[1]!.id);expect(serializeCompanion(f.doc)).not.toContain('fraction');});
 it('places a marker before the first heading at the top and measures the final section to EOF',()=>{const before=positions('# Here\n# A\nText\n');expect(before.values[0]).toMatchObject({fraction:0,next:before.doc.sections[0]!.id});const last=positions('# A\nx\n# Here\ny\n');expect(last.values[0]?.fraction).toBe(.5);expect(last.values[0]?.next).toBeUndefined();});
 it('ignores the length and number of marker labels in the same section',()=>{const f=positions('# A\nx\n# Here\ny\n###### Here\nz\n# B\n');expect(f.values.map(v=>v.fraction)).toEqual([1/3,2/3]);});
 it('keeps excluded navigation headings as real section boundaries',()=>{const f=positions('# Before\nVery long text\n## Ignored\nx\n# Here\ny\n### After\n');expect(f.values[0]?.fraction).toBe(.5);expect(f.values[0]?.previous).toBe(f.doc.outline?.find(h=>h.kind==='excluded')?.key);});
 it('uses CodeMirror offsets without materializing a second source string',()=>{const source='# A\nx \n# Here\nyyyyyy\n# B\n',doc=document(source),text=Text.of(source.split('\n'));Object.defineProperty(text,'sliceString',{value:()=>{throw Error('Whole text copying is unnecessary');}});expect([...outlineMarkerPositions(doc.outline!,new Map(),text).values()][0]?.fraction).toBe(.3);});
 it('does not show invalid stale positions or divide by zero for an empty section',()=>{const source='# A\n# Here\n# B\n',doc=document(source);expect(positions(source).values[0]?.fraction).toBe(1);expect(outlineMarkerPositions(doc.outline!,new Map([[doc.sections[0]!.id,999]]),Text.of(source.split('\n'))).size).toBe(0);});
});
