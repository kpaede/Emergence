/** A larger projection can produce fewer wrapped lines. Never shrink the
 * candidate within a solve: that creates a two-state wrap oscillation. Both
 * native input and rendered Markdown use this same conservative solution. */
export function solveFlowHeight(rectangular:number,measure:(height:number)=>number):{height:number;content:number}{
 let height=Math.max(1,rectangular),content=height;
 for(let pass=0;pass<12;pass++){
  content=measure(height);if(content<=height+.5)return {height,content};height=content;
 }
 return {height,content:measure(height)};
}
