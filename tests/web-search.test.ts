// @vitest-environment jsdom
import {describe, expect, it, vi} from 'vitest';
import {WebSearchProvider, parseSearchPage, searchQuery, shortenWeb, type WebSearchContext} from '../src/llm/web-search';
const page=(title='Example',url='https://example.org/work',next=false)=>`<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(url)}">${title}</a><a class="result__snippet">A concrete work &amp; its context.</a></div>${next?'<form action="/html/"><input name="q" value="wrong query"><input name="s" value="10"><input name="vqd" value="page-token"></form>':''}`;
describe('Public DuckDuckGo search without registration',()=>{
 it('extracts plain title/snippet data, ignores ads and never admits executable result links',()=>{
  const parsed=parseSearchPage(page()+'<div class="result result--ad"><a class="result__a" href="https://ad.test">Ad</a></div>'+page('Unsafe','javascript:alert(1)'));
  expect(parsed.sources).toEqual([{title:'Example',url:'https://example.org/work',snippet:'A concrete work & its context.'}]);
 });
 it('requests at most two pages from the fixed search host; does not open result sites or change the visible term',async()=>{
  const transport=vi.fn(async(_url:string,body:string|undefined)=>({status:200,text:body?page('Second','https://example.org/second'):page('First','https://example.org/first',true)}));
  const provider=new WebSearchProvider(transport),signal=new AbortController().signal;
  const result=await provider.lookup('Ontologie Kunstwerke',signal);
  expect(result.pages).toBe(2);expect(result.sources.map(s=>s.id)).toEqual(['WEB-1','WEB-2']);expect(transport).toHaveBeenCalledTimes(2);
  expect(transport.mock.calls.every(([url])=>new URL(url).hostname==='html.duckduckgo.com')).toBe(true);
  expect(new URLSearchParams(transport.mock.calls[1]![1]).get('q')).toBe('Ontologie Kunstwerke');
  expect((await provider.lookup('Ontologie Kunstwerke',signal)).cached).toBe(true);expect(transport).toHaveBeenCalledTimes(2);
 });
 it('does not follow an externally injected pagination form or retain duplicate destinations',async()=>{
  const transport=vi.fn(async()=>({status:200,text:page()+page()+'<form action="https://evil.test"><input name="s" value="10"></form>'}));
  const result=await new WebSearchProvider(transport).lookup('term',new AbortController().signal);
  expect(result.sources).toHaveLength(1);expect(transport).toHaveBeenCalledOnce();
 });
 it('reports challenges without fabricating snippets or bypassing the challenge',async()=>{
  const transport=vi.fn(async()=>({status:202,text:'<form id="challenge-form"></form>'}));
  const result=await new WebSearchProvider(transport).lookup('term',new AbortController().signal);
  expect(result.status).toBe('blocked');expect(result.sources).toEqual([]);expect(transport).toHaveBeenCalledOnce();
 });
 it('does not publish an aborted request even if its HTTP request later completes',async()=>{
  let finish!:(value:{status:number;text:string})=>void;
  const provider=new WebSearchProvider(()=>new Promise(resolve=>{finish=resolve;})),abort=new AbortController();
  const pending=provider.lookup('term',abort.signal);abort.abort();finish({status:200,text:page()});await expect(pending).rejects.toThrow('abgebrochen');
 });
 it('preserves first-page sources if page two fails, and bounds model context without changing the query',async()=>{
  let calls=0;const provider=new WebSearchProvider(async()=>++calls===1?{status:200,text:page('First','https://example.org/first',true)}:{status:500,text:''});
  const context=await provider.lookup('term',new AbortController().signal);expect(context.status).toBe('ready');expect(context.pages).toBe(1);expect(context.sources).toHaveLength(1);expect(context.message).toBeTruthy();
  const tiny=shortenWeb(context,1)!;expect(tiny.sources).toEqual([]);expect(tiny.query).toBe('term');expect(tiny.shortened).toBe(true);
 });
 it('forms art/example searches only from the explicit term',()=>{
  expect(searchQuery('Ontologie','artworks')).toBe('Ontologie Kunstwerke');expect(searchQuery('Ontologie','examples')).toBe('Ontologie Beispiele');expect(searchQuery('Ontologie')).toBe('Ontologie');
 });
});
export const webFixture:WebSearchContext={query:'Ontologie Beispiele',status:'ready',pages:1,sources:[{id:'WEB-1',title:'A table',url:'https://example.org/table',snippet:'A table is a physical object.'}]};
