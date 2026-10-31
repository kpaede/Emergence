# Aktueller Prüfstand

Stand: 31. Oktober 2026. Emergence 0.1.0, Desktop-Entwicklungsstand; keine Release-Veröffentlichung.

## Oberfläche und Originalansichten

Die Hauptnavigation lautet **Graph** (network), **Feldideen** (text-search), **Recherche** (list-plus), **Suche** (search). Alle Tabs haben Textbeschriftungen; in schmalen Panels stehen die Symbole darüber. Der Such-Tab hat einen zugänglichen Namen und Tooltip; Tastaturnavigation bleibt erhalten. Begriffsregister und separater Prüfen-Tab bleiben entfernt.

Als eigene Visualisierung enthält der Graph-Tab ausschließlich die **Relationssynopse**. Die zusätzlichen eigenen Modi Verbindungspfade und Nachbarschaft/Links sowie deren Anzeigegrenzen sind aus der Oberfläche entfernt. Bestehende Einstellungen und Graph-Daten bleiben lesbar; es gibt keine Notiz- oder Frontmatter-Migration.

Das Dropdown **Ansicht** beginnt mit der vorausgewählten **Relationssynopse**. Es zeigt genau eine Ansicht; nur die ausgewählte native View wird geladen. Sie füllt die verbleibende Seitenpanelfläche rahmenlos bis zum unteren Rand. Zusätzliche Kartenrahmen und feste Pixelhöhen entfallen. Die weiteren Optionen verwenden die tatsächlich registrierten Original-Renderer:

| Ansicht | Voraussetzung | Notizkontext |
| --- | --- | --- |
| `bc-matrix-view` | Breadcrumbs aktiviert | Breadcrumbs-eigener aktueller Notizkontext |
| `bc-tree-view` | Breadcrumbs aktiviert | Breadcrumbs-eigener aktueller Notizkontext |
| `zotlit-references` | ZotLit aktiviert | ZotLit-eigenes Literaturverzeichnis der aktuellen Notiz |
| `localgraph` | Obsidian-Core-Plugin Graph aktiviert und Markdown-Notiz vorhanden | explizit `setState({file: ...})` für die Hauptnotiz |

Matrix und Baum sind die beiden von der installierten Breadcrumbs-Version registrierten Seitenansichten. Deren originale Bedienelemente bleiben erhalten. ZotLit formatiert sein Literaturverzeichnis selbst mit seinem eingerichteten Zitationsstil. Der Obsidian-Gesamtgraph wird nicht eingebettet. Beim Erkunden der Synopse bleibt der Kontext dieser Originalansichten die geöffnete Hauptnotiz.

`src/ui/native-views.ts` kapselt den versionsabhängigen Zugriff auf die registrierten View-Factories und den nativen Open-/Close-Lebenszyklus. Die öffentliche Obsidian-API bietet keine allgemeine Einbettung fremder Workspace-Views an. Deshalb werden Existenz und Methoden geprüft und Fehler im betreffenden Abschnitt angezeigt. Jede ausgewählte Instanz erhält einen isolierten Container und eine Leaf-Fassade mit eigenen Events. Es werden keine vorhandenen Plugin-Tabs umgehängt oder zusätzliche Workspace-Leaves für die Einbettung erzeugt. ResizeObserver und originale View-Komponenten werden beim Schließen aufgeräumt. Ein deaktiviertes Core-Plugin wird vor dem Factory-Zugriff ausgeschlossen und niemals durch Emergence aktiviert.

