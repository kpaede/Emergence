# Kritischer Prüfdurchgang: Begleitdokument

Stand: 22. November 2026. Schwerpunkt sind echte Fehlbedienungen, falsche
Dateiänderungen, Lesbarkeit und Lebenszyklus. Diese Prüfung umfasst den lokalen
Obsidian-Desktop mit EOME 0.2.4 und Lineage 0.8.5; sie ist keine Aussage über
beliebige zukünftige Originalplugin-Versionen oder alle Mobile-Themes.

## Behobene Befunde

| Bereich | Reproduzierter Fehler | Änderung / Absicherung |
| --- | --- | --- |
| Native Datenzuordnung | Bei gleichlautenden Einträgen konnte eine alte Bearbeitung den falschen Eintrag treffen. | Beidseitig eindeutige Zuordnung; Duplikate erhalten neue flüchtige Referenzen. Veraltete Änderungen werden abgewiesen. |
| Externe Änderungen | Gleichlautende Teilbäume verschiedener Tiefe wurden nach Austausch den alten Positionen zugeordnet. | Eindeutigkeit gilt unabhängig von der Einrückung; alte Edit- und Move-Aufträge scheitern bei Mehrdeutigkeit. |
| Lineage-Leerzustand | Öffnen/Schließen eines leeren Abschnitts erzeugte einen echten leeren Listeneintrag. | Nur der unberührte native Startplatzhalter wird als ursprünglicher leerer Body gespeichert; echte Bearbeitungen bleiben erhalten. |
| Zwischenablage | Nach erfolgreichem Lesen einer leeren Zwischenablage wurde alter interner Inhalt erneut eingefügt oder verschoben. | Interner Fallback nur bei Lesefehler. Leerer erfolgreicher Inhalt verändert nichts. |
| Dokumentwechsel | Während einer Speicherung angeforderte Reader-Dokumente konnten still verloren gehen. | Ausstehende Mutation abschließen; automatische Zuordnung erst danach ändern; neueste Anforderung prüfen. Hintergrund-Repaints übernehmen keine aktive Eingabe. |
| Ansichtswechsel | Nach Auswahl von Outline/Lineage blieb die Tastatur auf dem Dropdown. | Nach abgeschlossenem Mount Fokus auf die gewählte Ansicht, ausschließlich wenn der Nutzer inzwischen nicht anderswo arbeitet. Überholte Wechsel verwerfen. |
| Native-Lebenszyklus | Verspätete Mounts konnten Beobachter oder Fehler auf eine jüngere Ansicht anwenden. | Mount-Phasen vor Schließen/Flush abwarten; überholte Ergebnisse an den geprüften asynchronen Mount- und Close-Grenzen abweisen. |
| EOME-Aktualisierung | Vorzeitiges Ändern von `view.data` konnte EOMEs eigene Aktualisierungserkennung umgehen. | Die Original-Setter-API erhält den geänderten Inhalt, bevor sie ihren Datenstand selbst übernimmt. |
| EOME-Speicherabbruch | Nach abgewiesener Speicherung konnte ein Editorhost ohne registrierten Fokusowner stehen bleiben und den Ansichtswechsel blockieren. | Die öffentlichen `onClose`-/`onOpen`-Methoden schließen auch transiente Editoren; danach wird die gespeicherte Fassung geladen. Native Konfliktprüfung mit beiden Originaleditoren bestanden. |
| Konfliktmeldung / Undo | Doppelte Erklärungen und nach externen Änderungen überholte EOME-Undo-Angebote. | Eine kurze Konfliktmeldung; nur die eingebettete EOME-History bei echtem externem Inhaltswechsel leeren. Keine fremde History oder Originalinstallation ändern. |
| Gliederung | Keine vertikale Pfeilnavigation, Fokusverlust nach Auswahl und wieder aufklappende ausgewählte Überschriften. | Tastaturbaum mit einem Zeileneinstieg; sichtbare Zeilen navigierbar, Fokus beim Render erhalten; nur notwendige Vorfahren automatisch öffnen. |
| Sprachwechsel | Suchfeld, Werkzeuge, Eintragsaktionen und offene Editoren blieben teilweise in der alten Sprache. | Bestehende Bedienelemente umbeschriften; Text, Cursor, Suche und Fokus erhalten. |
| Speicher / Listener | Entfernte Reader-Ansichten ließen Markdown-Renderchildren und Listener aktiv. | Render- und Navigationskomponenten beim Retire explizit entladen. |
| Große Listen | Der Verschieben-Dialog validierte jede mögliche Position durch erneutes Parsen des ganzen Dokuments. | Vorauswahl anhand des vorhandenen Index; vollständige Validierung erst bei gewähltem Ziel und Mutation. |
| Markdown-Metadaten | Einheitliches Format 2 wurde global und zusätzlich an jedem Abschnitt vermerkt. | Gemeinsames Format nur global; lokale Formatwerte bleiben für gemischte Altdaten erhalten. |
| Veraltete Oberfläche | Nicht mehr verwendete Board-/Eingabekomponenten, Mindmap-Kopiermethode und Entwurfstexte verblieben im Quellcode. | Alte Komponenten, Kopiermethode, Entwurfstyp und ausschließlich dort verwendete Beschriftungen entfernt. Aktive Ansichten bleiben Outline, EOME und Lineage. |

