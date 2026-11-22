# Hierarchical Outline

## Integration

Die eigenständige Ansicht wird in `CompanionPanel` unter **Hierarchical Outline | EOME |
Lineage** ausgewählt. Die Ansichtsauswahl steht am Anfang des
Bearbeitungsbereichs, unmittelbar nach der Gliederung. EOME und Lineage bleiben eigenständige Plugins.
Die Ansicht benötigt keines davon. Die Kapitelgliederung und ihre Verbindung zum
Hauptdokument bleiben die vorhandenen Komponenten. Hierarchical Outline ist die
Standardansicht. In den allgemeinen Begleitdokument-Einstellungen kann zwischen
den drei Ansichten gewählt werden; eine explizite Auswahl je Dokument hat Vorrang.

Der technische Integrationsplan nutzt ausschließlich die bestehenden Grenzen:

1. `Thought` und `thoughts(section)` liefern dieselben Inhalte und ausschließlich im Arbeitsspeicher gehaltenen Knotenreferenzen.
   `thoughtIndex` liefert die Beziehungen zwischen übergeordneten Einträgen, Einträgen derselben Ebene und Untereinträgen.
2. `CompanionService.executeMany()` führt Änderungen transaktional aus;
   `applyThought()` prüft Zuordnung, Erwartungen und Zyklen. Die bestehenden
   semantischen Undo-/Redo-Operationen gelten auch für Hierarchical Outline.
3. `MermaidMarkdownEditor` stellt den vorhandenen isolierten Obsidian-Editor
   bereit. Ist diese interne Obsidian-Schnittstelle nicht verfügbar, wird die Bearbeitung mit einer verständlichen Meldung abgewiesen. Es wird kein vereinfachter Ersatzeditor geöffnet.
4. Auswahl und Scrollposition sind Ansichtsstatus. Eine gemeinsame flüchtige
   Auswahl im Companion-Service verbindet die Ansicht mit den Originalansichten.
   Beim Wechsel übersetzt `native-selection.ts` die tatsächlich gewählte
   Original-Node anhand der Baumreihenfolge in eine flüchtige Knotenreferenz. Bei abweichender
   Knotenzahl wird diese Übersetzung ausgesetzt.
5. Die gespeicherte Darstellung wird wie bisher in den Plugin-Einstellungen je
   Begleitdokument gehalten. Es gibt keine zusätzliche Knotendatenbank,
   Arbeitskopie, Ansichtsdatei oder Kennung im Hauptdokument.

Die gemeinsame Markdown-Grammatik bleibt EOMEs Format 2: Tabs bilden die echte
Hierarchie, zwei zusätzliche Leerzeichen die Textfortsetzungen. Absätze, Listen,
Überschriften und Code innerhalb eines Eintrags bleiben dessen Inhalt. Ältere
einzeilige Abschnitte bleiben beim Öffnen unverändert; eine erforderliche
mehrzeilige Bearbeitung verwendet die gemeinsame Format-2-Projektion unter
Erhalt der internen Zuordnung während der Sitzung. Nicht eindeutig übertragbarer alter Fließtext wird vor
dem Schreiben abgewiesen.

## Eintragsformat

In den Dateien stehen Einträge ausschließlich als Markdown mit Einrückungen.
Die vorhandenen Kapitelkennungen bleiben an den Kapitelüberschriften. Es gibt
keine gespeicherten Kennungen an einzelnen Einträgen und keine zusätzliche Tabelle
mit Eintragskennungen. Die vorhandene Frontmatter-Formatversion wird auf 2 gesetzt,
damit künftig auch wörtliche Beispiele alter Marker zum normalen Text gehören
und beim erneuten Lesen erhalten bleiben. Version 1 bleibt lesbar. Der Serializer entfernt die früheren strukturellen
`em-note`-Kommentare. Vorhandene Begleit-Dummydaten werden über den normalen
Abgleich bereinigt; Kommentar-Beispiele innerhalb eines Eintrags oder von Code
bleiben erhalten. Ein zusätzlicher Befehl oder eine Einstellung ist dafür nicht nötig.

