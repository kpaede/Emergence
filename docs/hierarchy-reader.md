# Hierarchy Reader

## Integration

Die dritte Gedankenansicht wird in `CompanionPanel` unter **EOME | Lineage |
Hierarchy Reader** ausgewählt. Die Ansichtsauswahl steht am Anfang des
Bearbeitungsbereichs, unmittelbar nach der Gliederung. EOME und Lineage bleiben eigenständige Plugins.
Der Reader benötigt keines davon. Die Kapitelgliederung und ihre Verbindung zum
Hauptdokument bleiben die vorhandenen Komponenten.

Der technische Integrationsplan nutzt ausschließlich die bestehenden Grenzen:

1. `Thought` und `thoughts(section)` liefern dieselben Inhalte und ausschließlich im Arbeitsspeicher gehaltenen Knotenreferenzen.
   `thoughtIndex` wird für Eltern, Geschwister und Kinder wiederverwendet.
2. `CompanionService.executeMany()` führt Änderungen transaktional aus;
   `applyThought()` prüft Zuordnung, Erwartungen und Zyklen. Die bestehenden
   semantischen Undo-/Redo-Operationen gelten auch für den Reader.
3. `MermaidMarkdownEditor` stellt den vorhandenen isolierten Obsidian-Editor
   bereit. Ist diese interne Obsidian-Schnittstelle nicht verfügbar, wird die Bearbeitung mit einer verständlichen Meldung abgewiesen. Es wird kein vereinfachter Ersatzeditor geöffnet.
4. Auswahl und Scrollposition sind Ansichtsstatus. Eine gemeinsame flüchtige
   Auswahl im Companion-Service verbindet den Reader mit den Originalansichten.
   Beim Wechsel übersetzt `native-selection.ts` die tatsächlich gewählte
   Original-Node anhand der Baumreihenfolge in eine flüchtige Knotenreferenz. Bei abweichender
   Knotenzahl wird diese Übersetzung ausgesetzt.
5. Die gespeicherte Darstellung wird wie bisher in den Plugin-Einstellungen je
   Begleitdokument gehalten. Es gibt keine zusätzliche Knotendatenbank,
   Arbeitskopie, Reader-Datei oder Kennung im Hauptdokument.

Die gemeinsame Markdown-Grammatik bleibt EOMEs Format 2: Tabs bilden die echte
Hierarchie, zwei zusätzliche Leerzeichen die Textfortsetzungen. Absätze, Listen,
Überschriften und Code innerhalb eines Gedankens bleiben dessen Inhalt. Ältere
einzeilige Abschnitte bleiben beim Öffnen unverändert; eine erforderliche
mehrzeilige Bearbeitung verwendet die gemeinsame Format-2-Projektion unter
Erhalt der internen Zuordnung während der Sitzung. Nicht eindeutig übertragbarer alter Fließtext wird vor
dem Schreiben abgewiesen.

## Gedankenformat

In den Dateien stehen Gedanken ausschließlich als Markdown mit Einrückungen.
Die vorhandenen Kapitelkennungen bleiben an den Kapitelüberschriften. Es gibt
keine gespeicherten Kennungen an Einzelgedanken und keine zusätzliche Tabelle
mit Gedankenkennungen. Die vorhandene Frontmatter-Formatversion wird auf 2 gesetzt,
damit künftig auch wörtliche Beispiele alter Marker zum normalen Text gehören
und beim erneuten Lesen erhalten bleiben. Version 1 bleibt lesbar. Der Serializer entfernt die früheren strukturellen
`em-note`-Kommentare. Vorhandene Begleit-Dummydaten werden über den normalen
Abgleich bereinigt; Kommentar-Beispiele innerhalb eines Gedankens oder von Code
bleiben erhalten. Ein zusätzlicher Befehl oder eine Einstellung ist dafür nicht nötig.

Der vorhandene Operationsdienst verwendet während einer Sitzung Arbeitsreferenzen.
Unveränderte Abschnitte behalten diese; nach externen Änderungen werden nur
beidseitig eindeutige unveränderte Texte weiter zugeordnet. Mehrdeutige Duplikate
werden nicht anhand ihrer Position geraten. Eine veraltete Bearbeitung wird in
solchen Fällen abgewiesen. Nach einem Neustart werden die Referenzen neu aufgebaut.

