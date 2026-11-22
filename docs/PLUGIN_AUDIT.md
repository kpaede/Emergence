# Kritischer Prüfdurchgang des gesamten Plugins

Stand: 22. November 2026. Geprüft wurde der lokale Entwicklungsstand von Emergence 0.0.4 in Obsidian Desktop 1.15.1 unter macOS. Dies ist kein neuer Release.

## Offene Korrekturen für die Fortsetzung nach dem Zwischencommit

Die zuletzt festgelegte Speicherregel ist noch nicht vollständig umgesetzt:
Scheitert das Speichern, wird die Änderung nicht übernommen; die Ansicht muss
den tatsächlich gespeicherten Stand zeigen und den Fehler verständlich melden.
Der vorhandene Entwurfs- und Sicherungsablauf soll aus diesem Ablauf entfernt
werden. Die weiter unten dokumentierten Entwurfsprüfungen beschreiben den
bisherigen Implementierungsstand und gelten nicht als gewünschtes Bedienkonzept.

Außerdem sollen EOMEs Funktionen zum Anlegen und Ändern von Kapitelüberschriften
in der eingebetteten Gedankenansicht nicht angeboten werden. Markdown-
Überschriften innerhalb eines Gedankentextes bleiben möglich. Auch diese
Anpassung ist noch offen. Neue Bedienkonzepte, zusätzliche Dateien und Änderungen
an den Speicherregeln werden vor einer Umsetzung mit dem Nutzer abgestimmt.

## Gesamturteil

Die geprüften Bearbeitungs- und Speicherwege funktionieren. Besonders positiv sind die getrennte Kapitel- und Gedankenansicht, die Konfliktbehandlung, die Wiederherstellung nach gelöschten Begleitdateien und das Erhalten vollständiger Gedanken einschließlich interner Markdown-Listen. Das Hauptdokument blieb bei den Companion-Prüfungen unverändert.

Die Oberfläche ist trotzdem noch nicht durchgehend ausgereift. Ein beobachteter Darstellungsunterschied betrifft Lineage: Mehrere eingegebene Absätze eines Gedankens können in der geprüften Konfiguration außerhalb des Bearbeitens zusammenlaufen. Diese Beobachtung betrifft die Anzeige, nicht die Speicherung oder Gedankenhierarchie. Die Einbettung fremder Editoren und die Hintergrundaktualisierung des Graphen bleiben technische Schwachstellen. Der unten beschriebene Fehlerpfad beim Schließen wurde inzwischen abgesichert. Ein pauschales Urteil „fehlerfrei“ wäre durch diesen Prüfdurchgang nicht gedeckt.

## Prüfverfahren und Nachweise

Die Prüfung kombiniert Quellcode-Durchsicht, automatisierte Regressionen, Bedienprüfungen in der laufenden App, Bildschirmaufnahmen und einen Belastungstest. Für neue Companion- und Darstellungsfälle wurden eigene temporäre Dateien angelegt und anschließend entfernt. Die Prüfungen kontrollieren dabei unveränderte Hauptdateien, Einstellungen und Dateianzahlen. Feldideen wurden mit einem isolierten Controller und simulierten Schreibaktionen geprüft. Es wurden keine Sprachmodellaufrufe ausgelöst.

