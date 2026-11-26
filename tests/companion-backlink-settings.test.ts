import {describe,expect,it,vi} from 'vitest';
import {EmergenceSettingsTab} from '../src/settings';
import {defaults} from '../src/config';
vi.mock('obsidian',async original=>{const {TestComponent,TestModal}=await import('./helpers/reader-host');return {...await original<Record<string,unknown>>(),PluginSettingTab:class {},Component:TestComponent,Modal:TestModal,FuzzySuggestModal:TestModal,SuggestModal:TestModal};});
function fixture(){
 const settings=defaults(),draft=defaults(),refreshBacklinks=vi.fn(),saveSettings=vi.fn(async()=>{});
 const tab=Object.assign(Object.create(EmergenceSettingsTab.prototype) as Pick<EmergenceSettingsTab,'getControlValue'|'setControlValue'>,{plugin:{settings,saveSettings},app:{workspace:{getLeavesOfType:()=>[{view:{refreshBacklinks}}]}},draft,saving:false,updateSave:vi.fn(),refreshDomState:vi.fn()});
 return {tab,settings,draft,refreshBacklinks,saveSettings};
}
describe('companion backlink display setting',()=>{
 it('persists the opt-out immediately, keeps the open settings draft in sync and refreshes the graph',async()=>{const f=fixture();expect(f.tab.getControlValue('hideCompanionBacklinks')).toBe(true);await f.tab.setControlValue('hideCompanionBacklinks',false);expect(f.settings.hideCompanionBacklinks).toBe(false);expect(f.draft.hideCompanionBacklinks).toBe(false);expect(f.tab.getControlValue('hideCompanionBacklinks')).toBe(false);expect(f.saveSettings).toHaveBeenCalledOnce();expect(f.refreshBacklinks).toHaveBeenCalledOnce();});
 it('restores the previous value and leaves the draft and graph unchanged if saving fails',async()=>{const f=fixture();f.saveSettings.mockRejectedValueOnce(new Error('Cannot save'));await expect(f.tab.setControlValue('hideCompanionBacklinks',false)).rejects.toThrow('Cannot save');expect(f.settings.hideCompanionBacklinks).toBe(true);expect(f.draft.hideCompanionBacklinks).toBe(true);expect(f.refreshBacklinks).not.toHaveBeenCalled();await f.tab.setControlValue('hideCompanionBacklinks',false);expect(f.settings.hideCompanionBacklinks).toBe(false);});
 it('rejects non-boolean values before saving',async()=>{const f=fixture();await expect(f.tab.setControlValue('hideCompanionBacklinks','false')).rejects.toThrow();expect(f.saveSettings).not.toHaveBeenCalled();expect(f.settings.hideCompanionBacklinks).toBe(true);});
});
