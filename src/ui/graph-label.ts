/** Bound labels by measured pixels, including unusually long titles and unbroken words. */
export function cardLabel(kicker: string, title: string, measure: (text: string) => number, width = 188): string {
 const lines = (value: string, count: number): string[] => {
  let rest = Array.from(value.replace(/\s+/gu, ' ').trim()); const result: string[] = [];
  for (let line = 0; line < count && rest.length; line++) {
   let take = 0;
   while (take < rest.length && measure(rest.slice(0, take + 1).join('')) <= width) take++;
   const clipped = take < rest.length;
   if (line + 1 === count && clipped) {
    while (take > 0 && measure(rest.slice(0, take).join('') + '…') > width) take--;
    result.push(rest.slice(0, take).join('').trimEnd() + '…'); break;
   }
   if (clipped) {const boundary = rest.slice(0, take).lastIndexOf(' '); if (boundary > take / 2) take = boundary + 1;}
   take = Math.max(1, take); result.push(rest.slice(0, take).join('').trim()); rest = rest.slice(take);
  }
  return result;
 };
 return [...lines(kicker, 1), ...lines(title, 2)].join('\n');
}
