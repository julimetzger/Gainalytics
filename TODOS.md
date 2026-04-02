# TODOs for the project

## Trainings

- [ready] [TRN-001](tickets/TRN-001-training-overview-record-comparison.yaml) Records in Training Overview - micro vergleich anzeigen
  - Im TrainingsNode für status Done und Overview
  - es gibt eine Kachel die anzeigt wieviele Records in diesem Micro waren im Vergleich zum vorherigen
- Overview mit Grafik für RIR Sets im Vergleich zum vorherigen Macro
- Labels für Sets/Workouts hinzufügen

## Analyse

- RIR Verlauf/ RIR distribution
- RIRmax/RIRaverage als metrik aufnehmen
- Pausenzeit generell und pro muskel/exercise (nur zwischen set im Workout berücksichtigen?? also dl satz 1 pause dl satz 2 pause dl satz 3 fertig -> 2 Pausenzeiten getrackt)

## Exercises

## Settings

## General

- Change build.gradle name, namespace and applicationId "PowerliftingWorkoutPlanner" to Gainalytics and refactor Code
- Performance Optimierung - check rerenders and add memoization

## Video Analyse Funktion

- [ready] [ANA-004](tickets/ANA-004-rep-detection-from-video-analysis.yaml) Erkennen von reps [VideoAnalysisDetails]
  - Rep zeit ermitteln anhand nulldurchlauf der Geschwindigkeit. Berechnung der durschnittlichen Geschwindigkeit der Rep.
    Ausgabe der Repzeiten erstmal nur als Zeiten für dir reps als Werte in der Zusammenfassung.
  - Anzeige einer Rep im overlay mit grüner Farbe als kurve während der Ausführung einer reptetion
  - den gesamten bar verlauf als hellgraue linie plotten. Ein bisschen deutlicher als im moment die punkte geplottet
    werden.
  - [ready] [ANA-004-fix](tickets/ANA-004-fix-hardcoded-rep-color.yaml) Hardcoded Farbe `#63A002` durch theme.colors Token ersetzen
- [ready] [ANA-003-fix2](tickets/ANA-003-fix2-marker-alignment.yaml) Marker-Linie am Velocity-Plot ausrichten (fängt zu früh an, hört zu spät auf)
- [ready] [ANA-007](tickets/ANA-007-playback-speed-control.yaml) Player Verbesserungen part 2 — Wiedergabegeschwindigkeit (0.1x–1.0x)
- [ready] [ANA-006](tickets/ANA-006-link-video-analysis-to-set.yaml) Verknüpfung eines Sets mit der Video Analysis (4 UI-Flows)
- [ready] [ANA-008](tickets/ANA-008-video-analysis-scaling-and-zoom.yaml) Video-Analyse Skalierung & Zoom im Velocity-Plot
  - Video + Velocity-Plot + Player-Bedienung zusammen auf einen Screen (Video kleiner machen)
  - Zoom im Velocity-Plot durch Pinch/Swipe wie in den sonstigen Plots
- performance verbessern

## Fun

- [ready] [FUN-001](tickets/FUN-001-cardio-easter-egg.yaml) Easter Egg — Cardio-Warnung bei mehr als 20 Reps

## Try out

- Toast für records Farben sind noch nicht passend
- onPress auf Toast navigiert zu Exercise Stats //TODO go to Exercise Stats
- Tabs für Analyse https://www.npmjs.com/package/react-native-paper-tabs

## Bugs
- Highlighted Values in Analyse sind gleich dargestellt wie Records, das ist verwirrend?

## Maintenance
- Analyse aller maestro flows
- [ready] [MNT-001](tickets/MNT-001-maestro-flow-analyse.yaml) Maestro-Flow Analyse — Startzeit messen & Import-Baseline prüfen
  - Zeit zum starten eines maestro flows nach agent start messen -> dokumentiere alle failures
  - Import baseline flow überprüfen- Vermutung: der funktioniert nicht mehr wenn es andere downloads gibt. Der flow findet dann base.gains nicht mehr weil zu weit unten.
  

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
- [ready] [MET-001](tickets/MET-001-metric-selection-in-metrics-overview.yaml) Auswahlmöglichkeit der Metriken in
  MetricsOverview
  - Stand: Es gibt sowohl für muscles als auch exercises drei vorbelegte metriken siehe MetricsOverview.png (für exercises 1RM, Reps, Max Intensity)
  - Anforderung 1: Sowohl für muscles als auch Exercises ist auswählbar welche Metrik für die einzelnen drei slots angezeitgt und vergleicht wird. Dazu gibt es bei press auf die Metric einen dropdown mit der Auswahlmöglichkeit aller metriken. Bei Klick auf eine der Metriken aus dem Dropdown wird die Spalte geupdated und die neue Metrik angezeigt. Diese auswahl wird separat für muscles und exercises auch im state gespeichert und ist für alle MetricOverviews ab jetzt geändert.
  - Anforderung 2: Muscles Overview über Exercise Overview verschieben

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
