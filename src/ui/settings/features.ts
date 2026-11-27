import {t} from '../../i18n';
import {Setting} from 'obsidian';
import {nameWithoutTooltip} from '../accessibility';
import {synopsisLabel,synopsisPlacement} from '../../graph/synopsis-layout';
import {defaultSynopsisDepths,synopsisRelations,type SynopsisRelation} from '../../graph/synopsis-types';
import type {SettingsContext} from './context';
import {graphPreview} from './graph-preview';
import {graphInspector} from './graph-inspector';

/** A single normal settings section: select in the diagram, edit in the adjacent form. */
export function graphSettings(ctx:SettingsContext):void{
 const {host,draft:s}=ctx;let selected:SynopsisRelation='broader',pick:HTMLSelectElement;
 new Setting(host).setName(t('settings.graphEditor')).setHeading();host.createDiv({text:t('settings.graphPreviewHelp'),cls:'em-muted'});
 const area=host.createDiv({cls:'em-graph-configuration'}),layout=area.createDiv({cls:'em-graph-settings-layout'}),previewHost=layout.createDiv({cls:'em-graph-preview-pane'}),inspector=layout.createDiv({cls:'em-graph-settings-inspector',attr:{id:'em-graph-inspector-'+crypto.randomUUID(),role:'region'}});
 const choose=new Setting(inspector).setName(t('settings.graphBranch'));const body=inspector.createDiv();
 const refreshChoices=()=>{for(const option of pick.options){const relation=option.value as SynopsisRelation;option.text=synopsisLabel(s,relation)+(synopsisPlacement(s,relation).position==='hidden'?t('settings.graphHiddenSuffix'):'');}pick.value=selected;nameWithoutTooltip(inspector,t('settings.graphBranchSettings',{branch:synopsisLabel(s,selected)}),inspector);};
 const refresh=()=>{preview.refresh();refreshChoices();preview.mark(selected);};
 const rebuild=()=>{const active=body.ownerDocument.activeElement?.closest<HTMLElement>('[data-graph-control]'),key=active&&body.contains(active)?active.dataset.graphControl:undefined;graphInspector(ctx,body,selected,refresh,rebuild);refresh();if(key)[...body.querySelectorAll<HTMLElement>('[data-graph-control]')].find(control=>control.dataset.graphControl===key)?.focus({preventScroll:true});};
 const select=(relation:SynopsisRelation)=>{selected=relation;rebuild();};
 const preview=graphPreview(ctx,previewHost,select,select,inspector.id);
 choose.addDropdown(dropdown=>{pick=dropdown.selectEl;for(const relation of synopsisRelations)dropdown.addOption(relation,synopsisLabel(s,relation));dropdown.setValue(selected).onChange(value=>select(value as SynopsisRelation));});
 rebuild();
 new Setting(host).setName(t('settings.graphReset')).setDesc(t('settings.graphResetHelp')).addButton(button=>button.setButtonText(t('settings.reset')).onClick(()=>{const {fields}=s.synopsis??{};s.synopsis={fields,depths:defaultSynopsisDepths()};ctx.changed();rebuild();}));
}