Der vorhandene Operationsdienst verwendet während einer Sitzung Arbeitsreferenzen.
Unveränderte Abschnitte behalten diese; nach externen Änderungen werden nur
beidseitig eindeutige unveränderte Texte weiter zugeordnet. Mehrdeutige Duplikate
werden nicht anhand ihrer Position geraten. Eine veraltete Bearbeitung wird in
solchen Fällen abgewiesen. Nach einem Neustart werden die Referenzen neu aufgebaut.

## Bedienung

Oben steht eine anklickbare Vorschau des direkt übergeordneten Eintrags mit
höchstens zwei Zeilen. In der Mitte stehen alle Einträge derselben Ebene mit vollständigem
Markdown. Unten stehen die Anzahl der direkten Untereinträge und direkt anwählbare
Vorschauen mit höchstens 100 Zeichen und zwei Zeilen. Dieser Bereich wächst mit
seinem Inhalt bis höchstens 145 Pixeln und scrollt danach unabhängig.

| Taste | Aktion außerhalb des Editors |
| --- | --- |
| ↑ / ↓ | Vorheriger / nächster Eintrag auf derselben Ebene, auch auf der obersten Ebene |
| ← / → | Unmittelbarer übergeordneter Eintrag / erster Untereintrag |
| Home / End | Erster / letzter Eintrag derselben Ebene |
| Enter | Gewählten Eintrag bearbeiten |
| Strg/Cmd+Enter | Gewählten Eintrag bearbeiten, wie Enter |
| Strg/Cmd+← / Strg/Cmd+→ | Eintrag davor / danach anlegen |
| Strg/Cmd+↓ | Untereintrag anlegen |
| Strg/Cmd+Z / Strg/Cmd+Umschalt+Z | Gemeinsames Undo / Redo |
| Strg/Cmd+A | Alle angezeigten Einträge auswählen |
| Strg/Cmd+C / X / V | Kopieren / Ausschneiden / Einfügen |
| Entf / Rücktaste | Löschen mit Bestätigung einschließlich der Untereinträge |

Das Bearbeiten findet innerhalb derselben Zeile statt. Beim Hinzufügen erscheint die
neue Zeile an ihrer tatsächlichen Einfügeposition; der übergeordnete Eintrag und
die bisherigen Nachbarn bleiben als Kontext sichtbar. Die Vorschau der Untereinträge
des vorher gewählten Eintrags wird während des Hinzufügens ausgeblendet. Eine leere
neue Zeile wird beim Verlassen verworfen, ohne Dateiänderung oder Fehlermeldung.
Der Inline-Editor besitzt einen eigenen Größenmodus und übernimmt keine
Dialog-Mindesthöhe. Er beginnt mit einer Textzeile und wächst bei Umbrüchen;
Löschen lässt ihn wieder schrumpfen. Bestätigen und Abbrechen stehen als
beschriftete Symbolschalter rechts in derselben Zeile. Escape funktioniert auch
bei Fokus auf diesen Schaltern. Bei offenen nativen Linkvorschlägen schließt
Escape zuerst die Vorschläge; der folgende Druck verwirft die Eingabe.

Im Editor gelten EOMEs Regeln: Enter übernimmt außerhalb einer Markdown-Liste,
innerhalb einer Liste setzt Obsidian die Liste fort. Shift+Enter fügt einen
Zeilenumbruch ein. Strg/Cmd+Enter übernimmt ausdrücklich; Escape verwirft.
Der für das Kapitel gespeicherte einzeilige EOME-Modus wird übernommen; längere
Texte werden dabei niemals zusammengezogen. Bei Fokusverlust wird gespeichert,
ohne den Fokus aus der Hauptnotiz zurückzuholen. Autovervollständigung hat
Vorrang: Enter bestätigt einen offenen Linkvorschlag und beendet nicht die
Bearbeitung des Eintrags. Datei-, Überschriften- und Blocklinks sowie Markdown-Befehle verwenden
Obsidian selbst. Ein Ansichts- oder Kapitelwechsel wartet auf
die Übernahme. Bei einem Speicherfehler wird die Änderung abgelehnt, der Editor
geschlossen und der tatsächliche Dateistand erneut geladen. Der fehlgeschlagene
automatische Wechsel wird angehalten, damit die Fehlermeldung sichtbar bleibt.
Es wird kein Entwurf oder paralleles Sicherungsdokument angelegt. Kann die Datei
nicht erneut gelesen werden, zeigt die Ansicht keinen alten scheinbar aktuellen
Inhalt; er bietet erneutes Prüfen an.

