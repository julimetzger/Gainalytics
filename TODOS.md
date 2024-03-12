# TODOs for the project

## Trainings:
- planned directly to done ?? 
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
- anzeige des trainings im router oben
- name für trainings
- percentage für volume, sets und reps berücksichtigen
- in der übersicht die muscle metriken klickbar machen und dann die übungen anzeigen. in der anzeige sieht man alle übungen mit wert der zugehörigen metrik (z.b reps) und zu wieviel prozent sie zur metrik beitragen und der wert multipliziert mit den prozenten.
- Anzeige der muskelgruppen und exercises in voller länge in der Übersicht 

## Analyse
- neue Seite für Darstellung volumen für bodyparts, übungen etc
- 2-7 Training accumalator
- Spacing

## History
- ~~swipe history~~
- Seite mit Datepicker
- Trainings in Datepicker anzeigen
- während scrollen horizonztales swipen kmplett unterbinden

## Exercises
- Übersichtsseite mit 1RM - 12Rm
- Muskelgruppen hinzufügen schöner und robuster
- Hinzufügen Seite schöner
- Rekorde speichern

## Settings
- Darkmode/Lightmode
- rir/rpe
- 1RM Buttone default mäßig an/aus
- Export/Import alles
- show timer on/off
- Metriken die im TrainingsOverview angezeigt werden sollen für Muscles/Exercises

## General
- ~~direkter klick möglich bei offenem keyboard überall~~ nochmal testen - funktioniert nur im ExerciseTab

## Video Analyse Funktion

## Try out
- https://www.npmjs.com/package/react-native-calendars/v/1.1286.0 kalender der auch Markierungen anzeigen kann. Period scheint auch zu funktionieren
- Toast für records
- Tips & Tricks paper-dates
    Use 0.14+ version of React-Native-Web (Modal and better number input)
    Try to avoid putting the Picker Modals inside of a scrollView If that is not possible use the following props on the surrounding ScrollViews/Flatlists
        keyboardDismissMode = 'on-drag'
        keyboardShouldPersistTaps = 'handled'
        contentInsetAdjustmentBehavior = 'always'
    This is to prevent the need to press 2 times before save or close button in modal works (1 press for closing keyboard, 1 press for confirm/close) React Native Issue: #10138

## Bugs
- picker auswahl ist nicht mehr swipebar in history (whs muss man da auch die gesture ref mitgeben damit er swipes mitbekommt)
- "Encountered two children with the same key" im Trainings Modus: bei aktivem Training "Add Workout" geklickt und bei jeder Übung sind die Deadlift Sets mit Haken dazugekommen, Sets können auch nicht gelöscht werden -> Error Meldung "Uncought Error, Cannot read property 'sets' of undefined, Zeile 159 workoutReducer
- Trainingsübersicht crasht wenn ein planned training vor der überschicht ist
- Picker wählt in der History bei Auswahl von Muskeln die jeweiligen Exercises aus für upper and lower ranges
