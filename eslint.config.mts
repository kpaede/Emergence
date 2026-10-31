import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'scripts',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ['src/**/*.ts'],
		rules: {
			// German nouns retain capitals; English sentence-case heuristics do not apply.
			'obsidianmd/ui/sentence-case': 'off',
			// AbortSignal and bounded streaming reads are required for local Ollama requests.
			'no-restricted-globals': 'off',
		},
	},
	{
		// These environment-independent modules run in Node and Obsidian. Timers are
		// explicitly cancelled with their owning requests/layouts, not with a popout.
		files: ['src/llm/provider.ts', 'src/graph/render.ts'],
		rules: {'obsidianmd/prefer-window-timers': 'off'},
	},
 {
  // Native DOM regression fixtures run in jsdom, where Obsidian's createEl helpers do not exist.
  files: ['tests/disclosure-state.test.ts'],
  rules: {'obsidianmd/prefer-create-el': 'off'},
 },
);