Der Filter verwendet das gewünschte Lucide-Symbol `list-todo`.

## Daten- und Gestaltungsprüfung

- Einzelne Einträge bleiben normales eingerücktes Markdown. Ihre Referenzen
  existieren nur im Arbeitsspeicher und werden nicht an Einträge geschrieben.
- Kapitelkennungen und Zuordnungsmetadaten bleiben notwendig. Der Haupttext wird
  nicht im Frontmatter kopiert; Abschnittsvergleiche verwenden Fingerprints.
- Tabs definieren die Baumstruktur, Textfortsetzungen die Mehrzeiligkeit.
  Interne Listen, Überschriften, Zitate und Code werden nicht zu Untereinträgen.
- Fehlende Kapitel bleiben ausdrücklich nicht verfügbar. Sie werden weder als
  leere Inhalte behandelt noch unaufgefordert neu erzeugt. Bestehende Kapitel
  bleiben separat auswählbar und bearbeitbar.
- Einträge werden transaktional geändert. Konflikte schützen externe Inhalte;
  nach Fehlern gilt der tatsächlich gespeicherte Stand. Es gibt keine
  Ansichtsentwürfe, Exportkopien oder zusätzliche Sicherungsnotizen.
- Das vorhandene Wiederherstellungsjournal schützt unterbrochene Mehrdatei-
  Operationen. Es hat einen konkreten Speicherzweck und ersetzt keine Notizen.
- EOME und Lineage behalten ihre eigenen Editor-, Tastatur- und Undo-Funktionen.
  Globale Prototypen, fremde Plugininstallationen und deren Einstellungen werden
  nicht für die Einbettung verändert.
- Ansichtsauswahl steht beim Bearbeitungsbereich. Erstellen/Auswählen sind
  kontextabhängig angeordnet; Kopfzeile und Dokumentmenü wiederholen diese
  Aktionen nicht als parallele Symbole.
- Eingabe beginnt kompakt, wächst und schrumpft mit dem Text. Hell/Dunkel,
  Eingabekontrast, schmale Ansichten und die Outline-Theme-Klassen und Schriftgrößen
  werden in der nativen Obsidian-Prüfung betrachtet.

## Verbleibende konkrete Integrationsgrenze

EOME 0.2.4 bietet im eingebetteten Kontextmenü weiterhin **Add heading for this
tree** an. Diese Aktion erzeugt eine Strukturüberschrift außerhalb der Liste und
wird von der Dateigrenze abgelehnt. Überschriften innerhalb eines Eintrags sind
weiterhin erlaubt. Die aktuelle EOME-Version stellt keinen öffentlichen
Schalter bereit, um nur diese strukturelle Aktion auszublenden.

Es wird kein privates Menü umgebaut und kein vollständiges Ersatzmenü gepflegt.
Ein minimaler offizieller EOME-Schalter ist als übernehmbarer Patch und
[Übergabeauftrag](eome-host-capability.md) vorbereitet. Emergence erkennt den
optionalen Schalter bereits und setzt ihn nur für seine eingebettete Instanz.
Erst nach Übernahme in EOME verschwindet der unerwünschte Menüpunkt dort.

## Validierung

Geprüft am 22. November 2026 mit Obsidian Desktop 1.15.1 auf macOS, EOME 0.2.4
und Lineage 0.8.5:

- `npm run build` einschließlich TypeScript-Prüfung: bestanden.
- `npm run lint`: bestanden.
- `npm test`: **833 bestanden**, sechs optionale Modellintegrationstests
  übersprungen, keine fehlgeschlagenen Tests.

| Native Obsidian-Prüfung | Bestandene Prüfungen |
| --- | ---: |
| Hierarchical Outline, Fokuswechsel, Tastatur, Einfügen, Checkboxen, Drag-and-drop und Eingaben | 181 |
| Originalansichten, lange Markdown-Texte, externe Aktualisierung und absichtliche Speicherkonflikte | 41 |
| Dokumentlebenszyklus, fehlende Kapiteldateien, Wiederherstellung und Löschung | 44 |
| Schließen bei Speicherfehlern, Ressourcenfreigabe und ausbleibende Kopien | 15 |
| Hell/Dunkel, Eingabekontraste, gemeinsame Schriftgrößen, schmale Ansichten und Teilung | 59 |

Die Reproduktionen stehen in den `tests/companion-*.test.ts`-Dateien sowie den
entsprechenden `scripts/companion-*-native-check.mjs`-Skripten. Native Prüfungen
verwenden temporäre Dateien und stellen vorherige Ansicht, Einstellungen und
Theme wieder her. Abschließend geprüft: keine temporären Testdateien, offenen
Testeditoren oder Dialoge; installierter Build entspricht dem geprüften Build.
Die eigenen Originalinstallationen von EOME und Lineage wurden nicht verändert.
