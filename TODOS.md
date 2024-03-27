# TODOs for the project

## Trainings:

- addWorkout mit neuer Übung befüllen als default Wert fürs eintragen
- ~~zeit anzeigen seit start des Trainings~~ aber noch nicht schön
- ~~Vergleich mit vorherigem Training~~/geplanten Workout nach Abschluss des Trainings
- Anzeige des planned Trainings während des Trainings
- Volumen/Set Unterstützung während des planens
- ~~Zusammenfassung als letzte Seite nach allen Trainings (Volumen, Sets, Muskelgruppen etc.)~~
- Export/Import Funktion für Trainings/Micro
- unfinished Workout und doneWorkout handling nicht robust (1 Set hinzufügen dann reload verliert alle planned Sätze)
- Vorschlag anhand abgeschlossenem Training aus Datepicker wenn nichts geplant
- swipen um zwischen trainings zu wechseln
- ~~anzeige des trainings im router oben~~ schöner machen
- ~~name für trainings~~ schöner machen
- ~~percentage für volume, sets und reps berücksichtigen~~
- ~~in der übersicht die muscle metriken klickbar machen und dann die übungen anzeigen. in der anzeige sieht man alle
  übungen mit wert der zugehörigen metrik (z.b reps) und zu wieviel prozent sie zur metrik beitragen und der wert
  multipliziert mit den prozenten.~~
- ~~Anzeige der muskelgruppen und exercises in voller länge in der Übersicht~~
- ~~Progressbar für Fortschritt nicht beendeter Übungen in der TrainingsPlanUebersicht~~ vergleich exercises mit done
  workouts anstatt planned workouts
- Rekorde speichern und Snackbar als Onscreen Toast
- mesos einführen mit Kopieren des alten mesos

## Analyse
- neue Seite für Darstellung volumen für bodyparts, übungen etc
- 2-7 Training accumalator
- ~~percentage für volume, sets und reps berücksichtigen~~
- ~~Spacing~~
- Segmented Buttons (Multiselect) zum Togglen von Exercises, Muscles und Metrics mit Namen um Funktion zu erklären

## History
- ~~swipe history~~
- Seite mit Datepicker
- Trainings in Datepicker anzeigen
- während scrollen horizontales swipen komplett unterbinden

## Exercises
- ~~Übersichtsseite mit 1RM - 12Rm~~
- Muskelgruppen hinzufügen schöner und robuster
- Hinzufügen Seite schöner
- ~~Rekorde speichern~~ nur 1RM nicht sicher was sonst noch Sinn macht

## Settings
- ~~Darkmode/Lightmode~~
- rir/rpe
- 1RM Buttone default mäßig an/aus
- Export/Import alles
- show timer on/off
- Metriken die im TrainingsOverview angezeigt werden sollen für Muscles/Exercises

## General
- ~~direkter klick möglich bei offenem keyboard überall~~ nochmal testen - funktioniert nur im ExerciseTab

## Video Analyse Funktion

## Try out
- https://www.npmjs.com/package/react-native-calendars/v/1.1286.0 kalender der auch Markierungen anzeigen kann. Period
  scheint auch zu funktionieren
- Toast für records

## Bugs

- ~~picker auswahl ist nicht mehr swipebar in history (whs muss man da auch die gesture ref mitgeben damit er swipes
  mitbekommt)~~
- ~~Trainingsübersicht crasht wenn ein planned training vor der überschicht ist~~
- ~~Picker wählt in der History bei Auswahl von Muskeln die jeweiligen Exercises aus für upper and lower ranges~~
- Crash wenn 2 exercises ausgewählt in der analyse

