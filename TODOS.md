# TODOs for the project

## Trainings

- **Export/Import Funktion für Trainings/Micro**
- Records in Overview anzeigen
- progression einbauen bei hinzufügen aus letztem planned or done training ( linear)
- Auf Trainingsübersicht Seite Metriken einblenden (sets, volume, RIR average, max RIR, Sets pro Muskelgruppe als Grafik?)
- Overview mit Grafik für RIR Sets im Vergleich zum vorherigen Macro
- Labels für Sets/Workouts hinzufügen

## Analyse

- Seite mit TrainingsLänge mit Balkendiagramm
- RIR Verlauf/ RIR distribution
- RIRmax/RIRaverage als metrik aufnehmen
- Pausenzeit generell und pro muskel/exercise (nur zwischen set im Workout berücksichtigen?? also dl satz 1 pause dl satz 2 pause dl satz 3 fertig -> 2 Pausenzeiten getrackt)

## Exercises

## Settings

## General

- Change build.gradle name, namespace and applicationId "PowerliftingWorkoutPlanner" to Gainalytics and refactor Code
- Performance Optimierung - check rerenders and add memoization
- ~~direkter klick möglich bei offenem keyboard überall~~ nochmal testen - funktioniert nur im ExerciseTab

## Video Analyse Funktion

## Try out

- Toast für records Farben sind noch nicht passend
- onPress auf Toast navigiert zu Exercise Stats //TODO go to Exercise Stats
- Tabs für Analyse https://www.npmjs.com/package/react-native-paper-tabs
- Farbpalette erweitern mit https://github.com/pchmn/expo-material3-theme https://callstack.github.io/react-native-paper/docs/guides/theming/

## Bugs

- no ignore swipe in Analyse Tabs entfernen
- Enable Dark Mode Switch setze alle Switche auf "on"
- Push Timer funktioniert nur manchmal, bei manuellem Reset des Timers und nicht bei Haken
- Push Timer funktioniert nur bei App im Vordergrund. https://www.npmjs.com/package/react-native-background-timer
- Highlighted Values in Analyse sind gleich dargestellt wie Records, das ist verwirrend?

## Low Prio Themen

## Trainings

- Mesos einführen mit Kopieren des alten Mesos
- Trainings löschbar machen
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

- Nur ein Rekord pro Tag/Workout speichern in Stats, aber es soll immer ein Toast angezeigt werden, History Pokal Symbol nur beim 1RM Rekord?!

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