import {StorageModal} from './dialogs';
import {Notice,type Plugin} from 'obsidian';
import {localizedCommand} from '../i18n/commands';
import type {EmergenceView} from '../ui/view';
import type {CompanionService} from './service';
export function registerCompanionCommands(plugin:Plugin,service:CompanionService,workspace:()=>Promise<EmergenceView|undefined>):void{
 localizedCommand(plugin,'companion.open',{id:'open-companion-document',checkCallback:checking=>{if(!service.enabled())return false;if(!checking)void workspace().then(view=>view?.switchTab('companion')).catch((error:unknown)=>new Notice(String(error)));return true;}});
 localizedCommand(plugin,'companion.create',{id:'create-companion-document',editorCheckCallback:(checking,_editor,view)=>{const source=view.file?service.mainFor(view.file.path):undefined;if(!service.enabled()||!source||!plugin.app.vault.getFileByPath(source))return false;if(!checking){new StorageModal(plugin.app,async(options,rules)=>{const path=await service.create(source,options,rules),host=await workspace();host?.switchTab('companion');const panel=host?.companionPanel;if(panel){panel.path=path;panel.pinned=true;await panel.activate();}},()=>service.storageDefaults(),source,()=>service.outlineDefaults()).open();}return true;}});
}
