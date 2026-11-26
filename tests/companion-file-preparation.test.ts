import {describe,expect,it,vi} from 'vitest';
import {CompanionFilePreparation} from '../src/companion/file-preparation';
const tick=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};
describe('preparing cloud-backed companion files before editing',()=>{
 it('limits background reads to two and prioritizes the selected chapter',async()=>{
  const pending=new Map<string,()=>void>(),read=vi.fn((path:string)=>new Promise<void>(resolve=>{pending.set(path,resolve);})),prep=new CompanionFilePreparation(read,()=>true);
  prep.set(['Index.md','A.md','B.md','C.md'],'B.md');await tick();expect(read.mock.calls.map(([path])=>path)).toEqual(['B.md','Index.md']);pending.get('B.md')!();await tick();expect(read.mock.calls.map(([path])=>path)).toEqual(['B.md','Index.md','A.md']);prep.close();for(const resolve of pending.values())resolve();await prep.settled();
 });
 it('reserves a third read for the target under the pointer without queuing more background work',async()=>{
  const pending=new Map<string,()=>void>(),read=vi.fn((path:string)=>new Promise<void>(resolve=>{pending.set(path,resolve);})),prep=new CompanionFilePreparation(read,()=>true);
  prep.set(['A.md','B.md','C.md','D.md']);await tick();prep.beginDrag();prep.hover('D.md');prep.hover('D.md');await tick();expect(read.mock.calls.map(([path])=>path)).toEqual(['A.md','B.md','D.md']);prep.hover('C.md');await tick();expect(read).toHaveBeenCalledTimes(3);pending.get('D.md')!();await tick();expect(read.mock.calls.map(([path])=>path)).toEqual(['A.md','B.md','D.md','C.md']);prep.close();for(const resolve of pending.values())resolve();await prep.settled();
 });
 it('does not reread files after every card edit or repaint, and rechecks a hover once per drag',async()=>{
  const read=vi.fn(async()=>{}),prep=new CompanionFilePreparation(read,()=>true);prep.set(['A.md','B.md']);await prep.settled();for(let n=0;n<10;n++)prep.set(['A.md','B.md'],'A.md');await prep.settled();expect(read).toHaveBeenCalledTimes(2);
  prep.beginDrag();prep.hover('A.md');prep.hover('A.md');await prep.settled();expect(read).toHaveBeenCalledTimes(3);prep.beginDrag();prep.hover('A.md');await prep.settled();expect(read).toHaveBeenCalledTimes(4);prep.close();
 });
 it('does not access missing files and permits preparation after restoration',async()=>{
  let exists=false;const read=vi.fn(async()=>{}),prep=new CompanionFilePreparation(read,()=>exists);prep.set(['A.md']);await prep.settled();expect(read).not.toHaveBeenCalled();exists=true;prep.set(['A.md']);await prep.settled();expect(read).toHaveBeenCalledOnce();prep.close();
 });
 it('contains read errors and retries on explicit hover instead of looping in the background',async()=>{
  const read=vi.fn(async()=>{}).mockRejectedValueOnce(Error('File is unavailable')),prep=new CompanionFilePreparation(read,()=>true);prep.set(['A.md']);await prep.settled();expect(prep.metrics.failed).toBe(1);prep.set(['A.md']);await prep.settled();expect(read).toHaveBeenCalledOnce();prep.beginDrag();prep.hover('A.md');await prep.settled();expect(prep.metrics.finished).toBe(1);expect(read).toHaveBeenCalledTimes(2);prep.close();
 });
 it('aborts in-flight reads and never starts queued files after the view closes',async()=>{
  const read=vi.fn((_path:string,signal:AbortSignal)=>new Promise<void>((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))))),prep=new CompanionFilePreparation(read,()=>true);prep.set(['A.md','B.md','C.md']);await tick();prep.close();await prep.settled();expect(read).toHaveBeenCalledTimes(2);expect(read.mock.calls.every(([,signal])=>signal.aborted)).toBe(true);expect(prep.metrics.failed).toBe(0);
 });
 it('drops obsolete queued files when switching companions',async()=>{
  const pending=new Map<string,()=>void>(),read=vi.fn((path:string)=>new Promise<void>(resolve=>{pending.set(path,resolve);})),prep=new CompanionFilePreparation(read,()=>true);prep.set(['A.md','B.md','C.md']);await tick();prep.set(['New.md']);for(const resolve of pending.values())resolve();await tick();expect(read.mock.calls.map(([path])=>path)).toEqual(['A.md','B.md','New.md']);pending.get('New.md')!();await prep.settled();prep.close();
 });
 it('reopens the same file after a cancelled read actually releases its resources',async()=>{
  const pending:(()=>void)[]=[],read=vi.fn(()=>new Promise<void>(resolve=>{pending.push(resolve);})),prep=new CompanionFilePreparation(read,()=>true);prep.set(['A.md']);await tick();prep.close();prep.set(['A.md']);await tick();expect(read).toHaveBeenCalledOnce();pending[0]!();await tick();expect(read).toHaveBeenCalledTimes(2);pending[1]!();await prep.settled();expect(prep.metrics.finished).toBe(1);prep.close();
 });
});
