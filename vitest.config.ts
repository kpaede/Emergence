import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
export default defineConfig({test:{setupFiles:['./tests/helpers/locale.ts']},resolve:{alias:{obsidian:fileURLToPath(new URL('./tests/helpers/obsidian-runtime.ts',import.meta.url))}}});
