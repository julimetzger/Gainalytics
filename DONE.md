## Test on device - app is released

### 152

- [ready] [TRN-002](tickets/TRN-002-linear-progression-from-last-training.yaml) progression einbauen bei hinzufügen aus
  letztem planned or done training ( linear)
    - rir erhöhen generell -> suggested weight geht hoch über 1RM estimate aus letztem planned/done training. Man kann
      hier sagen rir -+ Zahl. Wenn rir schon auf 0 dann passiert nichts für die Exercise.
    - % weight increasement
- [ready] [TRN-003](tickets/TRN-003-fix-done-notification-after-finish.yaml) Training done notification kommt auch wenn
  das training abgeschlossen ist
- [ready] [ANA-004](tickets/ANA-004-rep-detection-from-video-analysis.yaml) Erkennen von reps [VideoAnalysisDetails]
  - Rep zeit ermitteln anhand nulldurchlauf der Geschwindigkeit. Berechnung der durschnittlichen Geschwindigkeit der Rep.
    Ausgabe der Repzeiten erstmal nur als Zeiten für dir reps als Werte in der Zusammenfassung.
  - Anzeige einer Rep im overlay mit grüner Farbe als kurve während der Ausführung einer reptetion
  - den gesamten bar verlauf als hellgraue linie plotten. Ein bisschen deutlicher als im moment die punkte geplottet
    werden.
- [ready] [ANA-003-fix](tickets/ANA-003-fix-speed-chart-perf.yaml) Speed-Chart Performance — Progress-Marker aus Bridge
    entkoppeln

### 151

- [ANA-001](tickets/ANA-001-training-length-analysis-page.yaml) Seite mit TrainingsLänge mit Balkendiagramm im
  Analysetab
    - es gibt eine neue Seite im Analysetab mit Namen Trainingslänge
    - Im Tab wird die Trainingslänge als Balkendiagramm angezeigt
    - Filter ist über Accumulation Mode möglich (Day, Week, Month)
    - [ready] [ANA-001-fix](tickets/ANA-001-fix-bar-tap-selection.yaml) Bugfix: Klick auf Balken zeigt keine
      Detail-Tabelle (Float-Precision-Bug im Tap-Handler)

- [ANA-002] DateRangePicker funktioniert nicht im analyseTab analayse
    - auswahl eines Startpunktes per tab auf tag: Auswahl von dem tag bis heute - aktualisierung der Zeiten oben
    - auswahl einer Range tab auf start und Endpunkt: Aktualiesierung der Timestamps
    - Auswahl einer Range über die inputs oben
    - Alle drei Fälle sollen über maestro tests abgedeckt werden. Öffnen datepicker -> Fall durschpielen -> check im
      datepicker ob Tiemstamps oben passen -> zurück in analys -> check ob range passt in der Anzeige

- [ANA-003](tickets/ANA-003-video-player-improvements.yaml) Player verbesserungen [VideoAnalsysisDetails]
    - nicht sehr responsive die Anzeige der Zeit in dem Geschwindigkeitsblock ist nicht gut. Die progress bar hängt oft
      hinterher. Weitere Entkopplung vom js bridge als Option.
    - Auswahl der Zeit im Player durch klich auf Geschwindigkeitsgraph
    - buttons um Zeit um 0.05s 0.2s zurück oder vor zu setzen und dienen Erkenntnissen

| Feature                                                                               | version | passed | Notes                                                                                                       |
|---------------------------------------------------------------------------------------|---------|--------|-------------------------------------------------------------------------------------------------------------|
| [ANA-001](tickets/ANA-001-training-length-analysis-page.yaml) Training Length Analyse | 151     |        | Defect: [ANA-001-fix](tickets/ANA-001-fix-bar-tap-selection.yaml) Tap auf Balken zeigt keine Detail-Tabelle |
| [ANA-002] DateRangePicker Fix                                                         | 151     |        |                                                                                                             |
| [ANA-003](tickets/ANA-003-video-player-improvements.yaml) Video Player Verbesserungen | 151     |        |                                                                                                             |
| **Export/Import Funktion für Trainings/Micro**                                        | 145     |        |                                                                                                             |
| Trainings löschbar machen                                                             | 145     |        |                                                                                                             |

## Google Release Test
