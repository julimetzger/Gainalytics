## Test on device - app is released

- [ANA-001](tickets/ANA-001-training-length-analysis-page.yaml) Seite mit TrainingsLänge mit Balkendiagramm im
  Analysetab
    - es gibt eine neue Seite im Analysetab mit Namen Trainingslänge
    - Im Tab wird die Trainingslänge als Balkendiagramm angezeigt
    - Filter ist über Accumulation Mode möglich (Day, Week, Month)

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

| Feature                                        | version | passed | Notes |
|------------------------------------------------|---------|--------|-------|
| **Export/Import Funktion für Trainings/Micro** | 145     |        |       |
| Trainings löschbar machen                      | 145     |        |       |

## Google Release Test
