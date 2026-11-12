import {t as tr} from '../i18n';
/** Argdown accepts HEX colors; resolve the shared CSS palette and RGB inputs locally. */
export function argdownColor(color: string): string {
 if (/^#[\da-f]{6}$/iu.test(color)) return color.toLowerCase();
 if (!CSS.supports('color', color)) throw new Error(tr("argdown.select_a_valid_css_color"));
 const canvas = createEl('canvas'); canvas.width = canvas.height = 1; const context = canvas.getContext('2d');
 if (!context) throw new Error(tr("argdown.the_color_could_not_be_resolved"));
 context.fillStyle = '#ffffff'; context.fillRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
 const pixel = context.getImageData(0, 0, 1, 1).data;
 return '#' + [...pixel].slice(0, 3).map(value => value.toString(16).padStart(2, '0')).join('');
}
