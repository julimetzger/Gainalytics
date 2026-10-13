# Open-Source-Readiness-Analyse (GH-524)

Stand: 2026-10-13, Basis `master` @ `acf1edd3`. Reine Analyse — es wurde nichts am Code, an der
History, an Repo-Einstellungen oder an der Sichtbarkeit geändert. Alle GitHub-Abfragen waren GETs.

> **Keine Secret-Werte in diesem Dokument.** Funde werden nur mit Fundort (Datei, Commit) und Art
> genannt. E-Mail-Adressen sind maskiert.

## TL;DR

| # | Thema | Ergebnis | Blocker? |
|---|---|---|---|
| 1 | Secrets | gitleaks (Tree + 2436 Commits): **0 Treffer**. Manuell: **1 Release-Signing-Passwort** im Klartext in alter History (`295097e7`), nicht in HEAD, nicht auf `origin/master`. Keine API-Keys, kein Release-Keystore, keine `.env`/`google-services.json` jemals committet. | Ja (History) |
| 1 | Große Binärdateien | GitHub-Repo ist **~1,5 GB**; ~300 Release-APK/AAB-Versionen + 4 Heap-Dumps (1,9 GB raw) in der History. Auf `origin/master` noch 4 APK/AAB-Blobs; der Rest hängt an alten Tags/Branches (auch remote: 138 Tags, 224 Branches). | Ja |
| 1 | Persönliche/interne Daten | `screenshots/` (189 MB, 1015 Dateien inkl. Real-Device-Screenrecordings), echte Trainingsdaten in 14 `.gains`-Fixtures, Orchestrator/Agent-Memory, interne Notizen, Home-Pfade, Geräte-Serial, Arbeitgeber-E-Mails als Commit-Autor. | Ja |
| 2 | Lizenz | Das ausgelieferte Plate-Tracker-Modell ist ein **Ultralytics-YOLO26n-Export mit eingebettetem AGPL-3.0-Label**. npm/Gradle haben keine Copyleft-Konflikte. → Empfehlung **AGPL-3.0-or-later** (+ §7-Ausnahme für Google-Play-Services-Libs). Mitautor (311 Commits) muss zustimmen. | Ja (Zustimmung) |
| 3 | Security-Setup | Aktuell alles aus (Secret Scanning, Dependabot, Code Scanning, Branch-Schutz nicht verfügbar da privat/Free). Nach Public-Schaltung alles kostenlos einschaltbar. Keine kritischen Architektur-Risiken; ein paar LOW-Punkte. | Nein |
| 4/5 | Professionelles Repo | Es fehlen README, LICENSE, CONTRIBUTING, SECURITY.md, THIRD-PARTY-NOTICES, `.github/` (CI, Templates, Dependabot). Build-/E2E-Anleitung setzt private WSL/Windows-Infrastruktur voraus. | Ja |
| — | **Empfehlung** | **Frisches öffentliches Repo ohne History** (kuratierter Snapshot, ein Initial-Commit); privates Repo bleibt als Arbeits-Repo bzw. Archiv. | — |

---

## 1. Was müsste raus

Werkzeuge: `gitleaks v8.21.2` (`git` über alle Refs + `dir` über den Working Tree, `--redact`),
manuelles `git log --all -G/-S`, Blob-Inventar via
`git rev-list --objects --all | git cat-file --batch-check`, Regex-Scan aller Text-Blobs.

### 1.1 Secrets und Credentials

