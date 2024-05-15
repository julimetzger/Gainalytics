# TODOs for the project

## Trainings

- addWorkout mit neuer Übung befüllen als default Wert fürs eintragen
- 1RM default mäßig an nach eintragen einer Übung
- ~~zeit anzeigen seit start des Trainings~~ aber noch nicht schön
- ~~Vergleich mit vorherigem Training~~/geplanten Workout nach Abschluss des Trainings
- ~~Anzeige des planned Trainings während des Trainings~~ vlt. auch vergleich mit done
- **Export/Import Funktion für Trainings/Micro**
- unfinished Workout und doneWorkout handling nicht robust (1 Set hinzufügen dann reload verliert alle planned Sätze)
- Vorschlag anhand abgeschlossenem Training aus Datepicker wenn nichts geplant
- ~~anzeige des trainings im router oben~~ schöner machen
- ~~name für trainings~~ schöner machen
- ~~Progressbar für Fortschritt nicht beendeter Übungen in der TrainingsPlanUebersicht~~ vergleich exercises mit done
  workouts anstatt planned workouts
- ~~Rekorde speichern und Snackbar als Onscreen Toast~~ schöner machen
- Mesos einführen mit Kopieren des alten Mesos
- Max Intensity ist manchmal -0.00 und manchmal +0.00
- Im Planungsmodus keine Häkchen bei den einzelnen Sets anzeigen
- Trainings löschbar machen ~~und editierbar~~

## Analyse

- **Neue Seite für Darstellung Volumen für Bodyparts, Übungen etc**
- 2-7 Training Accumalator
- *Segmented Buttons (Multiselect) zum Togglen von Exercises, Muscles und Metrics mit Namen um Funktion zu erklären,
  hier auch mit Drawer arbeiten?*

## History

- Seite mit Datepicker
- Trainings in Datepicker anzeigen
- während scrollen horizontales swipen komplett unterbinden scrollen geht noch beim swipen
- Nach datePicker Change sollte 0 der Standardscreen sein

## Exercises

- drawer navigation
- **Grafiken für alle Metriken. Auswahl accumulation day, week, month - on click on graphic only shows value keine
  Anzeige der zugehörigen workouts**
- ~~Rekorde speichern~~ nur 1RM nicht sicher was sonst noch Sinn macht
- Nur ein Rekord pro Tag/Workout speichern in Stats, aber es soll immer ein Toast angezeigt werden

## Settings

- Show/hide Toasts, einzelne Toasts aktivierbar machen
- RIR/RPE
- 1RM Button default mäßig an/aus
- Show timer on/off
- Metriken die im TrainingsOverview angezeigt werden sollen für Muscles/Exercises
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

## Bugs

- Highlighted Values in Analyse sind gleich dargestellt wie Records, das ist verwirrend?
- ~~**Gerundete Werte erzeugen jedes Mal einen gleichhohen Rekordeintrag (14 x 83kg = 121.73kg)**~~
- **Wenn Training nur planned ist vor einem done Training dann crasht die App**
