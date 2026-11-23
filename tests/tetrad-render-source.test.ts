import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {MarkdownRenderer, App, Component} from 'obsidian';
import {initializeLanguage, t} from '../src/i18n';
import {DEFAULT_PATTERN, TetradStore} from '../src/tetrad/patterns';
import {tetradEntries} from '../src/tetrad/entries';
import {LAWS} from '../src/tetrad/render/laws';
import {createElement} from '../src/tetrad/render/dom';
import {renderTetrad} from '../src/tetrad/render/source';
import {tetradDom} from './helpers/tetrad-dom';

const renderer = vi.hoisted(() => ({render: vi.fn<typeof MarkdownRenderer.render>()}));
vi.mock('obsidian', () => ({MarkdownRenderer: renderer}));

const app = {} as App;
const component = {} as Component;
const path = 'Notes/Medium.md';
const source = (body: string, format: 'headings' | 'bold' = 'headings') =>
	'> [!tetrad] **Medium**\n>\n> Preamble\n>\n' + LAWS.map((law, index) => {
		const label = DEFAULT_PATTERN.headings[law.id];
		return `> ${format === 'headings' ? '## ' + label : '**' + label + '**'}\n>\n> ${index === 0 ? body.replace(/\n/gu, '\n> ') : 'Other ' + law.id}\n`;
	}).join('>\n');
const body = 'Core\n\nRetrieves\n---------\n\n<h2>Reverses into</h2>\n\n### Body heading\n\n## [Retrieves](Target)\n\n[[Linked note]]\n\n![[Attachment.png]]';

beforeEach(() => {
	initializeLanguage('de');
	renderer.render.mockReset();
	renderer.render.mockImplementation(async (_app, markdown, host) => {
		const document = host.ownerDocument;
		if (markdown === '**Medium**') {
			const paragraph = createElement(document, 'p', '');
			paragraph.append(createElement(document, 'strong', '', 'Medium'));
			host.append(paragraph, document.createTextNode('\n'));
		} else if (markdown === 'Retrieves\n---------') {
			host.append(createElement(document, 'h2', '', 'Retrieves'));
		} else if (markdown === '<h2>Reverses into</h2>') {
			host.append(createElement(document, 'h2', '', 'Reverses into'));
		} else if (markdown === '### Body heading') {
			host.append(createElement(document, 'h3', '', 'Body heading'));
		} else if (markdown === '## [Retrieves](Target)') {
			const heading = createElement(document, 'h2', '');
			const link = createElement(document, 'a', 'internal-link', 'Retrieves');
			link.setAttribute('data-href', 'Target'); heading.append(link); host.append(heading);
		} else if (markdown === '[[Linked note]]') {
			const paragraph = createElement(document, 'p', '');
			const nativeLink = createElement(document, 'a', 'internal-link', 'Linked note');
			nativeLink.setAttribute('data-href', 'Linked note'); paragraph.append(nativeLink);
			host.append(paragraph);
		} else if (markdown === '![[Attachment.png]]') {
			const paragraph = createElement(document, 'p', '');
			paragraph.append(createElement(document, 'span', 'internal-embed', 'Attachment.png')); host.append(paragraph);
		} else {
			host.append(createElement(document, 'p', '', markdown));
		}
	});
});
afterEach(() => initializeLanguage('de'));

