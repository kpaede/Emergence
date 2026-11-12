import {describe, expect, it, vi} from 'vitest';
import {JSDOM} from 'jsdom';
import type {Menu} from 'obsidian';
import {showDiagramMenu} from '../src/diagrams/menu';
describe('Diagram button menu anchoring', () => {
 it('uses the button position for a keyboard click with zero pointer coordinates', () => {
  const window = new JSDOM('<button>Abschnitt</button>').window, anchor = window.document.querySelector('button')!, showAtPosition = vi.fn();
  vi.stubGlobal('HTMLElement', window.HTMLElement); vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({left: 350, bottom: 240, width: 20, height: 20} as DOMRect);
  try {showDiagramMenu({showAtPosition} as unknown as Menu, new window.MouseEvent('click'), anchor); expect(showAtPosition).toHaveBeenCalledWith({x: 350, y: 244});} finally {vi.unstubAllGlobals();}
 });
 it('does not show an orphaned menu when its button is detached or hidden', () => {
  const window = new JSDOM('<button>Abschnitt</button>').window, anchor = window.document.querySelector('button')!, showAtPosition = vi.fn(); vi.stubGlobal('HTMLElement', window.HTMLElement);
  try {showDiagramMenu({showAtPosition} as unknown as Menu, new window.MouseEvent('click'), anchor); anchor.remove(); showDiagramMenu({showAtPosition} as unknown as Menu, new window.MouseEvent('click'), anchor); expect(showAtPosition).not.toHaveBeenCalled();} finally {vi.unstubAllGlobals();}
 });
});