## Bedienung

Oben steht eine anklickbare Vorschau des unmittelbaren Elterngedankens mit
höchstens zwei Zeilen. In der Mitte stehen alle Geschwister mit vollständigem
Markdown. Unten stehen die Anzahl der direkten Kinder und direkt anwählbare
Vorschauen mit höchstens 100 Zeichen und zwei Zeilen. Dieser Bereich wächst mit
seinem Inhalt bis höchstens 145 Pixeln und scrollt danach unabhängig.

| Taste | Aktion außerhalb des Editors |
| --- | --- |
| ↑ / ↓ | Vorheriger / nächster Eintrag auf derselben Ebene, auch auf der obersten Ebene |
| ← / → | Unmittelbarer übergeordneter Eintrag / erster Untereintrag |
| Home / End | Erstes / letztes Geschwister |
| Enter | Gewählten Gedanken bearbeiten |
| Strg/Cmd+Enter | Gewählten Gedanken bearbeiten, wie Enter |
| Strg/Cmd+← / Strg/Cmd+→ | Geschwister davor / danach anlegen |
| Strg/Cmd+↓ | Kind anlegen |
| Strg/Cmd+Z / Strg/Cmd+Umschalt+Z | Gemeinsames Undo / Redo |
| Strg/Cmd+A | Alle angezeigten Geschwister auswählen |
| Strg/Cmd+C / X / V | Kopieren / Ausschneiden / Einfügen |
| Entf / Rücktaste | Löschen mit Bestätigung einschließlich der Untergedanken |

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
Vorrang: Enter bestätigt einen offenen Linkvorschlag und beendet nicht den
Gedanken. Datei-, Überschriften- und Blocklinks sowie Markdown-Befehle verwenden
Obsidian selbst. Die Schaltflächen
benennen diese beiden Aktionen. Ein Ansichts- oder Kapitelwechsel wartet auf
die Übernahme. Bei einem Speicherfehler wird die Änderung abgelehnt, der Editor
geschlossen und der tatsächliche Dateistand erneut geladen. Der fehlgeschlagene
automatische Wechsel wird angehalten, damit die Fehlermeldung sichtbar bleibt.
Es wird kein Entwurf oder paralleles Sicherungsdokument angelegt. Kann die Datei
nicht erneut gelesen werden, zeigt der Reader keinen alten scheinbar aktuellen
Inhalt; er bietet erneutes Prüfen an.

Freies Scrollen ändert die logische Auswahl nicht. Die Tastaturnavigation scrollt
nur bei Bedarf. Bereits sichtbare lange Textpassagen werden nicht an ihren Anfang
zurückgesetzt. Scrollpositionen werden pro Kapitel und Geschwisterebene gehalten.
Strg/Cmd-Klick und Umschalt-Klick wählen mehrere Gedanken. Eine normale Auswahl
von Fließtext bleibt beim Kopieren unangetastet.

Das Kontextmenü bietet Bearbeiten, Erstellen, Aufgabenmarkierung, Kopieren,
Ausschneiden, Einfügen, Verschieben und Löschen. Aufgaben werden im vorhandenen
`[ ]`-/`[x]`-Text markiert; der zentrale Checkbox-Schalter verwendet denselben
Speicherweg wie eine Textänderung. Weitere Metadaten bleiben Teil des bestehenden
Dateiformats.

Jeder Eintrag kann direkt abgehakt werden. Wie im lokalen EOME 0.2.4 betrifft das
nur diesen Eintrag; Kinder werden nicht automatisch mit abgehakt. Der Reader
bietet zusätzlich einen zentralen Filter **Abgehakte ausblenden/einblenden**.
Vollständig abgehakte Zweige verschwinden aus der Ansicht. Abgehakte Vorfahren
bleiben mit dem Hinweis **Offene Untereinträge** als Verbindungen zu offenen
Nachkommen sichtbar, auch über mehrere Ebenen. Ihre eigentlichen Beziehungen
werden nicht umgeschrieben. Navigation, Mehrfachauswahl, Suche und Kindervorschauen
verwenden dieselbe Sichtbarkeit. Verschieben und Kopieren behalten den vollständigen
Unterbaum einschließlich ausgeblendeter Einträge. Der Filter schreibt nichts in
die Datei; eine ausgeblendete aktive Zeile wechselt zum nächsten sichtbaren
Geschwister, ersatzweise zum vorherigen oder einem sichtbaren Vorfahren.
Die eingesehene lokale EOME-Version enthält selbst keinen entsprechenden Filter;
die genannten Verbindungsregeln werden im Reader ausdrücklich geprüft.

