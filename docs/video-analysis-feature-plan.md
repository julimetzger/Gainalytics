# Videoanalyse Squat Side (Android-first) mit E2E-Test pro User-Step inkl. Video-Overlay

## Kurzfassung
Das Feature wird ohne Versionierung ausgeliefert und liefert v1 fuer Squat (Seitperspektive) echte Bar-Path-Analyse mit `average speed`, `lowest speed`, `rep time`.
Zusaetzlich ist verbindlich: Bar Path im Video als Overlay sichtbar.
E2E-Abdeckung erfolgt pro User-Flow-Step.

## Was ist schon gemacht
1. VideoAnalysis Datenmodell, Redux-Slice, Persistenz und Navigation sind integriert.
2. Import-UI (Galerie + Emulator-Video), Status-Handling und Detailscreen existieren.
3. Ergebnisdateien werden lokal gespeichert/gelesen.
4. Android-Berechtigungen fuer Videozugriff sind gesetzt.
5. Maestro-Flow ist in der Suite eingebunden.
6. Analyse ist aktuell Stub-basiert (keine echte CV-Auswertung).

## Was noch fehlt
1. Echte CV-Pipeline (Detect/Track) statt Stub.
2. Rep-Segmentierung.
3. Metrikberechnung.
4. Video-Overlay (Punkt + Path) im Detailscreen.
5. Manual-Seed-Fallback.
6. Workout/Set-Linking im UI.
7. Vollstaendige Step-by-Step-E2E-Haertung.

## Festgelegte Entscheidungen
1. Scope: Squat, Seitperspektive, Plate sichtbar.
2. Plattform: Android-first.
3. Videoquelle v1: Attach/Import zuerst.
4. Tracking: Auto + Manual-Fallback.
5. CV-Stack: Android Native mit MediaPipe/OpenCV.
6. Metriken v1: Concentric-Speed + Rep-Time.
7. Einheit v1: `px/s`; spaeter `m/s`.
8. Keine Versionierung.
9. Alt-Daten werden nicht migriert; manuell geloescht.

## Implementierungsplan

### Step 1: Finales Result-Format und Statusmodell
1. `BarTrackingResult` final definieren: `barPathSeries`, `repSegments`, `repMetrics`, `units`, `analysisMeta`, `qualityFlags`.
2. `VideoAnalysisStatus` um `needs_manual_seed` erweitern.
3. Reducer/Selector/Detail-Parsing auf neues Format umstellen.
4. E2E: `step-01-open-screen` (Einstieg + Empty State).

### Step 2: Native Analyse-Bridge
1. `VideoAnalysisModule` + `VideoAnalysisPackage` erstellen.
2. In `MainApplication` registrieren.
3. Native API: `analyzeSquatVideo(localVideoPath, analysisId, manualSeed?)`.
4. E2E: `step-02-import-starts-processing`.

### Step 3: Bar-Path-Extraktion
1. Pose-ROI.
2. Plate-Detection.
3. Tracking + Re-Detect + Confidence/Outlier-Rejection.
4. Nicht-leere `barPathSeries` schreiben.
5. E2E: `step-03-analysis-done`.

### Step 4: Rep-Segmentierung
1. Vertikalsignal glaetten.
2. Bottom/Top/Rep-Grenzen bestimmen.
3. `repSegments` erzeugen.
4. E2E: `step-04-rep-segments-visible`.

### Step 5: Metriken
1. `averageConcentricSpeedPxPerS`.
2. `lowestConcentricSpeedPxPerS`.
3. `repTimeMs`.
4. E2E: `step-05-metrics-visible`.

### Step 6: Video-Overlay
1. In `VideoAnalysisDetailTab` Video-Player + Overlay-Layer hinzufuegen.
2. Overlay zeigt:
   1. aktuellen Bar-Punkt (frame-/time-synchron),
   2. bisherige Trajektorie als Linie,
   3. optional Rep-Farbkodierung.
3. UI-Steuerung:
   1. `Show Overlay` Toggle,
   2. Fallback-Hinweis bei fehlenden Punkten.
4. Koordinatentransformation: gespeicherte Punkte -> Video-Viewport (Letterbox/Crop korrekt behandeln).
5. E2E:
   1. `step-06-overlay-toggle-visible`,
   2. `step-07-overlay-updates-during-playback`.

### Step 7: Manual-Seed-Fallback
1. Status `needs_manual_seed` im Detailscreen behandeln.
2. Seed-UI (Tap Plate-Center) und Re-Run.
3. E2E: `step-08-manual-seed-retry`.

### Step 8: Fehlerfaelle
1. Permission denied.
2. Missing video.
3. Analyze failed + Retry.
4. E2E:
   1. `step-09-permission-denied`,
   2. `step-10-missing-video`,
   3. `step-11-analysis-failed-retry`.

### Step 9: Workout/Set-Linking
1. `LINK_VIDEO_ANALYSIS_TO_WORKOUT` um `setIndex` erweitern.
2. Link-UI im Detailscreen.
3. E2E: `step-12-link-to-workout-set`.

### Step 10: Delete + Persistenz
1. Delete entfernt Redux + Artefakte.
2. Persistenz ueber App-Restart.
3. E2E:
   1. `step-13-delete-analysis`,
   2. `step-14-persistence-after-restart`.

## Oeffentliche API-/Typaenderungen
1. `VideoAnalysisStatus`: `needs_manual_seed`.
2. `VideoAnalysis`: `setIndex?`, `manualSeedFramePath?`, `analysisMeta?`.
3. `BarTrackingResult` final mit `repSegments`, `repMetrics`, `units`, `analysisMeta`, `qualityFlags`.
4. Native Bridge: `analyzeSquatVideo(...)`.
5. Action `LINK_VIDEO_ANALYSIS_TO_WORKOUT` erweitert um `setIndex`.

## Teststrategie
1. Unit-Tests:
   1. Reducer-Transitions inkl. `needs_manual_seed`.
   2. Rep-Segmentierung und Metriken mit deterministischen Inputs.
   3. Overlay-Koordinatentransformation (Video-Viewport-Mapping).
2. Native Android Tests:
   1. Detector/Tracker auf Golden-Videos.
3. Maestro E2E:
   1. 14 Flows, je User-Step ein Flow, inkl. Overlay-spezifischer Flows.
4. `suite.yaml` enthaelt alle Step-Flows verpflichtend.

## Definition of Done
1. Bar Path wird aus Emulator-Squatvideo zuverlaessig extrahiert.
2. Mindestens eine Rep segmentiert.
3. `average speed`, `lowest speed`, `rep time` sichtbar.
4. Bar Path ist im Video als Overlay sichtbar und waehrend Playback synchron.
5. Manual-Seed-Fallback funktioniert.
6. Linking zu Workout/Set funktioniert.
7. Delete und Persistenz funktionieren.
8. Vollstaendige Step-E2E-Suite und Jest-Suite sind gruen.

## Annahmen und Defaults
1. Android-first.
2. v1-Speed in `px/s`.
3. Keine Backward-Kompatibilitaet fuer alte Analyse-Ergebnisse.
4. Alt-Daten werden manuell geloescht.
