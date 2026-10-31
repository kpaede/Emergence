import type {Suggestion} from '../types';

export const targetTitle = (path: string): string => path.split('/').at(-1)!.replace(/\.md$/u, '');
export const shortWikilink = (path: string): string => `[[${targetTitle(path)}]]`;
export const fullWikilink = (path: string): string => `[[${path.replace(/\.md$/u, '')}]]`;

/** Prefer the bare title; retain a path only when it is needed to reach the chosen file. */
export function preferredWikilink(s: Pick<Suggestion, 'target' | 'targetKind'>, resolve: (link: string) => string | undefined): string {
 const short = shortWikilink(s.target), resolved = resolve(short);
 return (s.targetKind === 'existing' ? resolved === s.target : resolved === undefined) ? short : fullWikilink(s.target);
}
