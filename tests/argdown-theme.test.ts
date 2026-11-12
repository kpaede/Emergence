import {describe,expect,it} from 'vitest';
import {JSDOM} from 'jsdom';
import {ArgdownEngine} from '../src/argdown/engine';
import {argdownNodeIds,themeArgdownNodes} from '../src/argdown/theme';
const engine=new ArgdownEngine();
async function native(source:string){const model=engine.project(source),doc=new JSDOM(await engine.svg(model)).window.document,root=doc.querySelector('svg')!;const before=root.innerHTML;themeArgdownNodes(root,model,argdownNodeIds(model));return {root,before};}
const presentation=(root:ParentNode)=>[...root.querySelectorAll('path,polygon,ellipse,text')].map(el=>({tag:el.tagName,fill:el.getAttribute('fill'),stroke:el.getAttribute('stroke'),style:el.getAttribute('style')}));
describe('Argdown uses the documented native appearance',()=>{
 it.each(['[A]: Alpha\n\n<B>: Beta','[A]: Alpha {color: "#ff0000"}\n\n<B>: Beta #tag','<A>: Dark {color: "#000000"}\n\n<B>: Light {color: "#ffffff"}','===\ndot:\n  statement:\n    style: dashed\n===\n\n[A]: Alpha','# Group {color: "#ff0000"}\n\n[A]: Alpha'])('preserves every native shape and text color: %s',async source=>{const {root,before}=await native(source),original=new JSDOM('<svg>'+before+'</svg>').window.document;expect(presentation(root)).toEqual(presentation(original));expect(root.querySelectorAll('.em-ad-statement-surface,.em-ad-argument-light-text,.em-ad-argument-dark-text')).toHaveLength(0);});
 it('honors the three documented type-wide font colors',async()=>{const {root}=await native('===\ncolor:\n  argumentFontColor: "#ffffff"\n  statementFontColor: "#ff0000"\n  groupFontColor: "#00ff00"\n===\n\n# Group\n\n[A]: Alpha\n\n<B>: Beta');const colors=[...root.querySelectorAll('text')].map(el=>el.getAttribute('fill'));expect(colors).toContain('#ffffff');expect(colors).toContain('#ff0000');expect(colors).toContain('#00ff00');});
});