| Prüfung | Ergebnis | Abdeckung und Grenze |
| --- | --- | --- |
| TypeScript und Produktionsbuild | Bestanden | Vollständiger aktueller Quellstand |
| ESLint | Bestanden, 0 Fehler und 0 Warnungen | Aktuelle Konfiguration |
| Automatisierte Tests | 673 bestanden, 6 übersprungen; 66 Testdateien bestanden, eine übersprungen | Die sechs optionalen Modelltests wurden nicht ausgeführt |
| Gesamte Oberfläche | 48 Kombinationen | Acht Ansichten einschließlich beider Companion-Editoren, 320/714/1100 Pixel, Light und Dark Mode |
| Gemessene Eingabekontraste | 60 Messungen, keine unter 4,5:1 | Sichtbare aktivierte Textfelder und CodeMirror-Flächen; keine vollständige WCAG-Prüfung |
| Äußere Panel-Überläufe | Keine in den 48 Kombinationen | Absichtliche interne Editor- und Tab-Scrollbereiche bleiben zulässig |
| Sichtbare aktivierte Schaltflächen ohne Beschriftung | Keine in der Gesamtprüfung | Beschriftung über Text, Tooltip oder zugänglichen Namen |
| Laufzeitfehler während der Gesamtprüfung | Keine aufgezeichnet | Beschränkt auf ausgeführte Abläufe |
| Einstellungen | 62 native Prüfungen bestanden | DE/EN, Entwürfe, Aktivierung aller sieben Bereiche, Vorlagenordner, Graph-Vorschau und kompakte Layouts |
| Companion-Dateilebenszyklus | 45 native Prüfungen bestanden | Mehrere Begleitdokumente, Löschen, Wiederherstellen, beschädigte Dateien, fehlende Kapiteldateien, Zuordnung und Entwurfsrettung |
| Originalansichten EOME/Lineage | 34 native Prüfungen bestanden | Mehrzeilige Texte, interne Listen, Tastatur, Abhaken, Verschieben von Unterbäumen, Undo/Redo, Konflikte und lokale Optionen |
| Kompatibilität der Originaleditoren | Acht neue Unit-Prüfungen bestanden | Benötigte Funktionen und Original-Stores, unveränderte Instanzen, verständliche Ablehnung inkompatibler Ansichten; kein pauschaler Ausschluss neuer Versionsnummern |
| Rückgabeformat der Editoren | Drei neue Unit-Prüfungen bestanden | Unterstützte Formatkennung, unbekannte Formate bei unverändertem Text und ungültige oder doppelte Metadaten |
| Companion-Schließvorgang | Zwölf neue Unit-Prüfungen und 17 native Prüfungen bestanden | Entwurfssicherung und Export nach Editorfehlern, persistierte Entwürfe, Freigabe und Schutz vor verspäteten Schreibzugriffen |
| Companion-Design und Bearbeitung | 59 native Prüfungen bestanden | Tatsächliche Bearbeitungsfelder, neue EOME-Gedanken, Abhaken, Linkkontraste, native Gliederungstypografie, Trennlinie, Optionen und Vollbild in beiden Themes |
| Companion-Belastung | 300 Gedanken, sechs Ebenen, 251.241 Zeichen | Beide Ansichten vollständig geladen und gespeichert; kein Ersatz für einen mehrstündigen Schreibtest |
| Mermaid | 40 native Prüfungen bestanden | Verbindungen, Beschriftung, Gruppen, Zeigergesten, Vollbild und Undo |
| Argdown | 79 native Prüfungen bestanden | Beziehungen, Auswahl, Rekonstruktion, Fokusansichten, Quelltexterhalt und Zuverlässigkeit |
| Tetrader | 30 native Prüfungen bestanden | Eigene Muster, Markdown-Bearbeitung, Bindung an einen Block, Undo/Redo, Vollbild und Konflikte |
| Feldideen | 12 simulierte Vorschläge in drei Feldern | Übernehmen, Ablehnen, Undo, Gruppierung und Panelbreite; keine Bewertung echter Modellantworten |
| Suche | Neue Menü-Regressionen bestanden | Öffnen mit und ohne aktivierten Graphen; Erkunden wird entsprechend angeboten |
| Lokale Paketprüfung | Bestanden | Manifest, Versionen, Bundle-Syntax, lokale Quellpfade und Release-Dateien; kein Upload oder Release |

Die geprüften Integrationsversionen sind EOME 0.2.4, Lineage 0.8.5, Breadcrumbs 4.23.0 und ZotLit 2.3.0-beta.0. Die 48 Gesamtlayouts umfassen den Hauptgraphen; sämtliche eingebetteten Zusatzansichten von Breadcrumbs, ZotLit und Obsidian wurden in diesem Durchgang nicht erneut vollständig durchgespielt.

## Im Prüfdurchgang korrigiert

### Einheitliche Navigation

Die Einstellungsseiten hatten trotz bereits geänderter Hauptnavigation noch eine andere Reihenfolge. Beide folgen jetzt **Begleitdokument → Graph → Feldideen → Mermaid → Argdown → Tetrader → Suche**. Die native Regression vergleicht die tatsächlichen Namen und Reihenfolgen. Deutsche und englische README sowie die Einstellungsdokumentation wurden angepasst; dort standen teilweise noch fünf Bereiche oder eine alte Tab-Reihenfolge.

