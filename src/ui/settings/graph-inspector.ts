import {Setting} from 'obsidian';
import {t} from '../../i18n';
import {synopsisFields,synopsisDepths} from '../../graph/synopsis';
import {synopsisLabel,synopsisPlacement,synopsisPositions,synopsisAt,placeSynopsis} from '../../graph/synopsis-layout';
import type {SynopsisDepth,SynopsisRelation} from '../../graph/synopsis-types';
import type {SettingsContext} from './context';

/** Source mapping, placement and display are separate groups within one persistent form. */
export function graphInspector(ctx:SettingsContext,host:HTMLElement,relation:SynopsisRelation,changed:()=>void,rebuild:()=>void):void{
 const s=ctx.draft,fields=synopsisFields(ctx.controller.graph.snapshot,s),label=synopsisLabel(s,relation),placement=synopsisPlacement(s,relation);host.empty();
 const sources=host.createDiv({cls:'em-graph-inspector-sources'});
 if(relation==='links')sources.createDiv({text:t('settings.graphNativeSource',{source:t('labels.links_in_note_text')}),cls:'em-muted'});
 else{
  new Setting(sources).setName(t('settings.graphFields')).setHeading();
  if(relation==='literature')sources.createDiv({text:t('settings.graphNativeSource',{source:'ZotLit'}),cls:'em-muted'});
  const list=sources.createDiv({cls:'em-graph-inspector-fields'});for(const field of ctx.controller.graph.snapshot.fields)new Setting(list).setName(field).addToggle(toggle=>{toggle.toggleEl.dataset.graphControl='field:'+field;toggle.setValue(fields[relation].includes(field)).onChange(value=>{const current=s.synopsis?.fields?.[relation]??fields[relation];s.synopsis={...s.synopsis,fields:{...s.synopsis?.fields,[relation]:value?[...new Set([...current,field])]:current.filter(item=>item!==field)}};ctx.changed();changed();});});
  const reset=sources.createEl('button',{text:t('settings.use_default_assignment'),cls:'em-graph-mapping-reset',attr:{type:'button','data-graph-control':'reset-fields'}});reset.onclick=()=>{if(s.synopsis?.fields)delete s.synopsis.fields[relation];ctx.changed();rebuild();};
 }
 const arrangement=host.createDiv({cls:'em-graph-inspector-arrangement'});new Setting(arrangement).setName(t('settings.graphArrangement')).setHeading();
 new Setting(arrangement).setName(t('settings.graphPosition')).addDropdown(select=>{select.selectEl.dataset.graphControl='position';for(const position of synopsisPositions)select.addOption(position,t(`settings.${position}`));select.setValue(placement.position).onChange(value=>{placeSynopsis(s,relation,value as typeof placement.position);ctx.changed();rebuild();});});
 const siblings=synopsisAt(s,placement.position),index=siblings.indexOf(relation),others=siblings.filter(item=>item!==relation);
 if(others.length&&placement.position!=='hidden')new Setting(arrangement).setName(t('settings.graphOrder')).setDesc(t('settings.graphOrderHelp',{position:t(`settings.${placement.position}`)})).addDropdown(select=>{
  select.selectEl.dataset.graphControl='order';select.addOption('first',t('settings.graphOrderFirst'));for(const item of others)select.addOption(item,t('settings.graphOrderAfter',{branch:synopsisLabel(s,item)}));select.setValue(index===0?'first':siblings[index-1]!);
  select.onChange(value=>{const next=value==='first'?others[0]:others[others.indexOf(value as SynopsisRelation)+1];placeSynopsis(s,relation,placement.position,next);ctx.changed();rebuild();});
 });
 const display=host.createDiv({cls:'em-graph-inspector-display'});new Setting(display).setName(t('settings.graphDisplay')).setHeading();
 const heading=new Setting(display);heading.settingEl.addClass('em-graph-inspector-label');heading.setName(t('settings.graphLabel')).setDesc(t('settings.graphLabelHelp')).addText(text=>{text.inputEl.dataset.graphControl='label';text.setPlaceholder(label).setValue(s.synopsis?.labels?.[relation]??'').onChange(value=>{s.synopsis={...s.synopsis,labels:{...s.synopsis?.labels,[relation]:value}};ctx.changed();changed();});});
 new Setting(display).setName(t('settings.graphDepth')).setDesc(t('settings.graphDepthHelp')).addDropdown(select=>{select.selectEl.dataset.graphControl='depth';select.addOptions({'1':'1','2':'2','3':'3',all:t('settings.all_levels')}).setValue(String(synopsisDepths(s)[relation])).onChange(value=>{s.synopsis={...s.synopsis,depths:{...s.synopsis?.depths,[relation]:value==='all'?'all':Number(value) as SynopsisDepth}};ctx.changed();changed();});});
}
