# TODOs for the project

## Trainings
- addWorkout mit neuer Übung befüllen als default Wert fürs eintragen
- ~~zeit anzeigen seit start des Trainings~~ aber noch nicht schön
- ~~Vergleich mit vorherigem Training~~/geplanten Workout nach Abschluss des Trainings
- ~~Anzeige des planned Trainings während des Trainings~~ vlt. auch vergleich mit done 
- Export/Import Funktion für Trainings/Micro
- unfinished Workout und doneWorkout handling nicht robust (1 Set hinzufügen dann reload verliert alle planned Sätze)
- Vorschlag anhand abgeschlossenem Training aus Datepicker wenn nichts geplant
- ~~Drawer Navigator Seite für Funktionen und um Buttons auszulagern für schlankeren Style~~
- ~~anzeige des trainings im router oben~~ schöner machen
- ~~name für trainings~~ schöner machen
- ~~Progressbar für Fortschritt nicht beendeter Übungen in der TrainingsPlanUebersicht~~ vergleich exercises mit done workouts anstatt planned workouts
- ~~Rekorde speichern und Snackbar als Onscreen Toast~~ schöner machen
- Mesos einführen mit Kopieren des alten Mesos
- Max Intensity ist manchmal -0.00 und manchmal +0.00
- ~~Zum letzten Training springen~~

## Analyse
- neue Seite für Darstellung volumen für bodyparts, übungen etc
- 2-7 Training accumalator
- **Segmented Buttons (Multiselect) zum Togglen von Exercises, Muscles und Metrics mit Namen um Funktion zu erklären, hier auch mit Drawer arbeiten??**

## History
- Seite mit Datepicker
- Trainings in Datepicker anzeigen
- **während scrollen horizontales swipen komplett unterbinden**
- Nach datePicker Change sollte 0 der Standardscreen sein

## Exercises
- Muskelgruppen hinzufügen schöner und robuster
- ~~Rekorde speichern~~ nur 1RM nicht sicher was sonst noch Sinn macht
- Nur ein Rekord pro Tag/Workout speichern in Stats, aber es soll immer ein Toast angezeigt werden

## Settings
- rir/rpe
- 1RM Button default mäßig an/aus
- **Export/Import alles**
- Show timer on/off
- Metriken die im TrainingsOverview angezeigt werden sollen für Muscles/Exercises

## General
- ~~direkter klick möglich bei offenem keyboard überall~~ nochmal testen - funktioniert nur im ExerciseTab

## Video Analyse Funktion

## Try out
- https://www.npmjs.com/package/react-native-calendars/v/1.1286.0 kalender der auch Markierungen anzeigen kann. Period scheint auch zu funktionieren
- **~~Toast für records~~ Farben sind noch nicht passend**
- onPress auf Toast navigiert zu Exercise Stats

## Bugs
- ~~picker auswahl ist nicht mehr swipebar in history (whs muss man da auch die gesture ref mitgeben damit er swipes mitbekommt)~~
- ~~Trainingsübersicht crasht wenn ein planned training vor der überschicht ist~~
- ~~Picker wählt in der History bei Auswahl von Muskeln die jeweiligen Exercises aus für upper and lower ranges~~
- ~~Crash wenn 2 exercises ausgewählt in der analyse~~
- ~~navigate up down in trainingsoverview ads sets form other workouts~~
- History Swipe zu sensibel, evtl. Swipe beim Scrollen deaktivieren
- Highlighted Values in Analyse sind gleich dargestellt wie Records, das ist verwirrend
