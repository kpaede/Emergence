import {describe,it,expect} from 'vitest';
import {DEFAULT_PATTERN,TetradStore,type TetradPattern} from '../src/tetrad/patterns';
import {appearanceDefinitions,displayField,setDisplayValue} from '../src/tetrad/appearance-settings';

const custom:TetradPattern={id:'perspectives',name:'Perspectives',level:2,headings:{enhances:'Strength',reverses:'Risk',retrieves:'Return',obsolesces:'Loss'}};
describe('shared tetrad appearance labels',()=>{
 it('retains the original bottom-right legend default and respects an explicitly hidden legend',()=>{
  expect(new TetradStore(undefined,async()=>{}).display.legendPosition).toBe('bottom-right');
  expect(new TetradStore({display:{legendPosition:'none'}},async()=>{}).display.legendPosition).toBe('none');
 });
 it('offers the original placements in global settings and uses the same persisted record as the editor',async()=>{
  const store=new TetradStore(undefined,async()=>{}),definitions=appearanceDefinitions(()=>false);
  expect(definitions.map(item=>'control' in item?item.control?.key:undefined)).toEqual(['tetrad_centerDisplay','tetrad_legendPosition']);
  expect(displayField('tetrad_format')).toBeUndefined();expect(displayField('tetrad_legendPosition')).toBe('legendPosition');
  for(const value of ['bottom-left','none','bottom-right']){
   await setDisplayValue(store,'legendPosition',value);expect(new TetradStore(store.snapshot(),async()=>{}).settings(DEFAULT_PATTERN).legendPosition).toBe(value);
  }
  await setDisplayValue(store,'centerDisplay','legend');expect(store.settings(DEFAULT_PATTERN).centerDisplay).toBe('legend');
 });
 it('rejects invalid display options and rolls back failed global-setting saves',async()=>{
  const store=new TetradStore(undefined,async()=>{throw Error('disk full');}),before=store.snapshot();
  await expect(setDisplayValue(store,'legendPosition','top-left')).rejects.toThrow();
  await expect(setDisplayValue(store,'legendPosition','bottom-left')).rejects.toThrow('disk full');
  expect(store.snapshot()).toEqual(before);
 });
 it('keeps custom display labels separate from source markers and restores them after reload',async()=>{
  const store=new TetradStore({patterns:[custom]},async()=>{}),display=store.settings(custom);display.lawText.enhances.label='Visible strength';await store.setAppearance(custom,display);
  expect(store.settings(custom).lawText.enhances.label).toBe('Visible strength');expect(store.pattern(custom.id)?.headings.enhances).toBe('Strength');expect(store.settings(DEFAULT_PATTERN).lawText.enhances.label).toBe('ENHANCES');
  const restored=new TetradStore(store.snapshot(),async()=>{});expect(restored.settings(custom).lawText.enhances.label).toBe('Visible strength');
 });
 it('does not retain modified labels after failed persistence',async()=>{
  const store=new TetradStore({patterns:[custom]},async()=>{throw Error('disk full');}),before=store.snapshot(),display=store.settings(custom);display.lawText.retrieves.label='Changed';await expect(store.setAppearance(custom,display)).rejects.toThrow('disk full');expect(store.snapshot()).toEqual(before);
 });
 it('returns defensive appearance copies and adds no per-pattern labels for the original tetrad',async()=>{
  const store=new TetradStore(undefined,async()=>{}),display=store.settings(DEFAULT_PATTERN);display.lawText.enhances.label='Visible label';expect(store.settings(DEFAULT_PATTERN).lawText.enhances.label).toBe('ENHANCES');await store.setAppearance(DEFAULT_PATTERN,display);expect(store.snapshot()).not.toHaveProperty('labels');expect(store.settings(DEFAULT_PATTERN).lawText.enhances.label).toBe('Visible label');
 });
});
