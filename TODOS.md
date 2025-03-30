# TODOs for the project

## Trainings

- ~~Vergleich mit vorherigem Training~~/geplanten Workout nach Abschluss des Trainings
- ~~Anzeige des planned Trainings während des Trainings~~ vlt. auch vergleich mit done
- **Export/Import Funktion für Trainings/Micro**
- unfinished Workout und doneWorkout handling nicht robust (1 Set hinzufügen dann reload verliert alle planned Sätze)
- Vorschlag anhand abgeschlossenem Training aus Datepicker wenn nichts geplant
- Progressbar vergleich exercises mit done workouts anstatt planned workouts?
- ~~Rekorde speichern und Snackbar als Onscreen Toast~~ schöner machen
- Mesos einführen mit Kopieren des alten Mesos
- Trainings löschbar machen
- Records in Overview anzeigen 
- Trainings oben anpinnbar machen im Edit (toggle schon im AddTrainingsPlan, redux fehlt)?
- SWIPE_THRESHOLD added
- TrainingsTimer onLongPress ruft Pause Timer auf
- Add "Next Training" Button

## Analyse

- Seite mit TrainingsLänge mit Balkendiagramm
- Seite mit Datepicker
- Auswahlmöglichkeit der Metriken in MetricsOverview
- Trainings in Datepicker anzeigen

## Exercises

- Nur ein Rekord pro Tag/Workout speichern in Stats, aber es soll immer ein Toast angezeigt werden, History Pokal Symbol nur beim 1RM Rekord?!

## Settings

- Show/hide Toasts, einzelne Toasts aktivierbar machen
- RIR/RPE
- Metriken die im TrainingsOverview/Overview angezeigt werden sollen für Muscles/Exercises
- Hide/show "kg"
- Default DatePicker range

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

- Enable Dark Mode Switch setze alle Switche auf "on"
- Push Timer funktioniert nur manchmal, bei manuellem Reset des Timers und nicht bei Haken
- Push Timer funktioniert nur bei App im Vordergrund. https://www.npmjs.com/package/react-native-background-timer
- Highlighted Values in Analyse sind gleich dargestellt wie Records, das ist verwirrend?
