import {span, type ArgdownModel, type SourceSpan} from './model';
import {applyEdits} from './source-edits';
/** The actual argument declaration and its numbered reconstruction, in the original note. */
export function derivationScope(model: ArgdownModel, title: string): SourceSpan | undefined {
 const pcs = model.rules.find(rule => String(rule.name) === 'pcs' && rule.argument?.title === title), range = pcs ? span(pcs) : undefined;
 if (!range) return;
 const declaration = model.rules.filter(rule => String(rule.name) === 'argument' && rule.argument?.title === title).map(span).filter((at): at is SourceSpan => !!at && at.to <= range.from).pop();
 return {from: declaration?.from ?? range.from, to: range.to};
}
export function replaceDerivationSource(source: string, scope: SourceSpan, code: string): string {
 return applyEdits(source, [{...scope, insert: code}]);
}
export function scopedRanges(ranges: SourceSpan[], scope?: SourceSpan): SourceSpan[] {
 return scope ? ranges.filter(range => range.to > scope.from && range.from < scope.to).map(range => ({from: Math.max(range.from, scope.from) - scope.from, to: Math.min(range.to, scope.to) - scope.from})) : ranges;
}
