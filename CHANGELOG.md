# 0.0.3

- Feldideen liefern eine gemeinsame Liste assoziierter Begriffe ohne automatische Feldzuordnung. Begriffe werden per Drag-and-drop oder über Begriffsauswahl und Zielfeld übernommen.
- Ziehgriffe im Graphen verschieben bestehende Breadcrumbs-Zuordnungen und aktualisieren die betroffenen Frontmatter-Felder, einschließlich explizit gespeicherter Gegenrichtungen. Aliase und unbeteiligte Notizdaten bleiben erhalten; Schreibkonflikte werden geprüft und bereits ausgeführte Schritte bei Fehlern zurückgenommen.
- Plus-Aktionen stehen ausschließlich am Gruppentitel und beziehen sich immer auf die zentrale Notiz. Der Eingabedialog nennt die betroffene Notiz ausdrücklich.
- Konzept und Urheberfelder erscheinen gemeinsam bei Notizen mit einem Untertag von `Werk` im Frontmatter-Feld `tags`. Andere zusätzliche Felder erscheinen bei vorhandenen Verbindungen. Die Feldideen berücksichtigen dieselbe Einschränkung.
- Sichtbare Ziehgriffe verdecken die dahinterliegende Linie; ohne Hover bleibt die Linie sichtbar. Tooltips an Begriffen und Griffen entfernt, Screenreader-Beschriftungen erhalten.
- SVG-Verbindungen an die neuen Bedienelemente angepasst; initialen Überlauf in schmalen Panels und Unterbrechungen beim Ziehen verhindert.
- 267 Regressionstests bestanden; sechs optionale Modelltests im Standardlauf übersprungen. Isolierter Obsidian-Oberflächentest bei 280, 360 und 480 Pixeln ohne Änderungen an echten Notizen bestanden.

# 0.0.2

- Die bisherige Relationssynopse heißt jetzt **Kontext**; gespeicherte Zuordnungen und Sichttiefen bleiben erhalten.
- Literaturaktionen blenden sich ohne Scrollsprünge ein: Die Literaturangabe bleibt stehen, nachfolgende Inhalte rücken nach unten.

- Zentrale Graphbeschriftung folgt Notiz-/Ordnerumbenennungen sofort, auch im Erkundungsmodus.
- Rückverweise aus Obsidians eigenem Linkindex unter den freien Verweisen ergänzt.
- Literatur in Graph und Suche als reiner CSL-Text mit sechs Symbolaktionen; ZotLit zuerst, Citekey ausschließlich über Kopiersymbol und Tooltip. Aktionen erscheinen bei Hover oder Tastaturfokus; ohne Hoverfähigkeiten bleiben sie sichtbar.
- Literaturaktionen und CSL-Kontext der Suche wechseln mit der aktuellen Notiz.

- Recherche vollständig entfernt; lokale Breadcrumbs-Feldideen bleiben erhalten.
- Ollama/Wikipedia auf Obsidian requestUrl und native Timer umgestellt; Abbruch, Timeout und Endpunktwechsel abgesichert.
- Einstellungen in der nativen Obsidian-Suche auffindbar; explizite Entwürfe und Speichern bleiben erhalten.
- Gemeldete CSS-/SVG-Hinweise behoben und drei Arbeitsbereiche an Obsidian-Themes ausgerichtet.

# 0.0.1

Erster öffentlicher Entwicklungsrelease von Emergence. Das Plugin ist für persönliche philosophische Begriffsarbeit entstanden und bleibt experimentell.

- Relationssynopse und Originalansichten von Breadcrumbs, ZotLit und Obsidian in einem vollflächigen Seitenpanel mit Ansichtsauswahl.
- Lokale Feldideen mit kontrollierter Ein-Klick-Übernahme kurzer Wikilinks. Neue Ziele erzeugen keine Datei.
- Lange Notizen werden bei Bedarf vollständig abschnittweise vorbereitet. Die abschließende Anfrage verwendet eine gekennzeichnete Arbeitszusammenfassung; die Originaldatei bleibt unverändert.
- Recherche behält pro Notiz ausschließlich das letzte Ergebnis. Neue Fragen ersetzen es; andere Notizen und alte Fragen werden nicht als Gesprächsverlauf mitgesendet.
- Globale Notiz-/Zotero-Suche, originale ZotLit-CSL-Formatierung und separate Citekey-Kopierfunktion.
- Optionale Wikipedia- und DuckDuckGo-Kontexte ohne Cloud-Modell oder Telemetrie.

Benötigt Obsidian Desktop 1.14.0 oder neuer. Breadcrumbs v4 und ZotLit 2.2 sind optionale, versionsabhängige Integrationen. KI-Funktionen benötigen Ollama mit einem bereits lokal installierten Modell. Zusammenfassungen und Modellideen können fachliche Fehler enthalten und sind keine automatische Faktenprüfung. Vorhandene Notizzitate werden offline formatiert; für die CSL-Formatierung bisher unzitierter Suchtreffer muss Zotero mit seiner lokalen API geöffnet sein.

Build, Tests, konkrete Prüfergebnisse und bekannte Grenzen stehen in `docs/VALIDATION.md`. Dieser Release behauptet keine bereits abgeschlossene Obsidian-Community-Prüfung.
