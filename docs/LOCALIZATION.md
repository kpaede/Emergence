# Interface languages and settings

Emergence uses Obsidian's native declarative settings API. The root of **Settings → Emergence** contains the interface language and five navigable pages in this order: **Graph**, **Field ideas**, **Mermaid**, **Argdown**, **Search**. The former Model, Relations, Profiles and Data pages are nested under Field ideas. Each page has an independent activation switch. Disabled areas and their commands/editor actions are hidden, while saved preferences and existing drafts are preserved. The Graph page has an interactive sample rendered by the same component as the actual Graph; headings, positions, ordering, depth and field mappings are independently configurable. Diagram appearance remains in each diagram's source; its settings page explains this and provides a native vault-folder control for Markdown template notes. Opening editors from the settings pages is intentionally omitted.

## Language selection

`settings.uiLanguage` is `auto`, `de` or `en`. New installations follow Obsidian via its public `getLanguage()` API. Unsupported Obsidian languages fall back to English. German regional language codes resolve to German. Upgrading a previously German installation without a preference keeps German. The dropdown displays the endonyms **Deutsch** and **English**.

A preference is saved independently of feature-setting drafts. It takes effect immediately: existing diagram editor instances, source, selections and undo stacks are preserved. Static chrome is relabeled, generated views are refreshed and CodeMirror updates its accessible label through a compartment without replacing its document. Native settings definitions/search are updated through the public API. Discarding an unrelated feature draft does not undo the language choice. Persistence errors restore the previous preference.

The interface language is separate from `Profile.language` and output-module languages. Switching it does not translate note contents, field names, profile names, authored instructions, custom templates or existing diagram source. New starter diagrams and newly created placeholder labels use the selected language. Existing source, custom templates and the credited Pele/Argdown guide examples remain unchanged; their menu labels are localized. Embedded Obsidian, Breadcrumbs and ZotLit views keep their own language behavior. Emergence does not rewrite another plugin's DOM.

## Translation structure

The standard [i18next](https://www.i18next.com/overview/configuration-options) library is bundled locally. There is no translation service, backend, CDN or runtime resource download. Resources are split by feature under `src/i18n/locales/en/` and `src/i18n/locales/de/`. English is the canonical catalog and fallback. German implements the same key set, checked by TypeScript and tests.

UI code calls the typed `t()` helper from `src/i18n/index.ts` (usually imported as `tr` to avoid shadowing Obsidian text-control variables). Keys remain stable even when wording changes. Complete messages use named `{{parameters}}`; user values are passed as parameters, never used as keys. Dynamic text is inserted as text, not as HTML. Module-level label tables use getters or factories so they are resolved after the saved preference is loaded.

Plural messages use i18next's current JSON/CLDR `_one` and `_other` forms and pass a numeric `count`; the selected form follows `Intl.PluralRules`. UI-specific number and date/time helpers use `Intl` with the selected locale. Source code, numeric configuration values and citation formatting keep their original representation. [Plural documentation](https://www.i18next.com/translation-function/plurals)

## Adding or changing translations

1. Add or update the English message in the appropriate feature catalog. Keep its key stable; add the same key to German.
2. Pass variable values as named parameters. Translate the complete sentence, allowing word order to differ; do not build sentences from grammatical fragments.
3. For a count-dependent message, supply `_one` and `_other` and call the base key with `{count}`. Add further CLDR forms when introducing a language that needs them.
4. To introduce another language, add its resource catalogs, register its code and endonym in the locale registry/settings, and extend `resolveLocale` and its tests. Do not infer interface language from a note's content or the operating system.
5. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and the native `npm run test:i18n-ui` check.

The catalog tests verify identical keys and interpolation parameters, English fallback, overrides, plural forms, display formatting and migration without changing authored content. The native check verifies both languages, settings search, independent preference persistence, preservation of feature drafts, forty compact settings layouts, translated editor dialogs and unchanged source/custom templates. It restores the previous language and diagram sessions afterward.

## References

- [Obsidian declarative settings](https://docs.obsidian.md/Plugins/User+interface/Settings)
- [Obsidian API types, including `getLanguage()`](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts)
- [Obsidian translation conventions](https://github.com/obsidianmd/obsidian-translations)
- [i18next configuration](https://www.i18next.com/overview/configuration-options)
- [i18next plural forms](https://www.i18next.com/translation-function/plurals)

The bundled i18next MIT license is in `third-party/i18next-LICENSE.txt` and in the production bundle.
