import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'docs',
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
		},
	},

 {
  // Native DOM regression fixtures run in jsdom, where Obsidian's createEl helpers do not exist.
  files: ['tests/disclosure-state.test.ts','tests/helpers/dom.ts','tests/literature-reference.test.ts','tests/term-assignment-ui.test.ts'],
  rules: {'obsidianmd/prefer-create-el': 'off'},
 },
);
