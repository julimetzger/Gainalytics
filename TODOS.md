# TODOs for the project

## Trainings

- ~~zeit anzeigen seit start des Trainings~~ aber noch nicht schön
- ~~Vergleich mit vorherigem Training~~/geplanten Workout nach Abschluss des Trainings
- ~~Anzeige des planned Trainings während des Trainings~~ vlt. auch vergleich mit done
- **Export/Import Funktion für Trainings/Micro**
- unfinished Workout und doneWorkout handling nicht robust (1 Set hinzufügen dann reload verliert alle planned Sätze)
- Vorschlag anhand abgeschlossenem Training aus Datepicker wenn nichts geplant
- ~~name für trainings~~ schöner machen
- ~~Progressbar für Fortschritt nicht beendeter Übungen in der TrainingsPlanUebersicht~~ vergleich exercises mit done
  workouts anstatt planned workouts
- ~~Rekorde speichern und Snackbar als Onscreen Toast~~ schöner machen
- Mesos einführen mit Kopieren des alten Mesos
- Max Intensity ist manchmal -0.00 und manchmal +0.00
- Trainings löschbar machen ~~und editierbar~~
- ~~push benachrichtigung für pausenzeit~~ funktioniert das bild ??
- Records in overview anzeigen 
- ~~swipe between micros~~ besser
- Trainings oben anpinnbar machen im Edit (toggle schon im AddTrainingsPlan, redux fehlt)
- Oder Trainings sortierbar machen durch trag and drop

## Analyse

- 2-7 Training Accumalator
- Seite mit TrainingsLänge mit balkendiagramm
- Seite mit Datepicker
- Auswahlmöglichkeit der Metriken in MetricsOverview
- Trainings in Datepicker anzeigen
- während scrollen horizontales swipen komplett unterbinden scrollen geht noch beim swipen
- Nach datePicker Change sollte 0 der Standardscreen sein

## Exercises

- Nur ein Rekord pro Tag/Workout speichern in Stats, aber es soll immer ein Toast angezeigt werden

## Settings

- Show/hide Toasts, einzelne Toasts aktivierbar machen
- RIR/RPE
- Metriken die im TrainingsOverview/Overview angezeigt werden sollen für Muscles/Exercises
- Hide/show "kg"
- Default DatePicker range

## General

- Performance Optimierung - check rerenders and add memoization
- ~~direkter klick möglich bei offenem keyboard überall~~ nochmal testen - funktioniert nur im ExerciseTab
- react-native-calendars einbauen und testen

## Video Analyse Funktion

## Try out

- https://www.npmjs.com/package/react-native-calendars/v/1.1304.1 kalender der auch Markierungen anzeigen kann. Period
  scheint auch zu funktionieren
- ~~Toast für records~~ Farben sind noch nicht passend
- onPress auf Toast navigiert zu Exercise Stats //TODO go to Exercise Stats
- Tabs für Analyse https://www.npmjs.com/package/react-native-paper-tabs

## Bugs

- Push Timer funktioniert nur manchmal, bei manuellem Reset des Timers und nicht bei Haken
- Highlighted Values in Analyse sind gleich dargestellt wie Records, das ist verwirrend?
