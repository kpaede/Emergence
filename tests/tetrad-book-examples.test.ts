import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {DEFAULT_PATTERN} from '../src/tetrad/patterns';
import {parseSource} from '../src/tetrad/source';
import {tetradEntries} from '../src/tetrad/entries';
const laws=['enhances','reverses','retrieves','obsolesces'] as const;
describe('the three supplied book examples',()=>{
 for(const [name,counts]of [['Crowd',[1,0,1,1]],['Microphone',[2,1,1,1]],['Newspaper',[3,2,3,2]]] as const){
  it(name+' uses one source line per gloss paragraph and retains the book core line breaks',()=>{
   const source=readFileSync(new URL('../examples/tetrads/'+name+'.md',import.meta.url),'utf8'),doc=parseSource(source,DEFAULT_PATTERN);
   expect(doc.sections.size).toBe(4);expect(laws.map(law=>tetradEntries(doc.sections.get(law)!.body).glosses.length)).toEqual(counts);
   for(const law of laws){const model=tetradEntries(doc.sections.get(law)!.body);expect(model.core).toBeDefined();for(const gloss of model.glosses){expect(gloss.block).toBe('Paragraph');expect(gloss.content).not.toMatch(/[\r\n]/u);}}
   expect(source).not.toMatch(/em-note:|^> - /mu);
  });
 }
});
