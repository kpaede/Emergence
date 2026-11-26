import {FileSystemAdapter,Platform,type App} from 'obsidian';
import {CompanionFilePreparation} from './file-preparation';
import {validPath} from './repository';

/** Read-only preparation. All writes still use Vault.process and its conflict guard. */
export function companionFilePreparation(app:App):CompanionFilePreparation|undefined{
 if(!Platform.isDesktopApp||!(app.vault.adapter instanceof FileSystemAdapter))return;
 const base=app.vault.adapter.getBasePath();let fs:typeof import('fs/promises')|undefined;
 return new CompanionFilePreparation(async(path,signal)=>{
  if(!validPath(path))return;
  // Obsidian's desktop plugin loader is CommonJS. Keep Node entirely out of mobile loading.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load the Node reader only inside Obsidian’s guarded desktop path.
  fs??=require('fs/promises') as typeof import('fs/promises');
  await fs.readFile(base+'/'+path,{signal});
 },path=>validPath(path)&&!!app.vault.getFileByPath(path));
}
