# EOME: strukturelle Überschriften in eingebetteten Listen

Seit **EOME 0.2.5** besitzt jede `MindmapView` die öffentliche Instanzoption
`supportsStructuralHeadings = true`. Emergence setzt sie in `hostedNativeView()`
ausschließlich auf der eingebetteten EOME-Instanz auf `false`, vor dem Öffnen der View.
Eigenständige EOME-Views behalten `true`.

Bei `false` bietet EOME **Add heading for this tree** nicht an. Auch ein direkter
Aufruf von `executeAddHeadingCommand()` verändert nichts. Andere Menüaktionen und
Markdown-Überschriften innerhalb mehrzeiliger Einträge bleiben verfügbar.

Der Schalter wird weder im Markdown noch in globalen EOME-Einstellungen gespeichert.
Emergence verändert dafür keine privaten Menüs, laufenden Methoden oder gemeinsamen
Prototypen. Der vorhandene Speicherschutz bleibt unabhängig davon bestehen.

EOMEs eigene Regressionstests decken Standardverhalten, blockierte Commands,
unabhängige Views und Inhaltsüberschriften ab. Emergence prüft zusätzlich die
Instanzgrenze in `tests/companion-hosted-view.test.ts` und die reale Einbettung in
`scripts/companion-outline-size-native-check.mjs`.

Die Datei `eome-host-capability.patch` bleibt als historische Übergabevorlage auf
Basis von 0.2.4 erhalten. Sie muss seit 0.2.5 nicht mehr angewendet werden. Bei älteren
EOME-Versionen ohne diese Schnittstelle wird sie nicht vorgetäuscht; dort bleibt der
Menüpunkt sichtbar und der Speicherschutz verhindert Änderungen der Abschnittsstruktur.