Der allgemeine Öffnen-Befehl heißt jetzt **Arbeitsbereich öffnen / Open workspace**. Seine stabile Befehlskennung bleibt erhalten. Der frühere Name „Wissensgraph und Analyse öffnen“ beschrieb den inzwischen größeren Funktionsumfang nur teilweise.

### Hilfreicher Rechtsklick in der Suche

Ein Rechtsklick auf einen normalen Suchtreffer führte bisher unmittelbar zum Graphen oder blieb bei deaktiviertem Graphen wirkungslos. Jetzt öffnet er ein Obsidian-Kontextmenü mit **Öffnen** und, bei aktiviertem Graphen, **Im Graphen erkunden**. Der Test prüft beide Zustände und die tatsächliche Öffnen-Aktion.

### Sichere Löschung des Undo-Journals

Die bisherige Einstellungsaktion leerte das Journal im Arbeitsspeicher vor dem Speichern und stellte es bei einem Speicherfehler nicht wieder her. Die Löschung läuft jetzt über den Writer, nutzt dessen Schreibsperre und stellt bei einem Speicherfehler die ursprünglichen Einträge im selben Array wieder her. Währenddessen ist die Schaltfläche deaktiviert. Drei neue Regressionen prüfen Erfolg, fehlgeschlagenes Speichern und konkurrierende Schreibaktionen. Die Notizdateien werden dabei nicht verändert.

### Passende Bedienhinweise

Der Hinweis zum Ziehen von Vorschlägen auf Beziehungsfelder erscheint jetzt erst, wenn tatsächlich offene Vorschläge vorhanden sind. Ohne Vorschläge beschrieb er eine gerade nicht ausführbare Aktion und nahm Platz ein.

### Verlässlichere Prüfwerkzeuge

Mehrere native Prüfskripte erwarteten noch fünf oder sechs Tabs sowie ein inzwischen ersetztes Rasterlayout. Diese Erwartungen wurden aktualisiert. Die Feldideen-UI-Prüfung verwendet eine gültige isolierte Testkonfiguration und hängt damit nicht mehr von zufälligen Freigaben der gerade geöffneten Nutzernotiz ab. Das sind Korrekturen der Prüfgrundlage, keine zusätzlichen Produktfehler.

Die neue Gesamtprüfung nutzt einen eindeutigen Suchbegriff ihrer Testdatei, sodass die Such-Screenshots nur die Testdaten zeigen. Für Menüprüfungen wird vorübergehend Obsidians HTML-Menüvariante verwendet; die macOS-Menüeinstellung wird anschließend wiederhergestellt. Neu hinzugekommen sind `test:plugin-audit-ui` und `test:companion-scale-ui`.

## Offene Befunde nach Priorität

### Darstellungsunterschied: Lineage zieht Absätze zusammen

**Beobachtet:** Ein Gedanke mit zwei normalen Textabsätzen, interner Liste und Blockzitat wird in EOME mit getrennten Absatz-Elementen dargestellt. Lineage erzeugt für die beiden normalen Absätze ein gemeinsames `<p>` mit einem geschützten Leerzeichen anstelle der Absatztrennung. Bei normaler Leerraumdarstellung laufen die Absätze visuell zusammen. Das zusätzliche Absatz-Element im Blockzitat bleibt davon unabhängig.

**Auswirkung:** Lange philosophische Texte und Zitate verlieren in der Vorschau ihre sichtbare Absatzstruktur. Gespeicherter Markdown-Text und Bearbeitungsmodus erhalten den Inhalt; die Prüfung hat keinen entsprechenden Textverlust gefunden. Die ursprüngliche Bewertung als zwingend zu behebender Fehler ging über die abgestimmte Vorgabe hinaus. Maßgeblich bleibt die Originalansicht des separat installierten Plugins; eine andere Absatzdarstellung wäre eine eigene Produktentscheidung.

**Ursache:** In Lineage 0.8.5 ersetzt `src/view/actions/markdown-preview/helpers/format-text.ts` leere Zeilen durch `&nbsp;`, bevor die originale Markdown-Vorschau rendert. Eine CSS-Regel für Abstände zwischen Absätzen kann die bereits zusammengezogene DOM-Struktur nicht reparieren.

