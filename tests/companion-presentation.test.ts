import {describe,it,expect} from 'vitest';
import {parseYaml,stringifyYaml} from 'obsidian';
import {presentationHeader} from '../src/companion/presentation';
import {companionLayout} from '../src/companion/layout';

describe('Companion presentation defaults',()=>{
 it('configures EOME through its saved options while retaining behavioral settings',()=>{
  const header=presentationHeader('excerpt-outline-mindmap: rankDir:LR;showCheckboxesOnHover:false;zoomFactor:0.4\ncustom: retained\n','eome',573,16),data=parseYaml(header) as Record<string,unknown>;
  expect(data.custom).toBe('retained');expect(data['excerpt-outline-mindmap']).toContain('rankDir:LR');expect(data['excerpt-outline-mindmap']).toContain('showCheckboxesOnHover:false');expect(data['excerpt-outline-mindmap']).toContain('zoomFactor:1');expect(data['excerpt-outline-mindmap']).toContain('nodeWidth:320');
 });
 it('makes Lineage compact without discarding document preferences',()=>{
  const document={collapsedNodes:['a']},header=presentationHeader(stringifyYaml({'emergence-lineage-view':{document,view:{fontSize:24,cardWidth:550,theme:{containerBg:'#000'}}}}),'lineage',320,14),data=parseYaml(header) as {'emergence-lineage-view':{document:unknown;view:{fontSize:number;cardWidth:number;zoomLevel:number;theme:unknown}}},value=data['emergence-lineage-view'];
  expect(value.document).toEqual(document);expect(value.view.fontSize).toBe(14);expect(value.view.cardWidth).toBe(256);expect(value.view.zoomLevel).toBe(1);expect(value.view.theme).toEqual({inactiveNodeOpacity:100});
 });
 it('retains subsequent native font, zoom and layout choices byte for byte',()=>{
  const header='emergence-companion-presentation:\n  version: 2\nemergence-lineage-view:\n  view:\n    fontSize: 19\n    zoomLevel: 1.3\n';expect(presentationHeader(header,'lineage',320,14)).toBe(header);
 });
 it('updates existing generated font defaults without resetting other native preferences',()=>{
  for(const previous of [16,19]){
   const header=stringifyYaml({'emergence-companion-presentation':{version:1},'emergence-lineage-view':{view:{fontSize:previous,zoomLevel:1.3,cardWidth:333}}}),data=parseYaml(presentationHeader(header,'lineage',320,14)) as {'emergence-lineage-view':{view:{fontSize:number;zoomLevel:number;cardWidth:number}}};
   expect(data['emergence-lineage-view'].view).toEqual({fontSize:previous===16?14:19,zoomLevel:1.3,cardWidth:333});
  }
 });
 it('provides bounded, independent dimensions for narrow and wide outlines',()=>{
  expect(companionLayout(undefined)).toEqual({outlineRatio:.38,outlineWidth:240});expect(companionLayout({outlineRatio:NaN,outlineWidth:Infinity})).toEqual(companionLayout(undefined));expect(companionLayout({outlineRatio:4,outlineWidth:20})).toEqual({outlineRatio:.65,outlineWidth:180});
 });
});
