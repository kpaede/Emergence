# Navigation, Library-Suche und Relationsreihenfolge

Stand: 31. Oktober 2026. Emergence 0.1.0, Entwicklungsstand; keine Release-Veröffentlichung.

## Umgesetzt

- Hauptnavigation: **Suche**, **Graph**, **Analyse**, **Recherche**. Die Suche steht mit Lupensymbol an erster Stelle. Begriffsregister und separater Prüfen-Tab sind entfernt; bestehende Vorschläge bleiben in der Analyse prüfbar.
- Globale Suche über Markdown-Titel, Aliase und Tags sowie ZotLits tatsächliche Item-Suche. Die Zotero-Suche übergibt ausdrücklich alle verfügbaren Libraries einschließlich Gruppen, unabhängig von Ordnern, aktiven Sammlungen und ZotLits gespeicherter Library-Auswahl. Die Suchsitzung wird bei überholten Eingaben geschlossen; späte Ergebnisse ersetzen keine neuere Suche.
- Öffnen/Erkunden in der Suche, bestehender Erkunden-Schalter im Graphen. Zotero-Treffer ohne Literaturnotiz lassen sich als tatsächlicher Literaturdatensatz im freien Netz betrachten; es wird keine Markdown-Datei erfunden oder angelegt.
- ZotLit-Klicks verwenden dessen eigene `showInLibrary.show(indexedKey)`-Aktion. Bei Literatur-Notizen wird der vorhandene Note Index verwendet; bei Citekeys die vorhandene Citation Lookup-Auflösung. Mehrdeutige oder fehlende Zuordnungen werden gemeldet. Keine automatische Literatur-Notizerstellung.
- Mittelklick auf Notizlinks öffnet einen neuen Tab: Synopse, Suche, Pfade und freies Netz. Ein expliziter Mittelklick hat Vorrang vor dem Erkunden-Modus. Literaturangaben bleiben von dieser Zusatzaktion ausgenommen.
- Synopse verwendet die Linkreihenfolge des vorhandenen Frontmatters einschließlich numerischer Listenpositionen, qualifizierter Pfade, Aliase und noch fehlender Ziele. Direkt gespeicherte Beziehungen stehen vor ausschließlich abgeleiteten Gegenrichtungen. Kein neues Frontmatter-Feld und keine gespeicherten Sortierdaten.
- Linien für tiefe, umbrochene Beschriftungen berücksichtigen alle Textfragmente, damit eine lange erste Zeile nicht durch einen an der letzten Zeile berechneten Anschluss geschnitten wird.
- Recherche-Ausgabe hat ein vom Klassifikationslimit getrenntes Budget, das in den verfügbaren Kontext passt. Keine Kürzung der gewählten Notiz. Nur abgeschlossene HTTP-Antworten mit `done_reason: length` und nichtleerem Text dürfen als gekürzte Forschungsantwort angezeigt werden. Unvollständige strukturierte Analysen bleiben gesperrt.
- **Antwort fortsetzen** verwendet genau die ausgewählte Frage, ihren bisherigen Antworttext und ihren ursprünglichen Kontext. Es wird kein anderer Sitzungsverlauf automatisch angehängt. Fortsetzungen bleiben reine Anzeige und schreiben keine Notizen.
- README beschreibt persönlichen Projektcharakter, Voraussetzungen, Installation, vier Arbeitsbereiche, Datenflüsse und Grenzen.

## Architektur und Schnittstellen

Die Obsidian-Seitenpanel-View bleibt ein `ItemView`. Hauptnotizen werden über Workspace-Leaves und `openFile` geöffnet; neue Tabs über `getLeaf('tab')`; fehlende Ziele gehen erst bei ausdrücklichem Öffnen an `openLinkText`. Icons stammen aus Obsidian. Der bestehende Frontmatter-Writer und das Änderungsjournal bleiben erhalten.

Die Reihenfolge wird beim Aufbau des vorhandenen Graph-Snapshots aus `MetadataCache.frontmatterLinks` gelesen und ausschließlich im Arbeitsspeicher auf bestehende Kanten angewendet. Die Datenstruktur der Notizen bleibt unverändert.