**Festgelegtes Vorgehen:** EOME und Lineage bleiben eigenständige Originalplugins. Emergence setzt keine lokale Lineage-Sonderversion voraus und ersetzt dessen Textdarstellung nicht. Die vorbereitete experimentelle Absatzkorrektur wurde nicht installiert und gehört nicht zum veröffentlichten Plugin. Neue eigene Gedankenansichten orientieren sich an EOME. Die Unterscheidung zwischen Gedankenstruktur, gespeicherten Markdown-Inhalten und sichtbarer Textdarstellung ist in der Dokumentation ausdrücklich festgehalten.

### P1: Die Originaleditoren haben noch keinen stabilen Einbettungsvertrag

**Quellcode-Befund:** Die Companion-Ansichten nutzen die installierten Originaleditoren und behalten deren Interaktionen. Die Integration benötigt jedoch interne View-Factories, Stores, Komponenten und Dateifassaden. Für Lineage wird außerdem ein interner Dokument-Ladeweg verwendet. Das ist versionsgebunden, auch wenn keine globalen Prototypen ersetzt werden.

**Auswirkung:** Ein Update von EOME oder Lineage kann die Einbettung beschädigen, ohne dass sich die Markdown-Dateien oder Emergence selbst geändert haben. Der erfolgreich geprüfte Stand ist kein Nachweis für zukünftige Versionen. Insbesondere ist „installiert und aktiviert“ noch kein vollständiger Kompatibilitätsnachweis.

**Weiteres Ziel:** Eine kleine dokumentierte Einbettungs-API in den Originalplugins: Editor erzeugen, Dokument lesen/schreiben, Auswahl und Änderungen abonnieren, Einstellungen pro Instanz setzen, speichern und sauber freigeben. Für EOME ist das wegen der gemeinsamen Autorenschaft gut umsetzbar. Die benötigten Funktionen von Originalansicht und Lineage-Stores werden inzwischen vor dem Laden geprüft; inkompatible Ansichten melden Plugin und Version und bieten die vorhandene Begleitdatei als Markdown an. Diese Laufzeitprüfung ersetzt einen stabilen Einbettungsvertrag und die Verhaltenstests nicht.

### Erledigt: Fehlerpfad beim Schließen

**Ursprünglicher Befund:** Ein Fehler in `companionPanel.flush()` konnte die nachfolgenden Freigaben in `EmergenceView.onClose()` überspringen. Auch der normale native Schließpfad hing von einem erfolgreichen Speichern ab.

**Korrektur:** Ein eigener `shutdown()`-Pfad erhält bei einem Speicher- oder Editorfehler den vollständigen Abschnitt und den noch eingegebenen Text als Entwurf. Die Speicherung dieses Entwurfs wird auch nach einem Fehler des Originaleditors versucht. Die Freigaben von Originalansicht, Beobachtern, DOM und Fokuszuständigkeit werden einzeln versucht. Im Hauptarbeitsbereich laufen Abmelden, Editorabschluss, Suche, Graph, Freigabe offener Schreibvorschauen und DOM-Aufräumen ebenfalls nach Einzelfehlern weiter. Fehler werden sichtbar gemeldet. Normale Ansichtswechsel verwenden weiterhin den bisherigen, bei Speicherproblemen blockierenden Pfad.

**Nachweis:** Zwölf neue Unit-Regressionen und die ergänzte Prüfung verspäteter Lineage-Speicheraufrufe bestanden. Die native Prüfung mit beiden installierten Originaleditoren bestätigt Entwurf, persistierte Fassung, Export, Ressourcenfreigabe, unveränderte Haupt- und Begleitdateien sowie das Abweisen verspäteter Schreibzugriffe. Der Dateilebenszyklus mit 45 nativen Prüfungen wurde anschließend erneut bestanden.

### P2: Vollständiger Graph-Neuaufbau im Leerlauf

**Gemessen und im Code bestätigt:** Das allgemeine Plugin plant alle 30 Sekunden eine Aktualisierung. Bei aktivierten Wissensbereichen erstellt `GraphService.rebuild()` den Graphen aus Dateien und Metadaten erneut und vergleicht erst anschließend eine Signatur. Der gemessene Aufbau mit 6.146 Knoten und 5.599 Kanten dauerte in den Abschlussläufen rund 71–73 Millisekunden. Dafür werden überwiegend vorhandene Metadaten verarbeitet; dies ist kein regelmäßiges Neulesen sämtlicher Notiztexte von der Festplatte.

