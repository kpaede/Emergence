import {describe,it,expect} from 'vitest';
import {renamedPath} from '../src/graph/rename';
import {backlinkSources} from '../src/graph/backlinks';
describe('graph paths after a note or folder rename',()=>{
 it('follows exact note identity and folder descendants without matching unrelated prefixes',()=>{
  expect(renamedPath('Konzepte/Ontologie.md','Konzepte/Ontologie.md','Konzepte/Sein.md')).toBe('Konzepte/Sein.md');
  expect(renamedPath('Konzepte/Ontologie.md','Konzepte','Begriffe')).toBe('Begriffe/Ontologie.md');
  expect(renamedPath('Konzepte alt/A.md','Konzepte','Begriffe')).toBe('Konzepte alt/A.md');
 });
});
describe('Obsidian backlinks',()=>{
 it('uses actual incoming Markdown links once per note, includes Properties links and excludes self links and attachments',()=>{
  const links={'Quelle.md':{'Ziel.md':4},'Andere.md':{'Ziel.md':1},'Ziel.md':{'Ziel.md':2,'Quelle.md':1},'Canvas.canvas':{'Ziel.md':1},'Leer.md':{'Ziel.md':0}};
  expect(backlinkSources(links,'Ziel.md')).toEqual(['Quelle.md','Andere.md']);expect(backlinkSources(links,'Fehlt.md')).toEqual([]);
 });
});