Freies Scrollen ändert die logische Auswahl nicht. Die Tastaturnavigation scrollt
nur bei Bedarf. Bereits sichtbare lange Textpassagen werden nicht an ihren Anfang
zurückgesetzt. Scrollpositionen werden pro Kapitel und Eintragsebene gehalten.
Strg/Cmd-Klick und Umschalt-Klick wählen mehrere Einträge. Eine normale Auswahl
von Fließtext bleibt beim Kopieren unangetastet.

Das Kontextmenü bietet Bearbeiten, Erstellen, Aufgabenmarkierung, Kopieren,
Ausschneiden, Einfügen, Verschieben und Löschen. Aufgaben werden im vorhandenen
`[ ]`-/`[x]`-Text markiert; der zentrale Checkbox-Schalter verwendet denselben
Speicherweg wie eine Textänderung. Weitere Metadaten bleiben Teil des bestehenden
Dateiformats.

Jeder Eintrag kann direkt abgehakt werden. Wie im lokalen EOME 0.2.4 betrifft das
nur diesen Eintrag; Untereinträge werden nicht automatisch mit abgehakt. Die Ansicht
bietet zusätzlich einen zentralen Filter **Abgehakte ausblenden/einblenden**.
Vollständig abgehakte Zweige verschwinden aus der Ansicht. Abgehakte Vorfahren
bleiben mit dem Hinweis **Offene Untereinträge** als Verbindungen zu offenen
Nachkommen sichtbar, auch über mehrere Ebenen. Ihre eigentlichen Beziehungen
werden nicht umgeschrieben. Navigation, Mehrfachauswahl, Suche und Vorschauen der Untereinträge
verwenden dieselbe Sichtbarkeit. Verschieben und Kopieren behalten den vollständigen
Unterbaum einschließlich ausgeblendeter Einträge. Der Filter schreibt nichts in
die Datei; eine ausgeblendete aktive Zeile wechselt zum nächsten sichtbaren
Eintrag derselben Ebene, ersatzweise zum vorherigen oder einem sichtbaren Vorfahren.
Die eingesehene lokale EOME-Version enthält selbst keinen entsprechenden Filter;
die genannten Verbindungsregeln werden in der Ansicht ausdrücklich geprüft.

## Verschieben und externe Inhalte

Die Drag-Handles verwenden das vorhandene Companion-Drag-Format. Bei einem Drag
werden vier Einfügezonen sichtbar: davor, danach, erster Untereintrag, letzter Untereintrag.
Gültigkeit und Zyklenschutz kommen aus dem gemeinsamen Operationsdienst.
Mehrfachauswahl wird auf ihre Wurzelknoten reduziert; deren Unterbäume ziehen
vollständig und in ihrer bisherigen Reihenfolge mit.

Auch die Vorschauen des übergeordneten Eintrags und der Untereinträge sind Drop-Ziele. Nach 650 ms Hover kann eine
andere Ebene geöffnet werden; an den Rändern des Lesestroms wird gescrollt.
Auch die freie Fläche unter dem letzten Eintrag ist ein Ablageziel: Sie fügt
interne Zweige oder externen Text am Ende der aktuell sichtbaren Ebene ein.
Es gelten dieselben Zyklus-, Konflikt- und Mehrfachauswahlprüfungen wie auf den
Einträgen. Die tatsächlichen Zuordnungen zu übergeordneten Einträgen bleiben beim Filtern erhalten.

Eine suchbare Zielauswahl im Kontextmenü ermöglicht dieselben vier Operationen
für entfernte Einträge ohne Drag. Einfügeprüfungen werden während eines Drags je
Dateistand und Ziel zwischengespeichert.

Extern eingefügter oder fallengelassener Markdown-Text wird als ein vollständiger
Eintrag übernommen, damit seine internen Listen nicht unbeabsichtigt Untereinträge
werden. Innerhalb von Hierarchical Outline kopierte Unterbäume behalten beim Einfügen ihre
Struktur und erhalten neue flüchtige Knotenreferenzen. Ausschneiden markiert den
Unterbaum zunächst; erst das Einfügen unter dem gewählten Ziel verschiebt ihn, wie in EOME. Normale Markdown-Links und Einbettungen werden
über Obsidian und den tatsächlichen Dateikontext gerendert.