**Auswirkung:** Die durchschnittliche Last dieses einzelnen Aufbaus ist auf dem geprüften Rechner klein, aber auch im Leerlauf entsteht vermeidbare Arbeit auf dem Hauptthread. Größere Vaults und schwächere Rechner können stärkere Spitzen zeigen. Zusätzliche durch Ereignisse ausgelöste Aufbauten kommen gegebenenfalls hinzu.

**Empfehlung:** Änderungen der beteiligten Datenquellen vor dem vollständigen Aufbau erkennen, ereignisgesteuerte Invalidierung ausbauen und das Polling nur als begrenzte Rückfallstrategie einsetzen. Dabei muss die Aktualität von Breadcrumbs und ZotLit erhalten bleiben.

**Wichtige Abgrenzung:** Der Companion-Abgleich selbst reagiert auf Editor-, Metadaten- und Dateiereignisse. Er hat keinen solchen 30-Sekunden-Vollscan und schreibt bei normalen Fließtexteingaben keine neue Gliederung.

### P2: Viele lange Gedanken erzeugen kurze Ladepausen

**Gemessen:** 300 Gedanken in sechs Ebenen mit insgesamt 251.241 Zeichen benötigten in diesem Lauf rund 1.092 ms in EOME und 529 ms in Lineage bis zum geprüften Zustand. Diese Messung enthält jeweils eine bewusst eingerechnete Beruhigungszeit von 300 ms. Eine 20-ms-Zeitgeberprobe registrierte maximale zusätzliche Verzögerungen von 209 beziehungsweise 202 ms während des Öffnens.

**Einordnung:** Beide Ansichten erhielten den vollständigen Text auch nach einem Flush. Der Fall ist handhabbar; kurze sichtbare Ladepausen sind aber möglich. Die Zahlen sind Einzelmessungen auf diesem Rechner und keine garantierten Grenzwerte. Der Test misst insbesondere keine realen Maus-Drag-and-drop-Gesten über alle 300 Gedanken. Unterbaumverschiebungen sind separat mit kleineren Beispielen geprüft.

**Empfehlung:** Wiederholte Komplettaufbauten beim Kapitelwechsel vermeiden und lange Mindmap-Knoten auf sinnvoller Zoomstufe zugänglich halten. Änderungen an der Knotengröße müssen zur Geometrieberechnung des Originaleditors passen, damit Trefferflächen und Ziehen korrekt bleiben. Eine Begrenzung langer Texte sollte gegebenenfalls als ausdrückliche Vorschauoption im Originaleditor angeboten werden.

### P3: Zahlen und Funktionen sind nicht überall selbsterklärend

Die nackten Zahlen in den Tiefen-Auswahllisten des Graphen können mit Trefferzahlen verwechselt werden. Ein zugänglicher Name ist vorhanden; die sichtbare Bedeutung erschließt sich neuen Nutzern trotzdem nicht sofort. Eine kompakte, im Kontext verständliche Kennzeichnung wäre besser.

Die Begriffe Muster, neuer Entwurf, gebundener Block und gespeicherte Vorlage beschreiben unterschiedliche Dinge. Die Trennung schützt vorhandene Dokumente, fordert aber mehrere Entscheidungen. Eine vollständige Erstbenutzerprüfung sollte klären, ob die Statusanzeigen diese Unterschiede schnell genug vermitteln. Die zentrale Tab-Reihe braucht bei schmalem Panel horizontales Scrollen; das ist platzsparend, verbirgt aber weitere Bereiche. Eine zurückhaltende sichtbare Scroll-Andeutung könnte helfen.

Die ursprünglichen Editoren bringen teilweise eigene englische Texte und eigene Bedienkonventionen mit. Host-Sprache und Host-Schriftgröße sind geprüft, eine vollständige sprachliche und gestische Vereinheitlichung aller Drittanbieterfunktionen ist damit nicht erreicht.

## Bewertung der einzelnen Bereiche

