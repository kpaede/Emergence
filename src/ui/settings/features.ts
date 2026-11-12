import {t as tr} from '../../i18n';
import {Setting} from 'obsidian';
import {synopsisFields,synopsisDepths} from '../../graph/synopsis';
import {synopsisLabel,synopsisPlacement,synopsisPositions,synopsisAt,placeSynopsis,reorderSynopsis} from '../../graph/synopsis-layout';
import {defaultSynopsisDepths,synopsisRelations,type SynopsisDepth,type SynopsisRelation} from '../../graph/synopsis-types';
import type {SettingsContext} from './context';
import {graphPreview} from './graph-preview';

/** A live sample and its branch inspector share the transactional settings draft. */
export function graphSettings(ctx: SettingsContext): void {
 const {host,draft:s}=ctx;let selected:SynopsisRelation='broader';
 new Setting(host).setName(tr('settings.graphPreview')).setHeading();
 host.createDiv({text:tr('settings.graphPreviewHelp'),cls:'em-muted'});
 const previewHost=host.createDiv(),inspector=host.createDiv({cls:'em-graph-settings-inspector'});
 const preview=graphPreview(ctx,previewHost,relation=>{selected=relation;renderInspector();preview.mark(relation);},()=>{preview.refresh();renderInspector();});
 const refresh=()=>{preview.refresh();renderInspector();preview.mark(selected);};
 const renderInspector=()=>{
  inspector.empty();const fields=synopsisFields(ctx.controller.graph.snapshot,s),relation=selected,label=synopsisLabel(s,relation),placement=synopsisPlacement(s,relation);
  new Setting(inspector).setName(tr('settings.graphEditor')).addDropdown(select=>{for(const item of synopsisRelations)select.addOption(item,synopsisLabel(s,item));select.setValue(relation).onChange(value=>{selected=value as SynopsisRelation;renderInspector();preview.mark(selected);});});
  new Setting(inspector).setName(tr('settings.graphLabel')).setDesc(tr('settings.graphLabelHelp')).addText(text=>text.setPlaceholder(label).setValue(s.synopsis?.labels?.[relation]??'').onChange(value=>{s.synopsis={...s.synopsis,labels:{...s.synopsis?.labels,[relation]:value}};ctx.changed();preview.refresh();}));
  new Setting(inspector).setName(tr('settings.graphPosition')).addDropdown(select=>{for(const position of synopsisPositions)select.addOption(position,tr(`settings.${position}` as const));select.setValue(placement.position).onChange(value=>{placeSynopsis(s,relation,value as typeof placement.position);ctx.changed();refresh();});});
  const siblings=synopsisAt(s,placement.position),index=siblings.indexOf(relation);
  new Setting(inspector).setName(tr('settings.graphOrder')).addExtraButton(button=>button.setIcon('arrow-up').setTooltip(tr('settings.graphEarlier')).setDisabled(index===0).onClick(()=>{reorderSynopsis(s,relation,-1);ctx.changed();refresh();})).addExtraButton(button=>button.setIcon('arrow-down').setTooltip(tr('settings.graphLater')).setDisabled(index===siblings.length-1).onClick(()=>{reorderSynopsis(s,relation,1);ctx.changed();refresh();}));
  new Setting(inspector).setName(tr('settings.graphDepth')).addDropdown(select=>select.addOptions({'1':'1','2':'2','3':'3',all:tr('settings.all_levels')}).setValue(String(synopsisDepths(s)[relation])).onChange(value=>{s.synopsis={...s.synopsis,depths:{...s.synopsis?.depths,[relation]:value==='all'?'all':Number(value) as SynopsisDepth}};ctx.changed();preview.refresh();}));
  if(relation==='links')inspector.createDiv({text:tr('settings.graphNativeSource',{source:tr('labels.links_in_note_text')}),cls:'em-muted'});
  else{
   new Setting(inspector).setName(tr('settings.graphFields')).setHeading();
   if(relation==='literature')inspector.createDiv({text:tr('settings.graphNativeSource',{source:'ZotLit'}),cls:'em-muted'});
   for(const field of ctx.controller.graph.snapshot.fields)new Setting(inspector).setName(field).addToggle(toggle=>toggle.setValue(fields[relation].includes(field)).onChange(value=>{const current=s.synopsis?.fields?.[relation]??fields[relation];s.synopsis={...s.synopsis,fields:{...s.synopsis?.fields,[relation]:value?[...new Set([...current,field])]:current.filter(item=>item!==field)}};ctx.changed();preview.refresh();}));
   new Setting(inspector).setName(tr('settings.use_default_assignment')).addButton(button=>button.setButtonText(tr('settings.reset')).onClick(()=>{if(s.synopsis?.fields)delete s.synopsis.fields[relation];ctx.changed();refresh();}));
  }
 };
 renderInspector();
 new Setting(host).setName(tr('settings.graphReset')).setDesc(tr('settings.graphResetHelp')).addButton(button=>button.setButtonText(tr('settings.reset')).onClick(()=>{const {fields}=s.synopsis??{};s.synopsis={fields,depths:defaultSynopsisDepths()};ctx.changed();refresh();}));
}