describe('Source-defined Tetrader rendering', () => {
	for (const format of ['headings', 'bold'] as const) it(`keeps all rendered heading forms and native links inside their ${format} source section`, async () => {
		const dom = tetradDom('<div class="callout"><div class="callout-title">Original title</div><div class="callout-content"><p>Original content</p></div></div>');
		const callout = dom.window.document.querySelector<HTMLElement>('.callout')!;
		const before = callout.innerHTML;
		const store = new TetradStore(undefined, async () => {});
		const layout = await renderTetrad(app, callout, source(body, format), DEFAULT_PATTERN, store.settings(DEFAULT_PATTERN), path, component);
		expect(callout.querySelectorAll('.tetrader-law')).toHaveLength(4);
		expect(callout.querySelector('.tetrader-enhances .tetrader-statement')?.textContent).toBe('Core');
		expect(Array.from(callout.querySelectorAll('.tetrader-enhances h2, .tetrader-enhances h3')).map(node => node.textContent)).toEqual(['Retrieves', 'Body heading', 'Reverses into', 'Retrieves']);
		expect(callout.querySelector('.tetrader-retrieves .tetrader-statement')?.textContent).toBe('Other retrieves');
		expect(callout.querySelector('.tetrader-enhances .internal-link[data-href="Linked note"]')).toBeTruthy();
		expect(callout.querySelector('.tetrader-enhances .internal-embed')?.textContent).toBe('Attachment.png');
		expect(callout.querySelector('.callout-title-inner > strong')?.textContent).toBe('Medium');
		expect(callout.querySelector('.callout-title-inner > p')).toBeNull();
		expect(tetradEntries(body).entries.every(entry => renderer.render.mock.calls.some(call => call[1] === entry.markdown && call[3] === path && call[4] === component))).toBe(true);
		expect(renderer.render.mock.calls.every(call => call[2].classList.contains('em-tetrad-render-content'))).toBe(true);
		layout.destroy(); expect(callout.innerHTML).toBe(before); layout.destroy(); expect(callout.innerHTML).toBe(before);
		dom.window.close();
	});

	it('renders direct list entries separately with nested contents and effective ordered-list numbers', async () => {
		const dom = tetradDom('<div class="callout"><div class="callout-content"><p>Original</p></div></div>');
		const callout = dom.window.document.querySelector<HTMLElement>('.callout')!, before = callout.innerHTML;
		const markdown = 'Core\n\n- Parent\n  continuation\n  - Nested A\n  - Nested B\n- Second\n\n4. Fourth\n1. Fifth';
		renderer.render.mockImplementation(async (_app, text, host) => {
			const document = host.ownerDocument;
			if (text.startsWith('- Parent')) {
				const list = createElement(document, 'ul', ''), item = createElement(document, 'li', '', 'Parent continuation');
				const nested = createElement(document, 'ul', '');
				nested.append(createElement(document, 'li', '', 'Nested A'), createElement(document, 'li', '', 'Nested B'));
				item.append(nested); list.append(item); host.append(list);
			} else if (text.startsWith('- Second') || /^\d+\./u.test(text)) {
				const ordered = /^\d+\./u.test(text), list = createElement(document, ordered ? 'ol' : 'ul', '');
				if (ordered) list.setAttribute('start', String(Number.parseInt(text, 10)));
				list.append(createElement(document, 'li', '', text)); host.append(list);
			} else host.append(createElement(document, 'p', '', text));
		});
		const store = new TetradStore(undefined, async () => {});
		const layout = await renderTetrad(app, callout, source(markdown), DEFAULT_PATTERN, store.settings(DEFAULT_PATTERN), path, component);
		const glosses = Array.from(callout.querySelectorAll<HTMLElement>('.tetrader-enhances .tetrader-gloss'));
		expect(glosses.map(entry => entry.dataset.emEntryIndex)).toEqual(['4', '3', '2', '1']);
		expect(glosses[3]!.querySelectorAll(':scope > ul > li')).toHaveLength(1);
		expect(glosses[3]!.querySelectorAll(':scope > ul > li > ul > li')).toHaveLength(2);
		expect(glosses.slice(0, 2).map(entry => entry.querySelector('ol')?.getAttribute('start'))).toEqual(['5', '4']);
		expect(callout.querySelector<HTMLElement>('.tetrader-enhances .tetrader-core')?.dataset.emEntryIndex).toBe('0');
		expect(tetradEntries(markdown).entries.every(entry => renderer.render.mock.calls.some(call => call[1] === entry.markdown))).toBe(true);
		layout.destroy(); expect(callout.innerHTML).toBe(before); dom.window.close();
	});

	it('shares invisible reference and footnote definitions as render context without extra graphical entries', async () => {
		const dom = tetradDom('<div class="callout"></div>');
		const callout = dom.window.document.querySelector<HTMLElement>('.callout')!;
		const markdown = 'Core [source][ref]\n\n- Entry[^note]\n\n[ref]: Target.md\n\n[^note]: Footnote text';
		const model = tetradEntries(markdown), store = new TetradStore(undefined, async () => {});
		const layout = await renderTetrad(app, callout, source(markdown), DEFAULT_PATTERN, store.settings(DEFAULT_PATTERN), path, component);
		expect(model.entries).toHaveLength(2);
		expect(callout.querySelectorAll('.tetrader-enhances .tetrader-gloss')).toHaveLength(1);
		for (const entry of model.entries) {
			expect(renderer.render.mock.calls.some(call => call[1] === entry.markdown + '\n\n' + model.references + '\n\n' + model.footnotes)).toBe(true);
		}
		layout.destroy(); expect(callout.childNodes).toHaveLength(0); dom.window.close();
	});

	it('retains the native callout title, its fold controls and event listeners throughout rendering', async () => {
		const dom = tetradDom('<div class="callout is-collapsible"><div class="callout-title"><span class="callout-icon">Icon</span><div class="callout-title-inner"><em>Original title</em></div><span class="callout-fold">Fold</span></div><div class="callout-content"><p>Keep this</p></div></div>');
		const callout = dom.window.document.querySelector<HTMLElement>('.callout')!;
		const title = callout.querySelector<HTMLElement>('.callout-title')!;
		const titleInner = title.querySelector<HTMLElement>('.callout-title-inner')!;
		const original = Array.from(title.childNodes), before = callout.innerHTML;
		const toggle = vi.fn(() => callout.classList.toggle('is-collapsed'));
		title.addEventListener('click', toggle);
		const store = new TetradStore(undefined, async () => {});
		const layout = await renderTetrad(app, callout, source(body), DEFAULT_PATTERN, store.settings(DEFAULT_PATTERN), path, component);
		expect(callout.querySelector('.callout-title')).toBe(title);
		expect(title.querySelector('.callout-icon')).toBe(original[0]);
		expect(title.querySelector('.callout-fold')).toBe(original[2]);
		expect(title.querySelector('.callout-title-inner strong')?.textContent).toBe('Medium');
		title.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
		expect(toggle).toHaveBeenCalledTimes(1);
		expect(callout.classList.contains('is-collapsed')).toBe(true);
		layout.destroy();
		expect(callout.querySelector('.callout-title')).toBe(title);
		expect(title.querySelector('.callout-title-inner')).toBe(titleInner);
		expect(Array.from(title.childNodes)).toEqual(original);
		expect(callout.innerHTML).toBe(before);
		title.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
		expect(toggle).toHaveBeenCalledTimes(2);
		expect(callout.classList.contains('is-collapsed')).toBe(false);
		dom.window.close();
	});

	it('uses effective display names consistently while preserving the source and original nodes', async () => {
		const dom = tetradDom('<div class="callout"><div class="callout-title">Original</div><div class="callout-content"><p>Original</p></div><button>Original action</button></div>');
		const callout = dom.window.document.querySelector<HTMLElement>('.callout')!;
		const original = Array.from(callout.childNodes);
		const store = new TetradStore(undefined, async () => {}), settings = store.settings(DEFAULT_PATTERN);
		settings.centerDisplay = 'labels'; settings.lawText.enhances = {label: 'Verstärkung', abbreviation: 'VER'};
		const markdown = source('');
		const layout = await renderTetrad(app, callout, markdown, DEFAULT_PATTERN, settings, path, component);
		expect(callout.ownerDocument.getElementById(callout.querySelector('.tetrader-enhances')!.getAttribute('aria-labelledby')!)?.textContent).toBe('Verstärkung');expect(callout.querySelector('.tetrader-enhances')!.hasAttribute('aria-label')).toBe(false);
		expect(callout.querySelector('.tetrader-center-label[data-law="enhances"]')?.textContent).toBe('Verstärkung');
		expect(callout.querySelector('.tetrader-corner-legend [data-law="enhances"]')?.textContent).toBe('VER');
		expect(callout.querySelector('.tetrader-corner-legend')?.getAttribute('aria-description')).toContain('Verstärkung: Oben links');
		settings.centerDisplay = 'none'; settings.lawText.enhances = {label: 'Neue Beschriftung', abbreviation: 'NEU'};
		layout.update(settings);
		expect(callout.ownerDocument.getElementById(callout.querySelector('.tetrader-enhances')!.getAttribute('aria-labelledby')!)?.textContent).toBe('Neue Beschriftung');expect(callout.querySelector('.tetrader-enhances')!.hasAttribute('aria-label')).toBe(false);
		expect(callout.querySelector('.tetrader-enhances .tetrader-missing-label')?.textContent).toBe('Neue Beschriftung');
		expect(callout.querySelector('.tetrader-enhances .tetrader-missing-label')?.hasAttribute('hidden')).toBe(false);
		expect(markdown).toContain('> ## Enhances');
		layout.destroy(); expect(Array.from(callout.childNodes)).toEqual(original);
		dom.window.close();
	});

	it('leaves the existing callout untouched when Markdown rendering fails', async () => {
		const dom = tetradDom('<div class="callout"><div class="callout-title">Original</div><div class="callout-content"><p>Keep this</p></div></div>');
		const callout = dom.window.document.querySelector<HTMLElement>('.callout')!, before = callout.innerHTML;
		renderer.render.mockRejectedValueOnce(new Error('Renderer failed'));
		const store = new TetradStore(undefined, async () => {});
		await expect(renderTetrad(app, callout, source(body), DEFAULT_PATTERN, store.settings(DEFAULT_PATTERN), path, component)).rejects.toThrow('Renderer failed');
		expect(callout.innerHTML).toBe(before);
		dom.window.close();
	});

	it('does not commit a stale asynchronous render over a newer callout instance', async () => {
		const dom = tetradDom('<div class="callout"><div class="callout-title">Original</div><div class="callout-content"><p>Original content</p></div></div>');
		const callout = dom.window.document.querySelector<HTMLElement>('.callout')!;
		let release!: () => void;
		const gate = new Promise<void>(resolve => {release = resolve;});
		renderer.render.mockImplementationOnce(async (_app, _markdown, host) => {
			await gate; host.append(createElement(host.ownerDocument, 'p', '', 'Stale title'));
		});
		let current = true;
		const store = new TetradStore(undefined, async () => {});
		const pending = renderTetrad(app, callout, source(body), DEFAULT_PATTERN, store.settings(DEFAULT_PATTERN), path, component, () => current);
		const title = createElement(callout.ownerDocument, 'div', 'callout-title', 'Newer title');
		const content = createElement(callout.ownerDocument, 'div', 'callout-content', 'Newer content');
		callout.replaceChildren(title, content);
		const newer = callout.innerHTML;
		current = false; release();
		await expect(pending).rejects.toThrow(t('tetrad.closed'));
		expect(callout.innerHTML).toBe(newer);
		expect(Array.from(callout.childNodes)).toEqual([title, content]);
		expect(callout.classList.contains('tetrader-tetrad')).toBe(false);
		dom.window.close();
	});

	it('restores the original callout when mounting the diagram fails', async () => {
		const dom = tetradDom('<div class="callout"><div class="callout-title">Original</div><div class="callout-content"><p>Keep this</p></div></div>');
		const callout = dom.window.document.querySelector<HTMLElement>('.callout')!, before = callout.innerHTML;
		Object.assign(dom.window, {createSvg: () => {throw new Error('SVG unavailable');}});
		const store = new TetradStore(undefined, async () => {});
		await expect(renderTetrad(app, callout, source(body), DEFAULT_PATTERN, store.settings(DEFAULT_PATTERN), path, component)).rejects.toThrow('SVG unavailable');
		expect(callout.innerHTML).toBe(before);
		dom.window.close();
	});
});