| Bereich | Bewertung |
| --- | --- |
| Begleitdokument | Die Trennung von Kapitelgliederung und Gedanken ist für Hunderte verschachtelte Einträge richtig. Mehrere Begleitdokumente und Dateimodi sind eindeutig gespeichert. Fehlende Kapitel werden im Baum sichtbar; vorhandene Kapitel bleiben erreichbar. Die offenen Probleme liegen vor allem in der Originaleditor-Einbettung und Lineages Vorschau. |
| Graph | Die Beziehungssicht, Vorschau in den Einstellungen und Anpassung der Zweige funktionieren in den geprüften Abläufen. Begriffe und Tiefensteuerung benötigen eine Prüfung mit neuen Nutzern. Leere Zweige können viel Platz belegen; ein optionales Ausblenden wäre eine Produktentscheidung. |
| Feldideen | Ergebnisgruppen, Übernehmen, Ablehnen und Undo sind geprüft. Nicht anwendbare Vorschläge werden durch Regeln gesperrt. Der gesamte Konfigurationsumfang bleibt anspruchsvoll; ein durchgehender Einstieg vom leeren Setup bis zur ersten gültigen Zuordnung fehlt als eigener Usability-Test. Die inhaltliche Qualität aktueller Modellantworten wurde nicht neu bewertet. |
| Mermaid | Die geprüften visuellen Gesten und der Quelltexteditor passen zusammen. Komplexe Diagramme bleiben im schmalen Seitenpanel eng; Vollbild ist hier eine sinnvolle vorhandene Ausweichmöglichkeit. |
| Argdown | Die geprüften Beziehungs-, Rekonstruktions- und Quelltextpfade funktionieren. Der Bereich hat die höchste fachliche Einstiegshürde. Seine Werkzeugdichte sollte anhand konkreter Schreibaufgaben weiter beurteilt werden. |
| Tetrader | Die Integration und der Schutz gebundener Blöcke funktionieren. Eigene Muster sind als strukturierte Varianten tragfähig. Eine beliebig freie Markdown-Grammatik wäre ein anderer, deutlich größerer Editorumfang. |
| Suche | Öffnen und Erkunden sind jetzt auch im Kontextmenü klar getrennt. Die Kombination von Notiz- und Literaturtreffern ist sinnvoll. Fehlerfälle einer gerade nicht erreichbaren Zotero-Installation wurden in diesem Gesamtdurchgang nicht erneut umfassend simuliert. |
| Allgemeine GUI | Die geprüften Eingaben sind in Light und Dark lesbar, beide Gedankenansichten verwenden bei 16 px Grundschrift 14 px Text. Die Kapitelgliederung behält die native Obsidian-Typografie. Es gibt keinen Anlass, die Gliederung zur Angleichung an die Karten künstlich zu vergrößern. |

## Grenzen der dauerhaften Zuordnung

Die Hauptdatei wird nicht um Kennungen oder Frontmatter ergänzt. Die Datei-Zuordnung und die stabilen Abschnitts- und Gedankenkennungen liegen im Begleitdokument. Ein aus dessen Metadaten aufgebauter Rückwärtsindex findet Begleitdokumente beim Öffnen der Hauptdatei; die Backlink-Seitenleiste ist dafür keine Voraussetzung.

Ohne Kennungen im Hauptdokument kann ein Programm manche externen Änderungen nicht eindeutig deuten: Eine entfernte und neu angelegte gleichnamige Überschrift kann genauso aussehen wie eine Verschiebung; mehrere gleichzeitig umbenannte identische Überschriften können ihre Identität verlieren. Dafür ist das Behalten der bisherigen Gedanken mit manueller Zuordnungsprüfung die sinnvolle Sicherung. Vollautomatische Eindeutigkeit für beliebige externe Bearbeitungen ist unter dieser Vorgabe nicht versprechbar.

## Empfohlene nächste Arbeitsschritte

1. Die vorhandene Einbettung gegen unveränderte Originaleditoren absichern; eine stabile EOME-Einbettungsschnittstelle gemeinsam mit dessen eigenständiger Weiterentwicklung vorbereiten. Laufzeitprüfungen der benötigten Funktionen sind ergänzt.
2. Graph-Invalidierung vor dem Vollaufbau optimieren und die Messung auf einem größeren Vault wiederholen.
3. Einen längeren echten Schreibdurchgang mit neuen Nutzern durchführen: aus leerem Setup starten, mehrere Kapitel mit vielen Auszügen bearbeiten, zwischen beiden Ansichten wechseln und ausschließlich per Tastatur arbeiten.

Die bestehenden Prüfskripte stehen unter `scripts/`. Die vollständigen maschinellen Laufberichte und Bildschirmaufnahmen dieses Durchgangs bleiben lokale, nicht eingecheckte Prüfarbeitsdaten. Der Bericht enthält bewusst keine privaten Notiztexte, Nutzernotizpfade oder Bibliografieeinträge.
