# Gemeinsame Darstellung der Begleitdokument-Ansichten

## Produktentscheidung

EOME und Lineage bleiben eigenständige, separat installierte Originalplugins.
Emergence bindet ihre vollständigen Ansichten ein. Veröffentlichte Emergence-
Versionen setzen keine lokal gepatchte Ausgabe eines dieser Plugins voraus.
Eigene zusätzliche Gedankenansichten orientieren sich an EOMEs Datenformat und
Bedienung. Sie werden erst bei einem konkreten Bedarf ergänzt; diese Entscheidung
führt keine weitere Ansicht ein.

Das gemeinsame Begleitformat verwendet EOMEs mehrzeiliges Markdown-Format 2.
Lineage bekommt daraus sein natives Knotenmodell und schreibt revisionsgeprüft
zurück. Das bedeutet keine Zusage, dass eine beliebige Companion-Datei direkt in
jedem eigenständigen Lineage-Dateimodus verlustfrei bearbeitet werden kann.
Insbesondere sind Lineages eigene Formate und seine Darstellung von Leerzeilen
von der Gedankenhierarchie und dem Dateiformat getrennte Fragen.

Die Darstellung hat drei Zuständigkeiten:

1. **Host:** Kapitelgliederung, verfügbare Fläche, gemeinsame Theme-Tokens und
   Bedienelemente. Die Gliederung lässt sich mit Maus, Touch und Tastatur
   vergrößern; Höhe im Seitenpanel und Breite in großen Ansichten werden getrennt
   gespeichert. Diese Einstellungen schreiben keine Dokumentinhalte.
2. **Originaleditor:** Knoten, Texteditor, Auswahl, Abhaken, Tastatur, Verschieben,
   Zoom und Undo bleiben bei EOME beziehungsweise Lineage.
3. **Datenadapter:** Nur der gewählte Abschnitt wird an die Originalansicht
   übergeben und revisionsgeprüft zurückgeschrieben.

Die Dateiaufteilung ist eine Entscheidung beim Neuanlegen, unabhängig vom
Zielordner. Die Startansicht und der Anlagedialog bieten dieselben Varianten an;
die Ansicht eines bestehenden Dokuments zeigt ausschließlich dessen gespeicherte
Variante. `emergence-storage.mode` legt den Modus fest, die explizite Dateirolle
`emergence-companion-role` unterscheidet `document`, `index` und `section`.
Mehrdeutige oder widersprüchliche Metadaten werden vor jedem Abgleich abgewiesen.
Die Anzeige fehlender Kapiteldateien liest nur die Verknüpfungen aus der
Übersicht; sie listet Dateipfade auf, ohne eine Datei zu erzeugen oder zu ändern.

Die Gliederung trägt im Mehrdateimodus den Status jeder Kapiteldatei und bietet
deren Öffnen unabhängig von der Navigation im Hauptdokument an. Fehlende Dateien
haben keine aktive Öffnen-Schaltfläche. `readStoredForView` liefert vorhandene
Kapitel zusammen mit expliziten Einträgen in `unavailableFiles`; die strenge
Leseprüfung `readStored` bleibt für vollständige Validierung erhalten.
Schreibpläne überspringen nicht verfügbare Kapitel und erhalten ihre bisherigen
Verknüpfungen. Schreiboperationen auf diese Kapitel werden abgewiesen. Dadurch
bleiben andere Kapitel editierbar und Überschriften synchronisierbar, ohne
unbekannte Inhalte durch leere Dateien zu ersetzen. Wiederhergestellte Dateien
werden vor dem nächsten Schreiben erneut gelesen und geprüft.

## Darstellung

`styles.css` definiert einen zusammenhängenden, auf `.em-companion` begrenzten
Stil. Farben stammen aus Obsidian-Variablen. Es gibt keine separat gepflegte
Light/Dark-Palette und keine Svelte-Hash-Selektoren. Vorschau, Eingabefläche und
neue Gedanken haben dieselbe Textfarbe und Typografie; erledigte Gedanken
bleiben lesbar. Die Messflächen von EOME verwenden dieselbe Typografie wie die
sichtbaren Knoten. Links bleiben durch Unterstreichung erkennbar und lesbar.
Die Kapitelgliederung übernimmt die Schriftgröße und Zeilenhöhe der nativen
Obsidian-Gliederung ohne eigene Typografieregel. Gedanken verwenden 87,5 Prozent
der eingestellten Leseschriftgröße (bei 16 px also 14 px, mindestens 12 px),
in Vorschau und Bearbeitung gleichermaßen. Die Werkzeugleisten verwenden
24 px große Schaltflächen mit 14 px großen Symbolen. Lineages gespeicherte Mindestkartenhöhe wird
über dessen CSS-Variable `--min-node-height` angewendet; die Originalansicht
liest diese Option beim Mounten selbst nicht aus. Kurze Gedanken brauchen damit
keine 100 px hohe Leerfläche, lange Inhalte können weiterhin wachsen.
Aktive EOME-Eingabeflächen werden über Fokus-/Größenereignisse und Cytoscapes
öffentliche Pan-API in die sichtbare Fläche gebracht. Die Eingabefläche hat
eine am Host bemessene maximale Größe und scrollt lange Texte intern. Geometrie und gemessene Knotenbreiten werden nicht mit
nachträglichem CSS-Zusammendrücken auseinandergezogen.

