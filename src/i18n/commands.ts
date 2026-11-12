import type {Command,Plugin} from 'obsidian';
import {t,type TranslationKey} from './index';
const registered=new WeakMap<Plugin,Set<{command:Command;key:TranslationKey;prefix:string}>>();
export function localizedCommand(plugin:Plugin,key:TranslationKey,definition:Omit<Command,'name'>):void{
 const title=t(key),command=plugin.addCommand({...definition,name:title}),entry={command,key,prefix:command.name.endsWith(title)?command.name.slice(0,-title.length):''};
 let commands=registered.get(plugin);if(!commands){commands=new Set();registered.set(plugin,commands);}commands.add(entry);plugin.register(()=>commands.delete(entry));
}
export function refreshCommandLanguage(plugin:Plugin):void{for(const {command,key,prefix}of registered.get(plugin)??[])command.name=prefix+t(key);}
