# TODOs for the project

## Trainings

- [ready] [TRN-001](tickets/TRN-001-training-overview-record-comparison.yaml) Records in Training Overview - micro vergleich anzeigen
  - Im TrainingsNode für status Done und Overview
  - es gibt eine Kachel die anzeigt wieviele Records in diesem Micro waren im Vergleich zum vorherigen
- [ready] [TRN-002](tickets/TRN-002-linear-progression-from-last-training.yaml) progression einbauen bei hinzufügen aus letztem planned or done training ( linear) 
  - rir erhöhen generell -> suggested weight geht hoch über 1RM estimate aus letztem planned/done training. Man kann hier sagen rir -+ Zahl. Wenn rir schon auf 0 dann passiert nichts für die Exercise.
  - % weight increasement
- Overview mit Grafik für RIR Sets im Vergleich zum vorherigen Macro
- Labels für Sets/Workouts hinzufügen

## Analyse

- [ready] [ANA-001](tickets/ANA-001-training-length-analysis-page.yaml) Seite mit TrainingsLänge mit Balkendiagramm im Analysetab
  - es gibt eine neue Seite im Analysetab mit Namen Trainingslänge
  - Im Tab wird die Trainingslänge als Balkendiagramm angezeigt
  - Filter ist über Accumulation Mode möglich (Day, Week, Month)
- RIR Verlauf/ RIR distribution
- RIRmax/RIRaverage als metrik aufnehmen
- Pausenzeit generell und pro muskel/exercise (nur zwischen set im Workout berücksichtigen?? also dl satz 1 pause dl satz 2 pause dl satz 3 fertig -> 2 Pausenzeiten getrackt)

## Exercises

## Settings

## General

- Change build.gradle name, namespace and applicationId "PowerliftingWorkoutPlanner" to Gainalytics and refactor Code
- Performance Optimierung - check rerenders and add memoization

## Video Analyse Funktion

- Erkennen von reps [VideoAnalysisDetails]
  - Rep zeit ermitteln anhand nulldurchlauf der Geschwindigkeit. Berechnung der durschnittlichen Geschwindigkeit der Rep. Ausgabe der Repzeiten erstmal nur als Zeiten für dir reps als Werte in der Zusammenfassung.
  - Anzeige einer Rep im overlay mit grüner Farbe als kurve während der Ausführung einer reptetion
- [ready] [ANA-003](tickets/ANA-003-video-player-improvements.yaml) Player verbesserungen [VideoAnalsysisDetails]
  - nicht sehr responsive die Anzeige der Zeit in dem Geschwindigkeitsblock ist nicht gut. Die progress bar hängt oft hinterher. Weitere Entkopplung vom js bridge als Option.
  - Auswahl der Zeit im Player durch klich auf Geschwindigkeitsgraph
  - buttons um Zeit um 0.05s 0.2s zurück oder vor zu setzen und dienen Erkenntnissen
- Player Verbesserungen part 2 [VideoAnalysisDeteils]
  - Playergeschwindigkeite einstellen in 0.1er prozent schritten also von 0.1 bis 1.0 der tatsächlichen Geschwindigkeit
- performance verbessern

## Try out

- Toast für records Farben sind noch nicht passend
- onPress auf Toast navigiert zu Exercise Stats //TODO go to Exercise Stats
- Tabs für Analyse https://www.npmjs.com/package/react-native-paper-tabs

## Bugs
- Training done notification kommt auch wenn das training abgeschlossen ist

- Highlighted Values in Analyse sind gleich dargestellt wie Records, das ist verwirrend?
- [ready] DateRangePicker funktioniert nicht im analyseTab analayse
  - auswahl eines Startpunktes per tab auf tag: Auswahl von dem tag bis heute - aktualisierung der Zeiten oben
  - auswahl einer Range tab auf start und Endpunkt: Aktualiesierung der Timestamps
  - Auswahl einer Range über die inputs oben 
  - Alle drei Fälle sollen über maestro tests abgedeckt werden. Öffnen datepicker -> Fall durschpielen -> check im datepicker ob Tiemstamps oben passen -> zurück in analys -> check ob range passt in der Anzeige
  

## Low Prio Themen

## Trainings

- Mesos einführen mit Kopieren des alten Mesos
- unfinished Workout und doneWorkout handling nicht robust (1 Set hinzufügen dann reload verliert alle planned Sätze)
- Vorschlag anhand abgeschlossenem Training aus Datepicker wenn nichts geplant
- Progressbar vergleich exercises mit done workouts anstatt planned workouts?
- Records in Overview anzeigen
- TrainingsTimer onLongPress ruft Pause Timer auf
- Add "Next Training" Button

## Analyse

- Seite mit Datepicker
- Auswahlmöglichkeit der Metriken in MetricsOverview

## Exercises

- History Pokal Symbol nur beim 1RM Rekord?!

## Settings

- Show/hide Toasts, einzelne Toasts aktivierbar machen
- RIR/RPE
- Metriken die im TrainingsOverview/Overview angezeigt werden sollen für Muscles/Exercises
- Hide/show "kg"
- Default DatePicker range
- Backup-Automatisierung mit Zeitplan hinzufügen
- Tutorial/Onboarding-System implementieren
- Feedback-System einbauen
- Weitere Statistiken hinzufügen (z.B. durchschnittliche Trainingsdauer, Lieblingsübungen)

## General

- Change build.gradle name, namespace and applicationId "PowerliftingWorkoutPlanner" to Gainalytics and refactor Code
- Performance Optimierung - check rerenders and add memoization
- ~~direkter klick möglich bei offenem keyboard überall~~ nochmal testen - funktioniert nur im ExerciseTab

## Performance-Optimierung

- Memoization erweitern: Obwohl bereits einige Komponenten memo() verwenden, gibt es noch viele Stellen ohne Optimierung
- useCallback/useMemo: Event-Handler und teure Berechnungen sollten mit useCallback/useMemo optimiert werden
- Redux-Selector-Optimierung: Viele Selektoren führen bei jedem Render neue Berechnungen durch