`presentation.ts` setzt einmalig lokale Originaloptionen: gemeinsame
Ausgangsschriftgröße, kompakte Karten und 100 Prozent Startzoom. Nachfolgende
bewusste Änderungen in den Originaloptionen bleiben erhalten. Die Einstellungen
der eigenständigen Plugins werden nicht überschrieben. Das Profil wird in den
lokalen Ansichtsdaten gespeichert, nicht im Hauptdokument.

Cytoscape zeichnet Kanten auf Canvas. Deren Theme-Farbe wird deshalb über seine
öffentliche Stylesheet-API aktualisiert. Obsidian meldet Theme-/CSS-Änderungen über
`css-change`. Es werden dafür weder Methoden noch Prototypen ersetzt.

## Einbettungsgrenze

`hosted-view.ts` erweitert die jeweiligen Originalklassen. Speichern ist eine
explizite Überschreibung der View-Unterklasse bei ihrer Konstruktion. Die
Originalprototypen und bereits laufenden Instanzen bleiben unverändert.
`lineage-adapter.ts` komponiert den Original-Store, statt dessen Methoden
umzuschreiben. Während des Mountens verhindert der Standardmechanismus `inert`
unbeabsichtigtes Fokussieren; `HTMLElement.focus` wird nicht ersetzt.

Die Original-View wird geöffnet und anschließend über `onLoadFile` geladen.
Dadurch liest EOME seine eigenen gespeicherten Optionen vor der Darstellung.
Beobachter und Ereignisabonnements sind an den Lebenszyklus der Ansicht gebunden.

Die installierten Plugins bieten derzeit keine öffentliche, versionsübergreifende
API zum Einbetten eines schreibbaren Dokumentabschnitts. Die bestehenden
Datei-/Workspace-Fassaden und Lineages JSON-Ladepfad sind daher weiterhin
versionsgebundene Integrationsstellen. Das ist ausdrücklich keine Zusage einer
öffentlichen Plugin-API. Eine künftige Host-API sollte Dokumentzugriff,
Änderungsabonnement, Fokuszuständigkeit, Theme und `flush`/`dispose` explizit
annehmen. Diese Grenze ist von der Gestaltung getrennt und wird bei Updates
gegen die tatsächlichen Originaleditoren geprüft.

Vor dem Laden prüft `native-compatibility.ts` die benötigten Funktionen der
Originalansicht und bei Lineage die klonbaren Einstellungs- und Dokument-Stores.
Neuere Versionen werden nicht allein wegen ihrer Versionsnummer gesperrt.
Fehlende Funktionen führen zu einer verständlichen Meldung mit Plugin-Version
und einer Schaltfläche zum Öffnen der vorhandenen Begleitdatei. Diese Prüfung
ersetzt die Verhaltenstests gegen die Originaleditoren nicht.

Auch die zurückgegebenen Metadaten werden vor einem Schreibvorgang geprüft.
Eine unbekannte Gedankenformat-Version, ungültiges YAML oder eine doppelte
Formatkennung werden abgewiesen, selbst wenn der Gedankentext unverändert ist.
Die native Fehlerbehandlung bewahrt die zurückgegebene Fassung als Entwurf.

Beim Schließen sichert `shutdown()` einen noch offenen Text zusammen mit dem
vollständigen Abschnitt als wiederherstellbaren Entwurf, falls das Speichern
scheitert. Originaleditor, Beobachter, Fokuszuständigkeit und weitere Panels
werden auch nach einzelnen Fehlern freigegeben. Die Entwurfsspeicherung wird
auch dann versucht, wenn der Originaleditor einen Fehler beim Beenden meldet.
Normale Ansichtswechsel bleiben bei einem nicht abschließbaren Speichern
blockiert, damit die aktive Bearbeitung erhalten bleibt.

## Prüfung

`scripts/companion-design-native-check.mjs` prüft beide Theme-Klassen mit
Originalansichten: normale und erledigte Gedanken, vorhandene und neue
Texteditoren, Eingabefelder, gleiche Ausgangstypografie, Theme-Flächen sowie
schmale und breite Layouts. Standardtext wird auf mindestens 4,5:1 Kontrast
geprüft. Neben berechneten Werten werden lokale Screenshots erzeugt und visuell
kontrolliert. Theme, Ansicht, Layoutpräferenzen und Testdateien werden danach
wiederhergestellt beziehungsweise entfernt.

`scripts/companion-views-native-check.mjs` sichert zusätzlich die tatsächliche
Bedienung, mehrzeilige Inhalte, Schreibkonflikte und Ansichtswechsel ab.

`scripts/companion-lifecycle-native-check.mjs` prüft Neuanlegen und Auswählen
mehrerer Begleitdokumente, Löschen während der Bearbeitung, den Export offener
Entwürfe, das Wiederherstellen von Dateien, fehlende Haupt- und Abschnittsdateien
sowie beschädigte Metadaten. Eine nicht verfügbare Datei führt in eine
Aktionsansicht; ihre Editor-Sitzung wird ohne Schreibversuch beendet. Bereits
gestartete oder verspätete Schreibvorgänge dürfen sie nicht neu anlegen.

`scripts/companion-shutdown-native-check.mjs` simuliert einen nicht abschließbaren
Editor in beiden installierten Originalansichten. Es prüft den vollständigen
Entwurf einschließlich noch eingegebenem Text, dessen persistierte Fassung,
Markdown-Export, das Freigeben des Editors und das Abweisen verspäteter
Schreibvorgänge. Die Testdateien werden anschließend entfernt.