## Prüfung

`tests/companion-reader.test.ts` prüft kurze und lange Texte, interne Markdown-
Listen, mehrere Absätze, fünf Ebenen, 1/5/30/100 Untereinträge, über 130 Einträge derselben Ebene,
Navigation, Scrollpositionen, Editor, Speicherfehler, externe Änderungen,
Mehrfach-Drag, Ebenenwechsel während des Drags, alle vier Verschiebeoperationen,
Checkboxen und beide Ablagemodi. `tests/companion-native-selection.test.ts`
prüft die Übersetzung zur Auswahl beider Originalansichten, auch bei gleichem Text.

`npm run test:companion-reader-ui` prüft zusätzlich die laufende Obsidian-App:
Original-Markdown-Editor, EOME-/Lineage-Wechsel, Auswahl, Unterbäume, Konflikte,
unverändertes Hauptdokument und Light/Dark bei 400/500/650 Pixeln. Dabei entstehen
nur temporäre Testdateien; vorherige Ansicht, Theme und Layout werden anschließend
wiederhergestellt. Bildschirmaufnahmen landen unter `/tmp/emergence-reader-*`.

Die Einbettung des Obsidian-Markdown-Editors sowie die Auswahlübersetzung der
Originalplugins bleiben geprüfte interne Schnittstellen. Zukünftige Änderungen
dieser Drittkomponenten können eine Anpassung erfordern; ihre globalen Methoden
und Prototypen werden durch die Ansicht nicht verändert.

Der datierte Prüfstand mit den abschließenden Testergebnissen und konkreten
Integrationsgrenzen steht im [kritischen Prüfbericht](COMPANION_AUDIT.md#validierung).
Die dort genannten Ergebnisse gelten für die aufgeführten Obsidian- und
Originalplugin-Versionen.

## Dokumentaktionen

Die Kopfzeile enthält die Dokumentauswahl sowie Anheften, Abgleichen, Vollbild
und das Dokumentmenü. Beim geöffneten Dokument enthält nur das Menü die
Aktionen **Weiteres Begleitdokument anlegen** und **Anderes Begleitdokument
auswählen**, daneben Datei öffnen und Verbindung ändern. Im leeren Zustand
stehen Anlegen und Auswählen in der Einstiegsansicht; das Dokumentmenü ist
ausgeblendet. Die Möglichkeit mehrerer unabhängiger Begleitungen bleibt bestehen.

## Abgelehnte Änderungen in Originalansichten

EOME und Lineage speichern über dieselbe geprüfte Dateigrenze. Nach einem Fehler
werden ausstehende veraltete Schreibvorgänge verworfen, die ursprüngliche
Bearbeitung beendet und die tatsächlichen Dateiinhalte über die normalen
Originalansichts-APIs geladen. Bei EOME wird die eingebettete Originalansicht über
ihre öffentlichen Lebenszyklusmethoden `onClose()` und `onOpen()` neu aufgebaut.
Dadurch werden auch aufgeschobene Anzeigen aus dem tatsächlichen Dateistand
wiederhergestellt. Lineages verzögertes Laden muss abgeschlossen sein, bevor die
Ansicht wieder bedienbar ist. Kann die Datei nicht gelesen werden,
wird der alte Inhalt entfernt und erneutes Prüfen angeboten. Ein fehlgeschlagener
Ansichtswechsel hält an; der anschließend angezeigte gespeicherte Stand bleibt
navigierbar. Es gibt keine persistenten Ansichtsentwürfe, Exportkopien oder
Verwerfen-Zeilen. Alte Entwurfsfelder werden beim Einlesen ignoriert und gehören
nicht mehr zum gespeicherten Plugin-Zustand. Das bestehende Transaktionsjournal
für abgebrochene Mehrdatei-Schreibvorgänge bleibt eine separate Speichersicherung.

Gezielte Regressionen prüfen außerdem verspätete Auswahlrückgaben und einen
Ansichtswechsel während des Fehlerabgleichs. Geschlossene Ansichten werden nicht
mehr ausgewertet; ein laufender Fehlerabgleich wird vor dem Wechsel abgeschlossen.
