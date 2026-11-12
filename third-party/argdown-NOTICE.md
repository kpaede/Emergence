# Argdown integration

Emergence bundles the unmodified official Argdown processor and the embedded WebAssembly Graphviz renderer for local, offline use. The editor integration itself is new code, informed by the APIs used in amdecker/obsidian-argdown-plugin; no code or CDN loader from that plugin is included.

- `@argdown/core` 2.0.1: MIT, copyright (c) 2017 Christian Voigt. License: `argdown-LICENSE.txt`. Source: https://github.com/argdown/argdown/tree/master/packages/argdown-core
- `@hpcc-js/wasm-graphviz` 1.30.0: Apache-2.0. License: `wasm-graphviz-LICENSE.txt`. Source and build instructions: https://github.com/hpcc-systems/hpcc-js-wasm/tree/38c02500fb2c8cf1247d9eec3317cb606a3c76d2
- Embedded Graphviz 16.1.0: Eclipse Public License 2.0. License: `graphviz-LICENSE.txt`. Corresponding source, provided under EPL-2.0, is available at https://gitlab.com/graphviz/graphviz/-/tree/16.1.0 . The embedded renderer is supplied unchanged through the package above.

These component licenses and source references are also included in the production bundle. The plugin's own source license does not replace them. No diagram source or note content is sent to an external renderer.

The supplied guide-debate example is credited in its front matter to Gregor Betz (24 October 2018), from the Argdown introduction at https://argdown.org/ . It is included as an editable example and regression fixture.
