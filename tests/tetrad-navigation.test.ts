// @vitest-environment jsdom
import {beforeEach,describe,expect,it} from 'vitest';
import {nextTetradTarget} from '../src/tetrad/navigation';
import {decorateTetrad} from '../src/tetrad/editor-ui';
import {installDomHelpers} from './helpers/dom';
import type {LawId} from '../src/tetrad/render/laws';

beforeEach(()=>{installDomHelpers();document.body.replaceChildren();});
function fixture(){
 const host=document.body.createDiv();
 for(const law of ['enhances','reverses','retrieves','obsolesces'] as const){
  const wing=host.createDiv({cls:'tetrader-'+law,attr:{'data-em-law':law,tabindex:'0'}}),core=wing.createDiv({attr:{'data-em-core':'true',id:law+'-core',tabindex:'0'}}),list=wing.createDiv({cls:'tetrader-glosses'});core.setText(law);
  for(const index of law==='enhances'||law==='reverses'?[3,2,1]:[1,2,3])list.createDiv({cls:'tetrader-gloss',text:'Entry '+index,attr:{id:law+'-'+index,tabindex:'0'}});
 }
 decorateTetrad(host);return {host,entry:(law:LawId,index:number|'core')=>host.querySelector<HTMLElement>('#'+law+'-'+index)!};
}
describe('Tetrad text navigation',()=>{
 it('does not make the four quadrant containers focus stops',()=>{const f=fixture();expect([...f.host.querySelectorAll('[data-em-law]')].every(wing=>!wing.hasAttribute('tabindex'))).toBe(true);});
 it.each(['enhances','retrieves'] as const)('crosses from %s to the opposing core or corresponding outward entry',law=>{
  const f=fixture(),opposite=law==='enhances'?'reverses':'obsolesces';
  for(const index of ['core',1,2,3] as const){expect(nextTetradTarget(f.host,f.entry(law,index),'ArrowRight')).toBe(f.entry(opposite,index));expect(nextTetradTarget(f.host,f.entry(opposite,index),'ArrowLeft')).toBe(f.entry(law,index));}
 });
 it('visits visible text in order through both cores without focusing the quadrant',()=>{
  const f=fixture(),items=[3,2,1].map(i=>f.entry('enhances',i)).concat([f.entry('enhances','core'),f.entry('retrieves','core')],[1,2,3].map(i=>f.entry('retrieves',i)));
  items.forEach((item,i)=>{expect(nextTetradTarget(f.host,item,'ArrowDown')).toBe(items[i+1]);expect(nextTetradTarget(f.host,item,'ArrowUp')).toBe(items[i-1]);});
 });
});