Technische Orientierung: [offizielle Obsidian-API](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts), [Obsidian-Lebenszyklus und Ressourcenverwaltung](https://docs.obsidian.md/plugins/guides/lifecycle-management), [ZotLit-References-View](https://github.com/aidenlx/zotlit/tree/main/apps/obsidian/src/views/references). Die Einbettung ist mit der vorhandenen Obsidian-Desktop-Umgebung, Breadcrumbs 4.22.1 und ZotLit 2.2 geprüft; sie ist keine Zusage für beliebige zukünftige Plugin-Versionen.

## Felder und Quellen

Nur eine Aufklappebene. Fünf beschriftete Auswahlknöpfe öffnen Obsidian-eigene Menüs mit Häkchen für die tatsächlich vorhandenen Breadcrumbs-Felder. Mehrfachzuordnungen bleiben erhalten und können einzeln hinzugefügt oder entfernt werden. Es gibt keine HTML-Mehrfachauswahllisten mit schmalen inneren Scrollbalken mehr. Literatur und freie Verweise zeigen nur ihre festen Quellen ZotLit bzw. Notizlinks. Offene native Menüs werden beim Wechseln oder Schließen aufgeräumt. Einstellungen werden weiterhin im bestehenden `synopsis.fields`-Format gespeichert.

## Literatur und Kopieren

Literaturangaben in Synopse und Suche verwenden ZotLits tatsächlichen `BibliographyRender.readBibliography`-Dienst aus seinem bestehenden Runtime-Kontext, mit dem dort ausgewählten CSL-Stil. Es werden keine Zitationsbestandteile oder Trennzeichen selbst zusammengesetzt. Die von ZotLit formatierte Pandoc-Inline-AST wird als Text, Kursiv-/Fettdruck und weitere Inline-Elemente dargestellt; Roh-HTML wird nicht interpretiert und Links innerhalb einer Angabe behalten die übergeordnete Library-Aktion. Die vorhandenen ZotLit-Felder für Notizstil, Sprache und Importprofil werden übernommen.

ZotLits `getDocumentCitationSet` liefert die CSL-Daten der aktuellen Notiz offline und vollständig, damit die bibliografische Disambiguierung dieselbe Grundlage wie das Originalverzeichnis hat. Für bislang unzitierte Library-Treffer liefert Zotero kanonisches CSL-JSON über die bestehende lokale API und ZotLits eigenen HTTP-Client. Port und Aktivierung werden aus ZotLits realem Präferenzdienst gelesen; nichts wird eingeschaltet oder umgestellt. Ein echter zuvor unzitierter Suchtreffer wurde erfolgreich formatiert. Ist Zotero hierfür geschlossen oder seine lokale API deaktiviert, erscheint ein knapper Status statt einer selbst erfundenen Ersatzformatierung. Die vorhandene Literaturidentität, Library-Aktion und Kopierfunktion bleiben erhalten.

Der direkte native Vergleich bestätigt für die aktive Testnotiz **denselben Wortlaut und dieselben Kursivsetzungen wie ZotLits Originalverzeichnis**. Die frühere eigene Autoren-/Jahres-Kurzform wurde entfernt.

Der bibliografische Eintrag öffnet den zugehörigen Datensatz mit ZotLits eigener `showInLibrary.show(indexedKey)`-Aktion. Darunter steht eine separate Citekey-Schaltfläche mit Lucide-Kopiersymbol. Sie kopiert ausschließlich den Schlüssel im konfigurierten Format: `[@citekey]`, `@citekey` oder `citekey`. Die Voreinstellung bleibt `[@citekey]`. Literaturangaben öffnen auch im Suchmodus „Erkunden“ ihre Library; Markdown-Notizen lassen sich weiterhin im Graphen erkunden. Mittelklick öffnet Notizlinks in einem neuen Tab, Literaturangaben sind davon ausgenommen.

Fehlende oder mehrdeutige Literaturdaten erhalten einen sachlichen Status und den kopierbaren Schlüssel. Titel werden nicht aus Citekeys erfunden. ZotLit-Zitate bleiben Literatur und werden nicht zusätzlich als freie Textverweise einsortiert. Virtuelle Zitate ohne Markdown-Datei werden nicht zu Notiz-Knoten. Bei bestehenden Literaturnotizen bleiben auch weitere Relationsschritte und deren Sichttiefe erhalten. Mehrere Zotero-Einträge an derselben Notiz führen bei Wikilink-Zitaten nicht zur willkürlichen Auswahl eines Metadatensatzes.

Die globale Zotero-Suche bleibt unabhängig von Ordnern, aktiven Sammlungen und ZotLits gespeicherter Library-Auswahl und übergibt alle verfügbaren Libraries einschließlich Gruppen. Der Adapter verändert weder ZotLits Einstellungen noch dessen Datenbank.

## Breadcrumbs-Anzeige aus dem Screenshot

Die technischen Texte `field`, `explicit`, `source`, `implied_kind` und `round` waren in Breadcrumbs als sichtbare Baum-Kantenattribute ausgewählt. Sie sind Metadatenanzeigen, kein Nachweis beschädigter Beziehungen. Im Entwicklungs-Vault wurde ausschließlich `views.side.tree.show_attributes` auf eine leere Liste gesetzt und über Breadcrumbs selbst gespeichert und aktualisiert.

Der Vergleich bestätigt: **nur diese Anzeigeoption geändert; Breadcrumbs-Felder und Ableitungsregeln unverändert**. Notizdateien wurden nicht geschrieben. Der Emergence-Produktionscode setzt keine Breadcrumbs-Anzeigeoptionen. Aus dem vorgefundenen Zustand lässt sich nicht bestimmen, wodurch die ursprüngliche Auswahl entstanden war.

## Build und Tests

- `npm run build`: TypeScript und Produktionsbundle erfolgreich.
- `npm test`: **220 bestanden**, fünf optionale Ollama-Tests übersprungen. Zehn neue Regressionen decken originale CSL-Ausgabe, Stil-/Sprachweitergabe, ungültige Stile ohne Fallback, kanonische CSL-Daten für Suchtreffer sowie echte bibliografische Metadaten, fehlende Titel ohne Erfindungen, virtuelle Zitate ohne Markdown-Datei, tiefere Literaturbeziehungen und mehrdeutige Notizzuordnungen ab.
- `npm run lint`: keine Fehler; drei bestehende Warnungen zur deklarativen Einstellungssuche und Timern im Wikipedia-Test.
- `npm run test:synopsis`: acht Kombinationen aus 280/328 Pixeln, heller/dunkler Darstellung und 100/200 Prozent Schrift bestanden. Je 165 Notizdarstellungen; kein horizontaler Überlauf, keine Linien durch Beschriftungen, durchgängige Liniengrammatik, gleiche Höhen der gegenüberliegenden Überschriften und Bedienelemente. Weitere tiefe Pfade und Kreise, unabhängige Sichttiefen, echte Editor-Navigation, Erkunden und Persistenz geprüft. Die Ausgangsnotiz blieb bytegleich. Zwölf lokale Screenshots.
- `npm run test:workspace`: echte Notiz- und Library-Suche, Öffnen/Erkunden, Mittelklick, Frontmatter-Reihenfolge von vier befüllten Listen und Fortsetzung einer synthetisch gekürzten Recherche bestanden. Nutzereinstellungen, Verlauf und Dateibestand unverändert; keine Notiz geschrieben.
- `npm run test:native-views`: vorausgewählte Synopse und einzelne Dropdown-Auswahl, originale Renderer mit eigenen Instanzen und Bedienelementen, unveränderte Anzahl Workspace-Leaves, unveränderte Haupt-View, Entladen abgewählter nativer Komponenten, Graph deaktiviert ohne Factory-Zugriff und alle drei Kopierformate ohne Navigation, eine einzige Quellen-Aufklappung und die fünf nativen Feldauswahlmenüs bestanden. Wortlaut und Kursivsetzungen stimmen im direkten Vergleich mit ZotLit überein. Der lokale Graph startet mit lesbarem Maßstab auf der aktuellen Notiz, zentriert sich beim Notizwechsel neu und erhält anschließendes manuelles Zoomen. Vier Kombinationen aus 280/328 Pixeln und hell/dunkel, jeweils alle vier Originalansichten, ohne horizontalen Überlauf, über die volle Breite und Höhe der verfügbaren Fläche; alle Tabs bleiben beschriftet und lesbar. Einstellungen und Dateibestand unverändert. 28 lokale Screenshots.

Die Zwischenablage wurde in den Kopiertests abgefangen und anschließend wiederhergestellt; der tatsächliche Zwischenablageinhalt blieb erhalten. Native Tests verwenden die laufende Entwicklungsinstanz und `OBSIDIAN_VAULT`. Lokale Berichte und Screenshots liegen in `docs/native-views/` und `docs/relationssynopse/`; sie können Vault-Bezüge enthalten und werden bewusst nicht veröffentlicht.

Die vorhandene Umgebung erzeugt beim Notizwechsel gelegentlich `provider destroyed` aus Media Extended. Ein früherer Vergleich mit gewöhnlicher Obsidian-Navigation reproduziert dieselbe Meldung. Auch die aktuellen Tests protokollieren sie getrennt; Emergence unterdrückt oder verändert das Fremdplugin nicht. Keine neuen JavaScript-Fehler in den erfolgreichen UI-Prüfungen.

## Weiterhin erhaltene Funktionen und Grenzen

Frontmatter-Reihenfolge, die sieben Relationsgruppen, zusätzliche tatsächliche Breadcrumbs-Felder, Plus-Aktionen, native Link-/Unresolved-Stile, kurze eindeutige Wikilinks, kontrollierter Writer und Änderungsjournal bleiben erhalten. Explizite Fakten werden nur einmal in Gegenrichtungen abgeleitet; generisches „Werk“ wird nicht willkürlich allen Urheberrollen zugeordnet. Neue Zielbegriffe erzeugen nur Wikilinks.

Feldideen bleiben eine lokale Assoziationshilfe mit bis zu vier Begriffen je ausgewähltem Feld. Recherche liefert einzelne übernehmbare Beispiele oder Kunstwerke und optional freie Textantworten mit eigenem Ausgabebudget und Fortsetzung. Unvollständige strukturierte Analysen bleiben gesperrt. Gesprächsverlauf wird nur ausdrücklich einbezogen. Optionale Wikipedia- und DuckDuckGo-Kontexte, bearbeitbare Profile und Feldbeschreibungen bleiben erhalten; es wurden für diese Oberflächenänderungen keine neuen Modellanfragen benötigt.

Die Qualität von Modellideen bleibt modellabhängig. Die ZotLit-Services und die native View-Einbettung sind versionsabhängige Adapter. Allgemeine Kompatibilität mit beliebigen Vaults, Mobile und eine Community-Release-Abnahme sind nicht Teil dieser Prüfung. Build-Artefakte, persönliche Konfiguration und lokale Prüfdaten werden nicht committed.