| Schwere | Fund | Fundort | In HEAD? | Erreichbar über | Rotieren? |
|---|---|---|---|---|---|
| **HIGH** | Release-`signingConfig` mit literalem `storePassword`/`keyPassword` (8 Zeichen, nicht der Default `android`) | `android/app/build.gradle`, Commit `295097e7` (2023-06-16, „add release build option") | Nein — HEAD liest `ANDROID_RELEASE_PASSWORD` aus der Umgebung | 11 lokale Branches + ~136 Tags (nicht `origin/master`; Remote-Tags prüfen) | **Ja**, falls Upload-/Release-Keystore noch dieses Passwort nutzt (`keytool -storepasswd` / `-keypasswd`). Der Keystore selbst wurde nie committet. |
| INFO | `android/app/debug.keystore` (RN-Standard-Debug-Key, Passwort `android`) | HEAD, Commits `42bc4b60`, `ebbc3b1e` | Ja | — | Nein (Standard-Debug-Key, darf öffentlich sein) |
| INFO | `sk-ant-…`-artige Strings | Maestro-Flows `gh391_*`, `gh515_*`; History `docs/marketing/scripts/capture.py`, `docs/memory/*` | teils | — | Nein — 22–27 Zeichen lange Dummys (echte Keys ~100) |
| OK | Nie in der History: `.env*`, `google-services.json`, Firebase, Sentry-DSN, `local.properties`, `*.jks`/`*.p12`, Release-Keystore, OpenAI/Gemini/AWS/GitHub/GitLab-Tokens, Private Keys, JWTs | — | — | — | — |
| OK | `releaseNewAndroidVersion.sh/.ps1` nehmen das Passwort als Argument → Env-Var; `.gitlab-ci.yml` und `.npmrc` ohne Tokens | — | — | — | — |

**AI-Keys im App-Design:** Claude-Key wird vom Nutzer eingegeben, ChatGPT per OAuth-PKCE-Login;
kein eingebauter Key, kein Proxy. `agent/` liest `OPENAI_API_KEY` aus der Umgebung.

### 1.2 Große Binärdateien

| Pfad | Versionen | Größe (Pack) | Status | Empfehlung |
|---|---|---|---|---|
| `android/app/build/outputs/bundle/release/app-release.aab` | 148 | 1292 MB (5,0 GB raw) | History-only (Release-Commits 2023-11 … 2026-08); 2 davon noch auf `origin/master` | aus History entfernen |
| `android/app/build/outputs/apk/release/app-release.apk` | 148 | 1078 MB (5,4 GB raw) | History-only; 2 davon noch auf `origin/master` (`96139f89`, `a2fe8f17`, `8a8b8b36`, `d6f07ed9`, Releases 0.115/0.116/0.146/0.147) | aus History entfernen |
| `android/java_pid{19624,21420,5528,20576}.hprof` | 4 | 192 MB (1,87 GB raw) | History-only, lokaler Branch `react-native-0.71.8-update` (`6d5e768d`) | entfernen — Heap-Dumps können Laufzeitdaten enthalten |
| `screenshots/**` | 1015 Dateien | 189 MB in HEAD | HEAD + History | entfernen (siehe 1.3) |
| `__tests__/**/*.gains` | 14 | 20 MB | HEAD | anonymisieren (siehe 1.3) |
| `android/app/src/main/assets/models/outer_plate_yolo26n_float32.tflite`, `outer-plate-tracker/best_*.tflite` | 3 | 21 MB raw | HEAD | behalten (Lizenz siehe §2) — optional Git LFS / Release-Asset |
| `docs/marketing/**/*.mp4` | 6 | ~21 MB | nur Branch `origin/feature/GH-485` | bewusst veröffentlichen oder weglassen |

Woher die ~2 GiB lokal / 1,5 GB auf GitHub kommen: fast ausschließlich APK/AAB/HPROF. Sie werden
lokal von `refs/original/*` (Rest eines früheren `filter-repo`), `backup/*`-Branches, dem Tag
`backup/pre-apk-strip` und ~150 alten Tags gehalten; auf GitHub von 138 Tags (134 davon zeigen auf
umgeschriebene Commits, die lokal nicht mehr existieren) und 224 Branches. Ohne diese Refs bleiben
~440 MB Pack, davon ~190 MB `screenshots/`. Der aktuelle HEAD-Tree ist 246 MB.

### 1.3 Persönliche und interne Daten

| Was | Art | Größe | HEAD/History | Empfehlung |
|---|---|---|---|---|
| `screenshots/` (191 Ticket-Ordner) | Evidence-Screenshots, Real-Device-Screenrecordings (z. B. `screenshots/GH-177/r10_realdevice_screenrec.mp4`) — können Statusleiste/Benachrichtigungen zeigen | 189 MB | beides | raus; ggf. 3–5 kuratierte Screenshots für README |
| `__tests__/testdata/*.gains` (6), `__tests__/e2e/maestro/fixtures/*.gains` (7), `docs/tickets/GH-253/baseline-large.gains` | **echtes persönliches Trainingslog** (~354–410 Workouts 2023-10 … 2026-05, 1RM-Verläufe; keine Notizen/Körpergewicht) | 20 MB | HEAD | durch synthetische Fixtures ersetzen (Generator) oder bewusst freigeben |
| `__tests__/e2e/maestro/fixtures/squat-{1rep,3reps}.mp4` | kurze Lifting-Clips (Person?) | 0,2 MB | HEAD | behalten nur wenn ok, sonst ersetzen |
| `orchestrator/` (86 Dateien inkl. `AppStruktur/`-Screenshots), `agent/`, `tickets/`, `docs/memory/`, `docs/perf/`, `docs/investigation/`, `docs/tickets/` | interne Agent-/Orchestrator-Tooling, Memory-Logs, Perf-Logs (enthalten `/home/jmetzger`, `/mnt/c/Users/<user>`, WSL-Gateway-IP 172.18.x, Geräteserial) | ~2 MB HEAD, ~37 MB History | beides | privat halten (nicht veröffentlichen) |
| `KINotes.md`, `TODOS.md`, `DONE.md`, `PRODUCT_VISION.md`, `infra-verbesserung-orchestrator.md`, `maestro-inventory.md`, `.goosehints`, `.gooseignore`, `flow.yaml`, `AGENTS.md`, `CLAUDE.md` | interne Notizen, Roadmap, Agent-Anweisungen | klein | HEAD | privat halten; ggf. bereinigtes `AGENTS.md` (Coding-Rules) öffentlich |
| `metro.worktree.config.cjs` | hart kodierter `/home/jmetzger/...`-Pfad | — | HEAD | entfernen/parametrisieren |
| `/home/jmetzger`-Pfade | 24 Pfade, u. a. 5 Maestro-Flows (`gh341_*`, `gh355_tab_order`, `gh413_*`, `test-gh303-plan`), `docs/perf/perf003/tools/*.sh` | — | HEAD | relativ machen |
| Geräteserial des Testhandys | 49 Dateien (Flows, `FLOW_AUDIT.md`, ein Komponententest, Skripte) + 96 Commit-Messages | — | beides | Env-Var/Platzhalter; Commit-Messages nur per Rewrite (geringes Risiko) |
| `.gitlab-ci.yml` | veraltete GitLab-Pages-Pipeline für `index.html` (Datenschutzseite) | — | HEAD | entfernen bzw. auf GitHub Pages umziehen |
| `index.html` | Datenschutzerklärung (Platzhalter-E-Mail) | — | HEAD | behalten/prüfen |

**Commit-Autoren (maskiert):**

| Name | E-Mail | Commits | Hinweis |
|---|---|---|---|
| ki-juli | k\*\*\*@ki.de | 1452 | ok / mailmap |
| jmetzger | m\*\*\*@gmx.de | 935 | privat |
| Flobstr | d\*\*\*@gmx.de | 311 | **Dritter Mitautor** — Zustimmung nötig (§2) |
| julimetzger / Julian Metzger / ki-juli | j\*\*\*@gmail.com | 262 | privat |
| jmetzger | j\*\*\*@andrena.de | 18 | **Arbeitgeber-Adresse** (2024-04 … 2025-09) |
| jmetzger | j\*\*\*.ext@cofinpro.de | 4 | **Kunden-/Arbeitgeber-Adresse** |
| ki-juli | j\*\*\*@desktop-…localdomain | 2 | leakt Hostname |

Arbeitgeber-Commits: nach §69b UrhG gehören Werke „in Wahrnehmung der Aufgaben" dem Arbeitgeber.
Vermutlich private Nebenarbeit, sollte aber kurz bestätigt werden; bei frischem Repo entfällt die
Autorenzeile ohnehin, das Urheberrecht am Code bleibt aber dieselbe Frage.

### 1.4 Fremdcode und Vendoring

| Element | Herkunft / Lizenz | Bewertung |
|---|---|---|
| `patches/*.patch` (document-picker, draggable-flatlist, modal, sharingan-dropdown) | Diffs gegen MIT-Pakete | ok |
| `sharingan-rn-modal-dropdown` | eigener GitHub-Fork, upstream MIT | ok, Fork öffentlich machen oder auf Upstream/Alternative wechseln |
| `*.d.ts`-Shims, `polyfillImmediate.ts`, `android/app/src/main/cpp/native/yuv_to_rgb.cpp` | Eigencode | ok |
| `CMakeLists.txt`, `OnLoad.cpp`, `BUCK`, `build_defs.bzl` | RN-Template (MIT) | ok |
| **`outer_plate_yolo26n_float32.tflite`** (= `outer-plate-tracker/best_float32.tflite`, byte-identisch) | Ultralytics YOLO26n-Export, eingebettete `metadata.json`: `license: AGPL-3.0` | **lizenzbestimmend** (§2) |
| Trainingsdatensatz für das Modell (`data/yolo_dataset`) | nicht im Repo, Herkunft unklar | klären (eigene Videos? Roboflow → oft CC BY 4.0) |
| App-Icons (Android mipmaps, iOS AppIcon) | Herkunft unklar, vom Mitautor angelegt | klären |
| `react-native-vector-icons` Fonts | 19 TTFs im APK; Entypo CC BY-SA 4.0, FontAwesome CC BY 4.0/OFL, Rest MIT/Apache | Attribution nötig; optional `iconFontNames` auf genutzte Sets reduzieren |

Neu schreiben von Fremdcode ist **nicht** nötig — es gibt keinen kopierten Drittcode ohne Lizenz.
Einzige echte Entscheidung: Ultralytics-Modell behalten (→ AGPL) oder ersetzen.

---

## 2. Lizenz

### 2.1 Dependency-Lizenzen

**npm** (`package-lock.json` + installierte `package.json`): 487 Prod-Pakete (inkl. RN-Build-Tooling),
499 Dev-Pakete. Prod: MIT 404, ISC 37, BSD-3 14, BSD-2 12, Apache-2.0 11, Rest Einzelfälle.

| Paket | Lizenz | Scope | Bewertung |
|---|---|---|---|
| xdate 0.8.3 | MIT OR GPL-2.0 | prod (react-native-calendars) | MIT wählen — ok |
| caniuse-lite | CC-BY-4.0 | prod, nur Build-Zeit | ok |
| react-native-fit-image 1.5.5 | Beerware | prod | permissiv, Notice behalten |

Keine reinen GPL/LGPL/AGPL/MPL/EPL-, UNLICENSED- oder lizenzlosen Pakete. Rohdaten:
`checks/oss/license-npm.txt` (Run-Verzeichnis).

**Gradle/Android:** Hermes (MIT, JSC/LGPL nicht genutzt), AndroidX/Media3/Room/Material/Kotlin
(Apache-2.0), TensorFlow Lite 2.16.1 inkl. GPU (Apache-2.0), Notifee core (Apache-2.0), MPAndroidChart
(Apache-2.0), Fresco (MIT), MMKV (BSD-3), JUnit (EPL-1.0, nur Test).
**Proprietär:** `com.google.android.gms:play-services-tasks:18.0.1` (transitiv via Notifee).
Kein ffmpeg-kit, MediaPipe, ML Kit oder Firebase im APK. Keine eingecheckten `.so/.aar/.jar`
außer `gradle-wrapper.jar`.

### 2.2 Vergleich

| | MIT | Apache-2.0 | MPL-2.0 | GPL-3.0 | AGPL-3.0 |
|---|---|---|---|---|---|
| Vereinbar mit Ultralytics-AGPL-Modell | ✗ (Enterprise-Lizenz oder anderes Modell) | ✗ | ✗ | eingeschränkt | **✓** |
| Schutz der USP (Video-Bar-Path, AI-Coach, Planung) vor Closed-Source-Forks | keiner | keiner (aber Patentklausel) | nur dateiweise | stark | am stärksten (auch Netzwerknutzung, z. B. künftiges Sync-Backend) |
| Adoption / Contributions | maximal | hoch | mittel | mittel | geringer |
| Zapstore / GitHub Releases / F-Droid | ✓ / ✓ / ✓ | ✓ | ✓ | ✓ (F-Droid scheitert an play-services-tasks) | ✓ (dito) |
| Google Play | ✓ | ✓ | ✓ | ✓ (Owner ist Rechteinhaber) | ✓ |
| Apple App Store | ✓ | ✓ | ✓ | problematisch | problematisch |
| Proprietäre Google-Libs | ✓ | ✓ | ✓ | §7-Ausnahme ratsam | §7-Ausnahme ratsam |

### 2.3 Empfehlung

**AGPL-3.0-or-later** mit einer §7-Zusatzerlaubnis für das Linken proprietärer Android-/Google-Play-
Services-Bibliotheken.

- Einzige Option, die zum heute ausgelieferten Modell passt.
- Stärkster Schutz der USP; kommerzielle Forks müssen offen bleiben.
- Funktioniert mit Zapstore, GitHub Releases und Google Play. iOS ist kein aktuelles Ziel; falls doch,
  kann der alleinige Rechteinhaber dual lizenzieren — dafür braucht es CLA/Zustimmung des Mitautors.
- Permissiv (MIT/Apache) ginge nur, wenn das Modell durch einen nicht-Ultralytics-Detektor
  (z. B. YOLOX, RT-DETR, MediaPipe/TFLite-Model-Maker; Apache-2.0) neu trainiert oder eine
  Ultralytics-Lizenz gekauft wird.

**Voraussetzungen vor Veröffentlichung:**
1. Schriftliche Zustimmung des Mitautors (311 Commits, inkl. App-Icons) zur gewählten Lizenz, oder CLA.
2. Kurze Bestätigung, dass die Commits von Arbeitgeber-/Kunden-Adressen private Arbeit waren.
3. Herkunft des YOLO-Trainingsdatensatzes klären.
4. `LICENSE`, `THIRD-PARTY-NOTICES.md` (Ultralytics, Entypo, FontAwesome, Beerware-Paket,
   Apache-NOTICE-Dateien) und idealerweise ein In-App-Screen „Open-Source-Lizenzen".

---

## 3. Sicherheit

### 3.1 GitHub-Security-Setup (aktueller Zustand, GET-only)

Privat, keine Lizenz, `security_and_analysis` leer; Vulnerability Alerts, automatische Security-Fixes,
Secret Scanning, Code Scanning aus; Private Vulnerability Reporting 404; Branch-Protection/Rulesets
403 („make public or Pro"); Actions erlaubt alle Actions; 0 Secrets, 0 Environments, 0 Releases.

### 3.2 Empfohlenes Setup nach Public-Schaltung (für öffentliche Repos kostenlos)

1. **Secret Scanning + Push Protection** einschalten.
2. **Dependabot Alerts + Security Updates**; `.github/dependabot.yml` für `npm`, `gradle` (`/android`),
   `github-actions`, wöchentlich, gruppiert. Achtung: `patch-package`-Patches brechen bei Version-Bumps.
3. **Code Scanning (CodeQL)**: `javascript-typescript` + `actions` per Default-Setup; `java-kotlin`
   braucht Advanced-Setup mit Gradle-Build.
4. **Private Vulnerability Reporting** + `SECURITY.md`.
5. **Ruleset auf `master`**: PR-Pflicht, Status-Checks (lint, typecheck, jest), kein Force-Push/Delete.
   Actions auf verifizierte beschränken, per SHA pinnen, `GITHUB_TOKEN` default read-only.
6. `delete_branch_on_merge` aktivieren.

### 3.3 Architektur-/Sicherheitsrisiken bei offenem Code

| Schwere | Risiko | Detail / Empfehlung |
|---|---|---|
| MEDIUM | Lizenz Modell | siehe §2 |
| MEDIUM | ChatGPT-Login über undokumentierten OpenAI-Client (`dynamic_agent_client`) | Implementierung sauber (Loopback-Server nur 127.0.0.1, `state` geprüft), aber öffentlich sichtbar → OpenAI könnte blocken/ToS-Frage. Vor Release bewusst entscheiden. |
| LOW | `app/utils/secureStorage.ts` | Schlüssel aus Android Keystore (gut), aber MMKV nutzt nur 16 Byte des 64-Hex-Keys; Fallback auf `Math.random` bzw. Wegwerf-Key bei Keychain-Fehler → still verlorene Credentials. |
| LOW | Unverschlüsselte App-Daten | Trainingsdaten, Settings, **AI-Chat-Verlauf** in unverschlüsseltem MMKV (redux-persist) bzw. als RNFS-Dateien. Mitigiert durch `allowBackup="false"` + App-Private-Storage. |
| LOW | Import ohne Schema-Validierung | Backup-Import (`SettingsTab.tsx`/`importDump`) und Plan-Import (`AddTrainingsPlan.tsx`): `JSON.parse` ohne Schema → schlimmstenfalls kaputter lokaler State, keine Codeausführung. |
| LOW | R8/ProGuard aus | `enableProguardInReleaseBuilds = false` — für Open Source unkritisch. |
| INFO | ok | Nur `MainActivity` exportiert (Launcher + `gainalytics://chatgpt-signin`); FileProvider nur `cache/exports/`; Cleartext und `SYSTEM_ALERT_WINDOW` nur Debug; `debuggable false` in Release; kein WebView, kein `eval`; alle Endpunkte HTTPS. |
| INFO | Signing-Key | Zapstore pinnt das Signing-Zertifikat — der Release-Key darf nie wechseln und muss sicher verwahrt werden (Passwort-Fund §1.1 umso relevanter). |

---

## 4./5. Professionelles öffentliches Repo

| Artefakt | Status | Bedarf |
|---|---|---|
| `README.md` | fehlt | Zweck, Features, 3–5 Screenshots, Quickstart, Architekturüberblick, Lizenz-Badge |
| Build-Anleitung | fehlt; vorhandene Doku (`__tests__/e2e/README.md`, `AGENTS.md`) setzt WSL + Windows-adb-Server + Orchestrator voraus | Standard-Setup: Node-Version, JDK 17, Android SDK, `npm ci`, `npm start`, `./gradlew assembleDebug`, `npm test`; Maestro optional |
| `LICENSE` | fehlt (`package.json` hat kein `license`-Feld) | AGPL-3.0 + §7-Zusatz, Copyright-Zeile |
| `THIRD-PARTY-NOTICES.md` | fehlt | generiert aus npm/Gradle + manuelle Einträge (Modell, Fonts) |
| `CONTRIBUTING.md` | fehlt | Branch-/PR-Flow, Tests, Coding-Rules (aus `AGENTS.md` destillieren), DCO oder CLA |
| `SECURITY.md` | fehlt | Meldeweg (Private Vulnerability Reporting), unterstützte Versionen |
| `CODE_OF_CONDUCT.md` | fehlt | Contributor Covenant |
| `.github/` | fehlt komplett | CI-Workflow (lint, typecheck, jest, `assembleDebug`), Release-Workflow (Tag → signiertes APK als GitHub Release), Issue-/PR-Templates, `dependabot.yml` |
| Beispielkonfiguration | — | `.env.example`/Doku für `ANDROID_RELEASE_PASSWORD`, Keystore-Pfad; Hinweis, dass AI-Keys in der App eingegeben werden |
| CI | nur `.gitlab-ci.yml` (Pages für `index.html`), keine echte CI | durch GitHub Actions ersetzen |
| `.gitignore` | Lücken: `*.apk`, `*.aab`, `*.hprof`, `*.jks`/`*.keystore` (außer debug), `.env*` (nur `*/.env`), `android/app/src/main/assets/index.android.bundle` | ergänzen |
| AI-Agent-Doku (`AGENTS.md`, `CLAUDE.md`) | verweist auf private Pfade/Orchestrator | für „Clanker"-Contributor bereinigte öffentliche Fassung |

---

## 6. Bereinigte History vs. frisches Repo

| | `git filter-repo` auf bestehender History | Frisches öffentliches Repo (Snapshot) |
|---|---|---|
| Aufwand | hoch: Pfade + `--replace-text` (Passwort, Home-Pfade, Serial, IPs) + `--mailmap`, danach Verifikation jedes Refs; 138 Remote-Tags/224 Branches aufräumen | gering: kuratierten Tree kopieren, ein Initial-Commit |
| Restrisiko | mittel — jeder vergessene Pfad/Ref leakt; Commit-Messages enthalten Serial, interne Ticket-Kontexte, Co-Author-Trailer | sehr gering — nur der geprüfte Snapshot ist öffentlich |
| Erhalt von Autorenschaft / Blame | ja | nein (Danksagung im README / `AUTHORS`) |
| Issues/PRs des privaten Repos | würden mit öffentlich (enthalten Evidence-Screenshots, interne Diskussion) | bleiben privat |
| Weiterarbeit mit Orchestrator | Orchestrator-Dateien müssten aus dem Hauptrepo raus | privates Repo bleibt Arbeits-Repo; öffentliches wird per Export-Skript/Sync gespeist oder wird ab Stichtag das Hauptrepo |

**Empfehlung: frisches öffentliches Repo.** Die History ist mit ~300 Binär-Releases, Heap-Dumps,
einem Passwort, Arbeitgeber-Adressen, internen Issues und Agent-Logs zu stark belastet; ihr Mehrwert
für Dritte ist gering. Die Sichtbarkeit des **bestehenden** Repos sollte nicht umgeschaltet werden,
weil Issues/PRs/Evidence mitveröffentlicht würden.

Zu entscheiden ist noch das Arbeitsmodell danach:
(a) öffentliches Repo wird ab Stichtag Hauptrepo, Orchestrator/Memory leben in einem separaten
privaten Repo; oder (b) privates Repo bleibt Hauptrepo, ein Export-Skript synchronisiert einen
gefilterten Snapshot. (a) ist auf Dauer einfacher und für externe Contributor ehrlicher.

---

## 7. Zapstore (GH-521)

Hängt von dieser Arbeit ab:
- **Öffentliches Repo**: `zapstore.yaml` verweist auf Repo (Metadaten, Source-Link).
- **GitHub Releases mit APK**: aktuell 0 Releases; die Release-Skripte pushen nur einen Tag, das APK
  bleibt lokal. → Release-Workflow (Tag → signiertes `app-release.apk` als Release-Asset).
- **`zapstore.yaml`**: existiert noch nicht.
- **Stabiler Signing-Key**: Zapstore pinnt das Zertifikat — Key nie wechseln; Passwort-Fund (§1.1)
  vorher klären/rotieren.

---

## 8. Priorisierte Schrittliste

| # | Schritt | Wer | Aufwand |
|---|---|---|---|
| 1 | Release-Signing-Passwort rotieren, falls noch gültig (Keystore bleibt gleich → Zapstore/Play-kompatibel) | Owner | 15 min |
| 2 | Zustimmung des Mitautors zur Lizenz einholen; Arbeitgeber-Commits bestätigen; Herkunft Trainingsdatensatz + App-Icons klären | Owner | 1–7 Tage (extern) |
| 3 | Lizenzentscheidung (Empfehlung AGPL-3.0-or-later + §7) oder Modell ersetzen | Owner | 1 h Entscheidung / Tage bei Modellersatz |
| 4 | Arbeitsmodell festlegen (§6 a/b) | Owner | 30 min |
| 5 | Synthetische `.gains`-Fixtures erzeugen und Tests/Flows umstellen | Worker | 0,5–1 Tag |
| 6 | Private Pfade/Serial/IPs aus Code, Flows und Skripten entfernen (Env-Vars), `metro.worktree.config.cjs` + `.gitlab-ci.yml` raus, `.gitignore` ergänzen | Worker | 0,5 Tag |
| 7 | README (mit Screenshots), Build-Anleitung ohne private Infra, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, LICENSE, THIRD-PARTY-NOTICES, öffentliches `AGENTS.md` | Worker | 1 Tag |
| 8 | `.github/`: CI (lint/typecheck/jest/assembleDebug), Dependabot, Templates, Release-Workflow für signiertes APK | Worker | 0,5–1 Tag |
| 9 | Optional: In-App-Screen „Open-Source-Lizenzen", `iconFontNames` reduzieren, `secureStorage`-Fallbacks härten | Worker | 0,5 Tag |
| 10 | Snapshot zusammenstellen (Allowlist der Pfade), gitleaks + Größen-/Pfadcheck auf dem Snapshot, Owner-Review | Worker + Owner | 0,5 Tag |
| 11 | Neues öffentliches Repo anlegen, Snapshot pushen, Security-Features (§3.2) + Ruleset einschalten | Owner | 1 h |
| 12 | Zapstore (GH-521): erster getaggter Release mit APK, `zapstore.yaml` | Worker | 0,5 Tag |

---

## Anhang: Befehle (Auswahl)

```bash
gitleaks git --redact -f json .                     # 2436 Commits, 0 Leaks
gitleaks dir --redact --max-target-megabytes 5 .     # 0 Leaks
git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(objectsize:disk) %(rest)'
git log --all --diff-filter=D --name-only --format= | sort -u
git log --all -p -G 'storePassword|keyPassword' -- android/app/build.gradle   # Werte nur klassifiziert, nie ausgegeben
git log --all --format='%an <%ae>' | sort | uniq -c
git ls-remote --tags origin | wc -l ; git ls-remote --heads origin | wc -l   # 138 / 224
gh api repos/julimetzger/Gainalytics                    # size ≈ 1.5 GB, private
gh api repos/julimetzger/Gainalytics/{vulnerability-alerts,private-vulnerability-reporting,rulesets,...}
unzip -p outer-plate-tracker/best_float32.tflite metadata.json   # Ultralytics, AGPL-3.0
node scripts/npm-licenses.js <repo>                      # npm-Lizenzinventar
```

Rohdaten liegen im Orchestrator-Run-Verzeichnis unter `checks/oss/` (nicht im Repo).
