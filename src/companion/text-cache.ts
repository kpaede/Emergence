interface Entry<T>{key:string;text:string;value:T}
/** Bounded RAM cache of exact text revisions; never replaces a file read or a write precondition. */
export class ExactTextCache<T>{
 private buckets=new Map<string,Entry<T>[]>();private order=new Map<Entry<T>,true>();private characters=0;hits=0;misses=0;
 constructor(private limit=2_000_000,private entries=192){}
 get(key:string,text:string):T|undefined{const entry=this.buckets.get(key)?.find(entry=>entry.text===text);if(!entry){this.misses++;return;}this.hits++;this.order.delete(entry);this.order.set(entry,true);return entry.value;}
 set(key:string,text:string,value:T):void{
  if(text.length>this.limit)return;const bucket=this.buckets.get(key)??[];for(const entry of [...bucket])if(entry.text===text)this.remove(entry);
  const entry={key,text,value},current=this.buckets.get(key)??[];current.push(entry);this.buckets.set(key,current);this.order.set(entry,true);this.characters+=text.length;
  while(current.length>2)this.remove(current[0]!);while(this.characters>this.limit||this.order.size>this.entries)this.remove(this.order.keys().next().value!);
 }
 clear():void{this.buckets.clear();this.order.clear();this.characters=0;}
 private remove(entry:Entry<T>):void{const bucket=this.buckets.get(entry.key);if(bucket){const at=bucket.indexOf(entry);if(at>=0)bucket.splice(at,1);if(!bucket.length)this.buckets.delete(entry.key);}if(this.order.delete(entry))this.characters-=entry.text.length;}
}
