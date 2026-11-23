import {MarkdownRenderer, type App, type Component} from 'obsidian';
import {t} from '../../i18n';
import type {TetradPattern} from '../patterns';
import type {TetraderSettings} from '../settings-model';
import {parseSource} from '../source';
import {tetradEntries} from '../entries';
import {createElement} from './dom';
import {mountTetrad, type TetradLayout} from './layout';
import type {LawSection, ParsedTetrad, RenderedEntry} from './parse';

/** Render each source-defined section separately. Rendered headings, HTML or links
 * inside a body must never become another structural boundary. The caller owns
 * the Markdown component and serializes renders targeting the same callout. */
export async function renderTetrad(
	app: App,
	callout: HTMLElement,
	source: string,
	pattern: TetradPattern,
	settings: TetraderSettings,
	path: string,
	component: Component,
	isCurrent: () => boolean = () => true,
): Promise<TetradLayout> {
	const parsed = parseSource(source, pattern);
	const document = callout.ownerDocument;
	const title = createElement(document, 'div', 'callout-title');
	const titleInner = createElement(document, 'div', 'callout-title-inner em-tetrad-render-content');
	title.append(titleInner);
	const preamble = createElement(document, 'div', 'em-tetrad-render-content');
	const models = Array.from(parsed.sections, ([law, section]) => ({law, model: tetradEntries(section.body)}));
	const preambleModel = tetradEntries(parsed.preamble);
	// Reference definitions belong to the whole callout, including after a row
	// moves into a different wing. They are rendering context, never saved copies.
	const definitions = [...new Set([preambleModel, ...models.map(section => section.model)]
		.flatMap(model => [model.references, model.footnotes]).filter(text => text.trim()))].join('\n\n');
	const sections = models.map(({law, model}) => ({law, entries: model.entries.map(entry => ({
		entry, markdown: entry.markdown + (definitions ? '\n\n' + definitions : ''),
		host: createElement(document, 'div', 'em-tetrad-render-content'),
	}))}));
	const render = async (markdown: string, host: HTMLElement): Promise<void> => {
		if (markdown.trim()) await MarkdownRenderer.render(app, markdown, host, path, component);
	};
	await Promise.all([
		render(parsed.title, titleInner), render(parsed.preamble, preamble),
		...sections.flatMap(section => section.entries.map(entry => render(entry.markdown, entry.host))),
	]);
	if (!isCurrent()) throw new Error(t('tetrad.closed'));
	// Obsidian renders a one-line title as a paragraph; the native callout title is inline.
	const titleParagraph = titleInner.firstElementChild;
	if (titleParagraph?.tagName === 'P' && Array.from(titleInner.childNodes).every(node =>
		node === titleParagraph || (node.nodeType === 3 && !node.textContent?.trim()))) {
		titleInner.replaceChildren(...Array.from(titleParagraph.childNodes));
	}
	const content = createElement(document, 'div', 'callout-content em-tetrad-render-content');
	const structure: ParsedTetrad = {preamble: Array.from(preamble.childNodes), sections: new Map(), duplicates: new Set()};
	content.append(...structure.preamble);
	for (const section of sections) {
		let coreEntry: RenderedEntry | undefined;
		const glossEntries: RenderedEntry[] = [];
		const nodes: Node[] = [];
		for (const {entry, host} of section.entries) {
			// Separately rendered ordered items retain their effective number from
			// the original list, even when its source repeats "1." for each item.
			if (entry.order !== undefined) host.querySelector('ol')?.setAttribute('start', String(entry.order));
			const renderedEntry = {index: entry.index, nodes: Array.from(host.childNodes)};
			if (entry.kind === 'core') coreEntry = renderedEntry; else glossEntries.push(renderedEntry);
			nodes.push(...renderedEntry.nodes);
		}
		const rendered: LawSection = {nodes, coreEntry, glossEntries};
		structure.sections.set(section.law, rendered);
		content.append(...nodes);
	}
	// Commit after every Markdown render succeeds. A rejected render leaves the callout intact.
	const originalTitle = callout.querySelector<HTMLElement>(':scope > .callout-title');
	const originalTitleInner = originalTitle?.querySelector<HTMLElement>(':scope > .callout-title-inner');
	const originalTitleNodes = originalTitle ? Array.from(originalTitle.childNodes) : [];
	const originalContent = callout.querySelector<HTMLElement>(':scope > .callout-content');
	const restoreTitle = (): void => {
		if (originalTitle) {
			if (titleInner.parentNode !== originalTitle) return;
			if (originalTitleInner) titleInner.replaceWith(originalTitleInner);
			else originalTitle.replaceChildren(...originalTitleNodes);
		} else if (title.parentNode === callout) title.remove();
	};
	// Native foldable callouts attach behavior to the title. Retain that element,
	// its icon and fold controls; replace only the Markdown title contents.
	if (!isCurrent()) throw new Error(t('tetrad.closed'));
	if (originalTitleInner) originalTitleInner.replaceWith(titleInner);
	else if (originalTitle) originalTitle.replaceChildren(titleInner);
	else callout.prepend(title);
	if (originalContent) originalContent.replaceWith(content); else (originalTitle ?? title).after(content);
	let layout: TetradLayout;
	try {layout = mountTetrad(callout, settings, pattern, structure);}
	catch (error) {
		restoreTitle();
		if (originalContent) content.replaceWith(originalContent); else content.remove();
		throw error;
	}
	let destroyed = false;
	return {
		update(next) {if (!destroyed) layout.update(next);},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			layout.destroy();
			restoreTitle();
			if (content.parentNode === callout) {
				if (originalContent) content.replaceWith(originalContent); else content.remove();
			}
		},
	};
}