Die ZotLit-Anbindung ist ein kleiner Adapter gegen die in ZotLit 2.2 vorhandenen Services. `itemLookup.openSession()` liefert eine abbrechbare Promise-Suche; `libraryScope.state.all.available` bezeichnet die vollständige Library-Liste. Dieser Adapter verändert weder ZotLits Einstellungen noch dessen Datenbank. Ohne kompatible Services bleibt die Notizsuche nutzbar und der Literaturbereich zeigt die fehlende Anbindung an.

Referenzen:

- [Offizielle Obsidian-API](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts): ItemView, Workspace, MetadataCache, Keymap und native Icons.
- [ZotLit Item Lookup](https://github.com/aidenlx/zotlit/tree/main/apps/obsidian/src/services/item-lookup): eigene Suchsitzungen, explizite Libraries und Promise-Fassade.
- [ZotLit Library Scope](https://github.com/aidenlx/zotlit/tree/main/apps/obsidian/src/services/library-scope): aktueller und vollständiger Library-Bereich.
- [Ollama Chat API](https://docs.ollama.com/api/chat): Textantwort und Abschlussgrund.

## Prüfungen

- `npm run build`: TypeScript und Produktionsbundle erfolgreich.
- `npm test`: **190 bestanden**, fünf optionale Ollama-Tests standardmäßig übersprungen. Enthalten sind Regressionen für Reihenfolge, unveränderte Metadaten, vollständige Library-Auswahl, Abbruch überholter Suchen, Library-Navigation, eindeutige Ziele und die strikte Trennung zwischen gekürzter Recherche und unvollständiger Analyse.
- `npm run lint`: keine Fehler; drei bestehende Warnungen zur deklarativen Obsidian-Einstellungssuche und zu Timern in einem Wikipedia-Test.
- Native Workspace-Prüfung: vier Tabs, Suchsymbol, entfernte Graph-Suche, Mittelklick in Synopse und Suche, echte Zotero-Treffer, tatsächliche Auswahl des Library-Eintrags, Erkunden-Wechsel und Fortsetzung einer synthetisch gekürzten Antwort erfolgreich. Die vier befüllten Relationslisten der aktiven Testnotiz stimmen mit dem Frontmatter überein. Einstellungen, Benutzerverlauf und Dateibestand blieben unverändert; keine Notiz geschrieben.
- Echte lokale Modellprüfung mit `qwen3.5:9b`: eine künstlich auf 16 Ausgabetokens begrenzte Antwort blieb als Teiltext erhalten; „Frage senden“ lieferte eine vollständige Antwort auf eine kurze synthetische Frage. Zusammen rund 16 Sekunden; kein Notiztext gesendet, kein Benutzerverlauf verändert.
- Suche, Analyse und Recherche zusätzlich bei 280 und 328 Pixeln auf horizontalen Überlauf geprüft: sechs Fälle erfolgreich, sechs lokale Screenshots.
- Native Synopsen-Prüfung: **acht Fälle** bei 280/328 Pixeln, hell/dunkel und 100/200 Prozent Schrift. Jeweils 165 Notizverweise, keine horizontalen Überläufe und keine Linien durch Beschriftungen. Zusätzlich zwei Fälle mit 24 weiteren Tiefenstufen und Kreisen bei Sichttiefe ∞ erfolgreich. Zwölf lokale Screenshots; normale Navigation, Erkunden und Speicherung der getrennten Sichttiefen erfolgreich.

Ausführbare Prüfskripte: `scripts/workspace-native-check.mjs`, `scripts/research-native-check.mjs` und `scripts/synopsis-native-check.mjs`. Native Tests benötigen eine laufende Entwicklungsinstanz und `OBSIDIAN_VAULT`. Lokale Berichte und Screenshots enthalten eventuell Vault-Bezüge und werden nicht veröffentlicht.

## Bekannte Grenzen

Die Integration ist mit der vorhandenen ZotLit-Version geprüft; deren interne Services sind keine dauerhaft zugesicherte öffentliche API. Die philosophische Qualität von Modellantworten ist weiterhin vom Modell und Kontext abhängig. Allgemeine Kompatibilität mit beliebigen Vaults, Mobile und eine Community-Release-Abnahme sind nicht Teil dieser Prüfung.

Die vorhandene Umgebung erzeugt beim nativen Notizwechsel gelegentlich `provider destroyed` aus Media Extended. Der Vergleich mit gewöhnlicher Obsidian-Navigation reproduziert dieselbe Fremdplugin-Meldung. Emergence unterdrückt sie nicht und verändert das andere Plugin nicht.
