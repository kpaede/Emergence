import {describe, expect, it, vi} from 'vitest';
import {DEFAULT_PATTERN, TetradStore} from '../src/tetrad/patterns';
import {mountTetrad} from '../src/tetrad/render/layout';
import type {ParsedTetrad} from '../src/tetrad/render/parse';
import {tetradDom} from './helpers/tetrad-dom';

describe('Tetrader graphical entries', () => {
	it('splits only direct list items, retains complete nested items and reverses upper glosses visually', () => {
		const dom = tetradDom('<div class="callout"><div class="callout-content"><h2>Enhances</h2><p>Core</p><ul class="contains-task-list"><li class="task-list-item"><input type="checkbox"><p>Parent paragraph</p><p>Continuation</p><ul><li>Nested A</li><li>Nested B</li></ul></li><li><a href="Target">Second entry</a></li></ul><blockquote><ul><li>Quoted A</li><li>Quoted B</li></ul></blockquote><h2>Retrieves</h2><p>Lower core</p><ol start="4"><li>Fourth</li><li value="9">Ninth</li></ol></div></div>');
		const callout = dom.window.document.querySelector<HTMLElement>('.callout')!, before = callout.innerHTML;
		const originalList = callout.querySelector('ul')!, originalItem = originalList.firstElementChild!;
		const checkbox = originalItem.querySelector('input')!, change = vi.fn(); checkbox.addEventListener('change', change);
		const store = new TetradStore(undefined, async () => {});
		const layout = mountTetrad(callout, store.settings(DEFAULT_PATTERN), DEFAULT_PATTERN);
		const upper = Array.from(callout.querySelectorAll<HTMLElement>('.tetrader-enhances .tetrader-gloss'));
		expect(upper.map(entry => entry.dataset.emEntryIndex)).toEqual(['3', '2', '1']);
		expect(upper.map(entry => entry.dataset.tetraderDistance)).toEqual(['2', '1', '0']);
		expect(upper[0]!.querySelectorAll('blockquote li')).toHaveLength(2);
		expect(upper[2]!.querySelector(':scope > ul > li')).toBe(originalItem);
		expect(upper[2]!.querySelectorAll(':scope > ul > li > p')).toHaveLength(2);
		expect(upper[2]!.querySelectorAll(':scope > ul > li > ul > li')).toHaveLength(2);
		expect(upper[2]!.querySelector('input')).toBe(checkbox);
		checkbox.dispatchEvent(new dom.window.Event('change')); expect(change).toHaveBeenCalledTimes(1);
		const core = callout.querySelector<HTMLElement>('.tetrader-enhances .tetrader-core')!;
		expect(core.dataset.emCore).toBe('true'); expect(core.dataset.emEntryIndex).toBe('0');
		const lower = Array.from(callout.querySelectorAll<HTMLElement>('.tetrader-retrieves .tetrader-gloss'));
		expect(lower.map(entry => entry.dataset.emEntryIndex)).toEqual(['1', '2']);
		expect(lower.map(entry => entry.querySelector('ol')?.getAttribute('start'))).toEqual(['4', '9']);
		layout.destroy();
		expect(callout.innerHTML).toBe(before);
		expect(callout.querySelector('ul')).toBe(originalList);
		expect(originalList.firstElementChild).toBe(originalItem);
		checkbox.dispatchEvent(new dom.window.Event('change')); expect(change).toHaveBeenCalledTimes(2);
		dom.window.close();
	});

	it('uses explicit model entries and their indices without interpreting their DOM boundaries again', () => {
		const dom = tetradDom('<div class="callout"><div class="callout-content"><p>Core</p><ul><li>A</li><li>B</li></ul></div></div>');
		const callout = dom.window.document.querySelector<HTMLElement>('.callout')!;
		const core = callout.querySelector('p')!, list = callout.querySelector('ul')!;
		const structure: ParsedTetrad = {preamble: [], duplicates: new Set(), sections: new Map([['enhances', {
			nodes: [core, list], coreEntry: {index: 4, nodes: [core]}, glossEntries: [{index: 2, nodes: [list]}],
		}]])};
		const store = new TetradStore(undefined, async () => {});
		const layout = mountTetrad(callout, store.settings(DEFAULT_PATTERN), DEFAULT_PATTERN, structure);
		expect(callout.querySelectorAll('.tetrader-enhances .tetrader-gloss')).toHaveLength(1);
		expect(callout.querySelector<HTMLElement>('.tetrader-enhances .tetrader-gloss')?.dataset.emEntryIndex).toBe('2');
		expect(callout.querySelector<HTMLElement>('.tetrader-enhances .tetrader-core')?.dataset.emEntryIndex).toBe('4');
		expect(callout.querySelectorAll('.tetrader-enhances .tetrader-gloss li')).toHaveLength(2);
		layout.destroy(); dom.window.close();
	});
});
