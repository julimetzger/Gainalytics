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
- [ready] [GH-293](https://github.com/julimetzger/Gainalytics/issues/293) Ai chat history — Verläufe archivieren, fortsetzen und durchsuchen
  - Chat-Inhalte als Datei auf Platte, Metadaten in Redux
  - "Clear" und "Ask AI" archivieren statt zu verwerfen; alter Verlauf lässt sich laden und weiterschreiben
  - Volltextsuche über alle Nachrichten; kein Auto-Cleanup, Löschen nur manuell
- [ready] [GH-361](https://github.com/julimetzger/Gainalytics/issues/361) AI-Chat ignoriert die Claude-Model-Einstellung (Coach-Insights respektieren sie)

## Exercises

- [ready] [GH-163](https://github.com/julimetzger/Gainalytics/issues/163) Muscle-Involvement Picker — Quick % Chips (Variante C) + Migration
  - Design (bindend): `docs/tickets/GH-163/design-variante-c.png`
  - Ersetzt DropDown+TextInput-UX durch Chip-Row `25 / 50 / 75 / 100` pro Muscle, Search-Filter, Summary-Footer, Farbbalken-Indikator
  - Tap auf aktiven Chip = Deselect (einzige Möglichkeit, Muscle zu entfernen)
  - Redux-persist Migration `9`: Percent-Werte auf nächstkleineren Stufen-Wert runden; `< 25` entfernt Muscle aus `muscles[]`

## Settings

## General

- [ready] [GH-339](https://github.com/julimetzger/Gainalytics/issues/339) Redesign edit modals — alle Edit-Pop-ups auf das Edit-Exercise-Muster vereinheitlichen ([tickets/GH-339-redesign-edit-modals.yaml](tickets/GH-339-redesign-edit-modals.yaml))
  - Design-Richtung A: Pop-ups bleiben Pop-ups, nur visueller Stil des Edit-Exercise-Screens übernehmen (kein Umbau zu Vollbild-Sheets)
  - 7 Modals: Rest-Ziel, Trainingslänge, Satz-Auswahl, Video-Auswahl, Übungs-Alternativen, Metrik-Auswahl, Übungs-Rekorde
  - Alle Funktionen bleiben; Vorher/Nachher-Maestro-Screenshots pro Modal
- Change build.gradle name, namespace and applicationId "PowerliftingWorkoutPlanner" to Gainalytics and refactor Code
- Performance Optimierung - check rerenders and add memoization

## Video Analyse Funktion

- [done] ~~[ANA-004](tickets/done/ANA-004-rep-detection-from-video-analysis.yaml) Erkennen von reps [VideoAnalysisDetails]~~ (umgesetzt: RepDetection.java + nativer Bar-Path-Overlay)
- [ready] [ANA-003-fix2](tickets/ANA-003-fix2-marker-alignment.yaml) Marker-Linie am Velocity-Plot ausrichten (fängt zu früh an, hört zu spät auf)
- [done] ~~[ANA-007](tickets/done/ANA-007-playback-speed-control.yaml) Player Verbesserungen part 2 — Wiedergabegeschwindigkeit (0.1x–1.0x)~~ (umgesetzt: native Prop + Speed-Chips)
- [ready] [ANA-006](tickets/ANA-006-link-video-analysis-to-set.yaml) Verknüpfung eines Sets mit der Video Analysis (4 UI-Flows)
- [ready] [ANA-008](tickets/ANA-008-video-analysis-scaling-and-zoom.yaml) Video-Analyse Skalierung & Zoom im Velocity-Plot
  - ~~Zoom im Velocity-Plot durch Pinch/Swipe wie in den sonstigen Plots~~ (umgesetzt)
  - Video + Velocity-Plot + Player-Bedienung zusammen auf einen Screen ohne Scrollen (Video kleiner machen) — noch offen
- [ready] [GH-360](https://github.com/julimetzger/Gainalytics/issues/360) Compare Analyses: Videos synchronisieren + gemeinsamer Scrubber
  - Gemeinsamer Scrubber in absoluten ms des längeren Videos, Auto-Ausrichtung auf Rep 1 Lift-off + manueller ±-Versatz
  - Play-Bar wie im Detail-Screen (Transport-Reihe, Speed-Chips, Rep-Ticks); Analysis B auf tertiary statt rot
  - Est. 1RM ausdrücklich raus
- [ready] [GH-363](https://github.com/julimetzger/Gainalytics/issues/363) Compare Analyses: KPI-Vergleichsheader (Mean/Peak Velocity, Δ)
  - Set-Level-Aggregation + vAvg/vPeak=0-Fallback-Bug; kein Est. 1RM
- [ready] [GH-321](https://github.com/julimetzger/Gainalytics/issues/321) Videos für Analyse nicht kopieren — direkt aus der Galerie abspielen
  - Kein Hinweis beim Import; stattdessen pro Analyse ein "Vollimport"-Knopf mit Tooltip, der das Video nachträglich in die App holt
  - Analyse-Ergebnisse bleiben nutzbar, wenn das Quellvideo aus der Galerie gelöscht wird; Player zeigt "nicht verfügbar"
  - Playback muss einen App-Neustart überleben
- performance verbessern

## Fun

- [ready] [FUN-001](tickets/FUN-001-cardio-easter-egg.yaml) Easter Egg — Cardio-Warnung bei mehr als 20 Reps

## Try out

- Toast für records Farben sind noch nicht passend
- onPress auf Toast navigiert zu Exercise Stats //TODO go to Exercise Stats
- Tabs für Analyse https://www.npmjs.com/package/react-native-paper-tabs

## Bugs
- Highlighted Values in Analyse sind gleich dargestellt wie Records, das ist verwirrend?
- [PR #179] [GH-177](https://github.com/julimetzger/Gainalytics/issues/177) Video analysis scrubber und velocity line kein sync

## Maintenance
- Analyse aller maestro flows
- [ready] [MNT-001](tickets/MNT-001-maestro-flow-analyse.yaml) Maestro-Flow Analyse — Startzeit messen & Import-Baseline prüfen
  - Zeit zum starten eines maestro flows nach agent start messen -> dokumentiere alle failures
  - Import baseline flow überprüfen- Vermutung: der funktioniert nicht mehr wenn es andere downloads gibt. Der flow findet dann base.gains nicht mehr weil zu weit unten.
- [ready] [MNT-002](tickets/MNT-002-fgs-mediaprocessing-migration.yaml) Foreground Service von dataSync auf mediaProcessing migrieren — Play-Console-Deklaration entfällt, targetSdk-35-Timeout vermeiden
  

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
