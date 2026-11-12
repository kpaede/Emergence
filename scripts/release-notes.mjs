import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('../manifest.json',import.meta.url),'utf8'));
const changelog=readFileSync(new URL('../CHANGELOG.md',import.meta.url),'utf8');
const sections=changelog.split(/(?=^# )/mu),section=sections.find(section=>new RegExp('^# '+manifest.version.replace(/\./gu,'\\.')+'(?:\\s|$)','u').test(section));
if(!section)throw Error('Missing release notes for '+manifest.version);
process.stdout.write(section.trim()+'\n');
