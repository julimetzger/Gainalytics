# Gainalytics - Entwicklungskontext

## Projekt-Übersicht

- Name: Gainalytics
- Plattform: React Native Mobile App
- Hauptfunktionen: Trainingsplanung und Analse für fortgeschrittene Gym-Gänger
- Slogen: Log your gains with gainalytics. The powerful App for Power-User — privacy-and-local-first, open, flexible.
- App-Sprache ist Englisch (Alle Buttons, Texte, usw.)

## Technologie-Stack

- Frontend: React Native 0.72.6
- State Management: Redux
- UI-Framework: React Native Paper
- Styling: StyleSheet

## Hauptkomponenten

1. Training

   - TrainingHome: Übersicht aller Trainingspläne
   - Training: Einzelnes Training
   - TrainingsPlan: Template für Trainingseinheiten

2. Workout

   - Workout: Einzelne Trainingseinheit
   - WorkoutSet: Ein Satz innerhalb eines Workouts
   - Exercise: Eine Übung

3. Exercise
   - muscles: kann prozentual beteiligt sein

## Datenmodelle

Die Datenmodelle sind unter `/app/models` definiert und umfassen:

- Training: Trainingseinheit mit Übungen
- Exercise: Einzelne Übung mit Muskelgruppen
- WorkoutSet: Einzelner Satz mit Gewicht, Wiederholungen etc.
- MuscleInvolvement: Prozentuale Muskelbeteiligung
- SetType: Verschiedene Arten von Sätzen (Straight, Drop, etc.)
- ExerciseCategory: Kategorisierung der Übungen

Detaillierte Definitionen und Typen sind in den entsprechenden Modelldateien zu finden.

## Vorgeschlagenes Feature-Set für Power User

### Datenerfassung & Logging

- Hochflexibles Logging:
- Beliebige Übungen + Custom Exercises
- RIR/RPE, Tempo, Pausenzeit, Effort-Flags (z.B. Failure)
- Tagging von Sessions (z.B. Upper, Lower, Push, Pull, Mobility)
- Set-Typen: Straight, Drop, Myo, Cluster, etc.
- Datenexport / -import:
- CSV, JSON, XML-Export
- API- oder Dateiimport für bestehende Logs
- Offline-first, lokale Speicherung:
- Daten bleiben beim Nutzer
- Optional eigene Cloud-Sync (z.B. Nextcloud/WebDAV)

---

### Analyse & Auswertung

- Volumen- und Intensitätsreports:
- Volumen pro Muskelgruppe / Übung / Woche / Zyklus
- Durchschnitts-RIR / RPE über Zeit
- Load-Management-Kennzahlen (z.B. ACWR)
- Visualisierungen:
- Line / Bar / Scatter Plots
- Heatmaps (z.B. Belastung Muskelgruppen)
- Vergleich:
- Zeiträume / Zyklen direkt vergleichen
- Übungshistorien analysieren

---

### Planung & Periodisierung

- Planungsmodul:
- Makro- / Meso- / Mikrozyklen visualisieren
- Wochenschemata + Progressionspläne erstellen
- Import / Export von Plänen:
- XML / JSON-basierte Pläne teilen
- Web-Editor für Planerstellung

---

### KI-gestützte Features

- Trendanalysen:
- RPE-Drift → Deload-Empfehlung
- 1RM-Anstieg → Progressionsanpassung
- Plateauerkennung
- Coach-Chat:
- Chatgestützte Trainingsreflexion / Planung
- z.B. „Wie steigere ich Pull-Volumen ohne Push-Reduktion?“

---

### Videoanalyse (optional / Phase 2)

- Pose-Estimation + Feedback:
- Bar Path Analyse (z.B. Deadlift, Squat)
- ROM-Check
- Bewegungstempo-Analyse
- Privacy-First:
- Analyse lokal (optional Plugin)

---

### Philosophie / Struktur

- Open Source: MIT / GPL / Apache Lizenz
- Privacy-first:
- Local-forst: Keine zentrale Cloud-Pflicht
- Volle Datenhoheit
- Extensible: Plugin-System für eigene Module

## Konventionen

- Alle Komponenten sind funktionale Komponenten mit TypeScript
- Styling erfolgt über StyleSheet
- Redux für globales State Management
- React Navigation für Routing
- Farben immer aus dem theme für react native paper benuten

1. **Komponenten**:

   - Funktionale Komponenten mit TypeScript
   - Props-Interface über Komponente definieren
   - Styles am Ende der Datei
   - Meaningful Component Splitting (< 200 Zeilen)

2. **State Management**:

   - Redux für globalen State
   - useState für lokalen State
   - useMemo für berechnete Werte
   - useCallback für Funktionen

3. **Styling**:

   - StyleSheet.create für Styles
   - theme.colors für Farben
   - Responsive Design mit Dimensions API
   - Spacing über theme.spacing

4. **Naming**:

   - PascalCase für Komponenten
   - camelCase für Funktionen/Variablen
   - UPPERCASE für Konstanten
   - kebab-case für Dateinamen

5. **Testing**:
   - Jest für Unit Tests
   - React Native Testing Library
   - Snapshots für UI-Komponenten
   - Integration Tests für Redux

## Performance Guidelines

1. **Rendering**:

   - memo() für häufig verwendete Komponenten
   - useCallback für Event Handler
   - Virtualisierte Listen (FlashList)
   - Lazy Loading für Routen

2. **State**:
   - Normalisierte Redux Store Struktur
   - Selektive Re-Renders
   - Optimistische Updates
   - Debouncing/Throttling