## Verschieben und externe Inhalte

Die Drag-Handles verwenden das vorhandene Companion-Drag-Format. Bei einem Drag
werden vier Einfügezonen sichtbar: davor, danach, erstes Kind, letztes Kind.
Gültigkeit und Zyklenschutz kommen aus dem gemeinsamen Operationsdienst.
Mehrfachauswahl wird auf ihre Wurzelknoten reduziert; deren Unterbäume ziehen
vollständig und in ihrer bisherigen Reihenfolge mit.

Auch Eltern- und Kindervorschauen sind Drop-Ziele. Nach 650 ms Hover kann eine
andere Ebene geöffnet werden; an den Rändern des Lesestroms wird gescrollt.
Eine suchbare Zielauswahl im Kontextmenü ermöglicht dieselben vier Operationen
für entfernte Gedanken ohne Drag. Einfügeprüfungen werden während eines Drags je
Dateistand und Ziel zwischengespeichert.

Extern eingefügter oder fallengelassener Markdown-Text wird als ein vollständiger
Gedanke übernommen, damit seine internen Listen nicht unbeabsichtigt Kinder
werden. Innerhalb des Readers kopierte Unterbäume behalten beim Einfügen ihre
Struktur und erhalten neue flüchtige Knotenreferenzen. Ausschneiden markiert den
Unterbaum zunächst; erst das Einfügen als Untergedanken verschiebt ihn, wie in EOME. Normale Markdown-Links und Einbettungen werden
über Obsidian und den tatsächlichen Dateikontext gerendert.

## Prüfung

`tests/companion-reader.test.ts` prüft kurze und lange Texte, interne Markdown-
Listen, mehrere Absätze, fünf Ebenen, 1/5/30/100 Kinder, über 130 Geschwister,
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
und Prototypen werden durch den Reader nicht verändert.

Produktionsbuild, ESLint, die automatisierte Suite und die native Reader-Prüfung
werden nach UI-Änderungen erneut ausgeführt. Die native Prüfung erfasst zusätzlich
offene Nachkommen unter mehreren abgehakten Vorfahren, vollständig erledigte
Zweige, Rückgängig, beide Pfeilrichtungen auf der obersten Ebene sowie die direkte
Einfügeposition in Hell/Dunkel. Der geprüfte Desktop-Stand ist Obsidian 1.15.1
mit EOME 0.2.4 und Lineage 0.8.5.
Aktueller Prüfstand: 752 automatisierte Tests bestanden, sechs optionale
Modelltests übersprungen; Produktionsbuild und ESLint bestanden. Die native
Reader-Prüfung bestand alle 152 Assertions einschließlich der Originalansicht-Wechsel.
Zusätzlich bestanden 59 Darstellungsprüfungen der Originalansichten, einschließlich
320-Pixel-Breite, Vollbild, erreichbarer Ansichtsauswahl und unveränderter
Lineage-Einstellungen.

Die abschließende Dummy-Datenprüfung erfasste 76 Begleitdateien. Drei verwaiste
Kapiteldateien wurden einmalig über Serializer und geschützten Schreibweg
bereinigt; dafür wurde keine Bedienfunktion hinzugefügt. Das verglichene
Hauptdokument blieb bytegleich.

## Dokumentaktionen

Die Kopfzeile enthält die Dokumentauswahl sowie Anheften, Abgleichen, Vollbild
und das Dokumentmenü. Beim geöffneten Dokument enthält nur das Menü die
Aktionen **Weiteres Begleitdokument anlegen** und **Anderes Begleitdokument
auswählen**, daneben Datei öffnen und Verbindung ändern. Im leeren Zustand
stehen Anlegen und Auswählen in der Einstiegsansicht; das Dokumentmenü ist
ausgeblendet. Die Möglichkeit mehrerer unabhängiger Begleitungen bleibt bestehen.
