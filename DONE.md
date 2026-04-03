## Test on device - app is released

### 153

- [ready] [ANA-005-fix](tickets/done/ANA-005-fix-codex-review.yaml) Fix Codex review findings + Progress-Bar für async video analysis (PR #23)
- [ready] [FUN-001](tickets/review/FUN-001-cardio-easter-egg.yaml) Easter Egg — Cardio-Warnung bei mehr als 20 Reps

### 152

- [ready] [ANA-005](tickets/ANA-005-async-video-analysis.yaml) Asynchrone Analyse des Videos
    - User kann währen der Analyse die app ganz normal benutzen. Notification weißt auf die fertige analyse hin
    - Der Loading spinner zeigt den Progress an. Hier wird die Zeit die gebraucht wird abgeschätzt anhand der letzten
      analysen. Dazu wird im state gespeichert wie lange eine Minute anaylse beim letzten video gebraucht wird und dann
      abgeschätzt wie lange die neue analyse brauch für die länge des videos. Für den ersten Wert nehmen wir an 1s
      analyse pro 1s Video.
- [ready] [ANA-005-fix](tickets/ANA-005-fix-codex-review.yaml) Codex-Review Fixes + realistische Progressbar:
  Notification, Permission, Service Ref-Count, echte Video-Dauer, Progressbar
- [ready] [TRN-002](tickets/done/TRN-002-linear-progression-from-last-training.yaml) progression einbauen bei hinzufügen
  aus
  letztem planned or done training ( linear)
    - rir erhöhen generell -> suggested weight geht hoch über 1RM estimate aus letztem planned/done training. Man kann
      hier sagen rir -+ Zahl. Wenn rir schon auf 0 dann passiert nichts für die Exercise.
    - % weight increasement
- [ready] [TRN-003](tickets/done/TRN-003-fix-done-notification-after-finish.yaml) Training done notification kommt auch
  wenn
  das training abgeschlossen ist
- [ready] [ANA-003-fix](tickets/done/ANA-003-fix-speed-chart-perf.yaml) Speed-Chart Performance — Progress-Marker aus
  Bridge
  entkoppeln

### 151

- [ANA-001](tickets/done/ANA-001-training-length-analysis-page.yaml) Seite mit TrainingsLänge mit Balkendiagramm im
  Analysetab
    - es gibt eine neue Seite im Analysetab mit Namen Trainingslänge
    - Im Tab wird die Trainingslänge als Balkendiagramm angezeigt
    - Filter ist über Accumulation Mode möglich (Day, Week, Month)
    - [ready] [ANA-001-fix](tickets/done/ANA-001-fix-bar-tap-selection.yaml) Bugfix: Klick auf Balken zeigt keine
      Detail-Tabelle (Float-Precision-Bug im Tap-Handler)

- [ANA-002] DateRangePicker funktioniert nicht im analyseTab analayse
    - auswahl eines Startpunktes per tab auf tag: Auswahl von dem tag bis heute - aktualisierung der Zeiten oben
    - auswahl einer Range tab auf start und Endpunkt: Aktualiesierung der Timestamps
    - Auswahl einer Range über die inputs oben
    - Alle drei Fälle sollen über maestro tests abgedeckt werden. Öffnen datepicker -> Fall durschpielen -> check im
      datepicker ob Tiemstamps oben passen -> zurück in analys -> check ob range passt in der Anzeige

- [ANA-003](tickets/done/ANA-003-video-player-improvements.yaml) Player verbesserungen [VideoAnalsysisDetails]
    - nicht sehr responsive die Anzeige der Zeit in dem Geschwindigkeitsblock ist nicht gut. Die progress bar hängt oft
      hinterher. Weitere Entkopplung vom js bridge als Option.
    - Auswahl der Zeit im Player durch klich auf Geschwindigkeitsgraph
    - buttons um Zeit um 0.05s 0.2s zurück oder vor zu setzen und dienen Erkenntnissen

| Feature                                                                                        | version | passed                    | Notes                                                                                                                                                                           |
|------------------------------------------------------------------------------------------------|---------|---------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [ANA-005](tickets/ANA-005-async-video-analysis.yaml) Asynchrone Video-Analyse                  | 152     |                           |                                                                                                                                                                                 |
| [ANA-005-fix](tickets/ANA-005-fix-codex-review.yaml) Codex-Review Fixes + Progressbar          | 152     |                           | progressbar nicht sichbar, keine theme farben und app ist gegen Ende der Analyse komplett unresponsiv -> muss neugestartet werden                                               |
| [TRN-002](tickets/done/TRN-002-linear-progression-from-last-training.yaml) Lineare Progression | 152     | passed - neue Anforderung | anzeige ist da -> lineare progression funktioniert für rir, für Prozent aber inkonsistent, scheint mit RIR zusammenzuhängen. Extra button um die lineare progression anzuwenden |
| [TRN-003](tickets/done/TRN-003-fix-done-notification-after-finish.yaml) Done Notification Fix  | 152     | passed                    |                                                                                                                                                                                 |
| [ANA-003-fix](tickets/done/ANA-003-fix-speed-chart-perf.yaml) Speed-Chart Performance          | 152     | passed                    |                                                                                                                                                                                 | 
| [ANA-001](tickets/done/ANA-001-training-length-analysis-page.yaml) Training Length Analyse     | 151     | passed                    | Defect: [ANA-001-fix](tickets/done/ANA-001-fix-bar-tap-selection.yaml) Tap auf Balken zeigt keine Detail-Tabelle                                                                |
| [ANA-002] DateRangePicker Fix                                                                  | 151     | passed                    |                                                                                                                                                                                 |
| [ANA-003](tickets/done/ANA-003-video-player-improvements.yaml) Video Player Verbesserungen     | 151     | passed                    |                                                                                                                                                                                 |
| **Export/Import Funktion für Trainings/Micro**                                                 | 145     |                           |                                                                                                                                                                                 |
| Trainings löschbar machen                                                                      | 145     |                           |                                                                                                                                                                                 |

## Google Release Test
