# PERF-004 interaction functions (SM-G986B, wm size override 720x1600 -> coordinates in that space).
# Derived from PERF-001 raw/tools/scenarios.sh; coordinates re-measured on master 7b289e66 (uiautomator dumps).
T=${T:-$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")}
A=$T/a.sh
P=com.powerliftingworkoutplanner
sw() { $A shell input swipe $1 800 $2 800 ${3:-150}; }           # horizontal swipe at y=800
vfling() { $A shell input swipe 360 $1 360 $2 ${3:-120}; }        # vertical fling
tap() { $A shell input tap $1 $2; }
key() { $A shell input keyevent $1; }
TAB_TRAINING="90 1420"; TAB_EXERCISES="270 1420"; TAB_ANALYSE="450 1420"; TAB_SETTINGS="630 1420"
fg_guard() { $A shell dumpsys window | grep -i mCurrentFocus | grep -q powerliftingworkoutplanner; }
cold() { $A shell am force-stop $P; sleep 1; $A shell am start -W -n $P/.MainActivity | grep -E "TotalTime"; sleep 7; }
# Analyse drawer rows (x=100): Dashboard 228, Analysis 324, Training Length 418, Body Weight 512, History 606,
# Metrics Overview 702, Records 796, Video Analysis 890, AI Chat 984, Chat History 1080
analyse_drawer() { tap 46 105; sleep 1.5; tap 100 $1; sleep 3; }
D_DASH=228; D_ANALYSIS=324; D_HISTORY=606; D_METRICS=702; D_VIDEO=890; D_AICHAT=984

# --- scenario 2: running measurement training (Micro 6 "Push squat", only Bankdruecken, created for this
# measurement and deleted afterwards). Set row: Reps (82,460) RIR (238,460) Weight (396,460) Add (632,454).
# Values stay prefilled (5 reps / RIR 0 / 20 kg, far below the 150 kg PR -> no record written).
scn2save() {
  sleep 10                                   # idle window: training timer + rest timer ticking
  for i in $(seq 1 12); do tap 632 454; sleep 4; done
}
scn2type() {
  for i in $(seq 1 5); do
    tap 82 460; sleep 1.5; key 67; sleep 1.2; $A shell input text 5; sleep 1.2
    tap 396 460; sleep 1.5; key 67; sleep 1.2; $A shell input text 0; sleep 1.2
  done
}

# --- scenario 3: swipe between trainings in the plan (same trainings as PERF-001: Micro 3 (02/02/26) <-> Micro 4 (16/02/26),
# both finished). Home -> "Next Training" (now Micro 6, empty) -> 2x back = Micro 4; then alternate Micro 3 <-> Micro 4.
# (PERF-001: Next Training was Micro 7 -> 3x back; the target trainings are identical.)
prep3() { cold; tap 363 1276; sleep 3; for i in 1 2; do sw 100 600; sleep 2.5; done; }
prep3plan() { prep3; tap 120 183; sleep 2; }
prep3train() { prep3; tap 360 183; sleep 2; }
prep3analysis() { prep3; tap 600 183; sleep 2; }
scn3() { for i in $(seq 1 12); do sw 100 600; sleep 2; sw 600 100; sleep 2; done; }
# switching views: sub-tab bar Train / Plan / Analysis on Micro 4 (PERF-003 bar_sub), 12 taps 2.6 s apart
tapcycle() { for i in $(seq 1 ${REPEAT:-4}); do for xy in "$@"; do tap $xy; sleep 2.6; done; done; }
bar_sub() { tapcycle "360 183" "120 183" "600 183"; }

# --- scenario 4a: Exercises tab (open + flings)
prep4a() { cold; }
scn4a() {
  tap $TAB_EXERCISES; sleep 3
  for i in $(seq 1 8); do vfling 1250 350; sleep 1.5; done
  for i in $(seq 1 8); do vfling 550 1300; sleep 1.5; done
}
# --- scenario 4b: training history list (Analyse -> drawer -> History)
prep4b() { cold; tap $TAB_ANALYSE; sleep 3; }
scn4b() {
  analyse_drawer $D_HISTORY
  for i in $(seq 1 12); do vfling 1250 350; sleep 1.5; done
  for i in $(seq 1 6); do vfling 350 1250; sleep 1.5; done
}
# --- scenario 4c: history calendar (plan drawer -> History): month back to Feb 2026, tap training days
# Now Nov 2026 -> 9x back (PERF-001: Sept 2026 -> 7x back). Plan drawer "History" row at (60,988).
prep4c() { cold; tap 363 1276; sleep 3; }
scn4c() {
  tap 46 95; sleep 1.5; tap 60 988; sleep 3              # open calendar (Nov 2026)
  for i in $(seq 1 9); do tap 65 196; sleep 2; done       # -> Feb 2026
  # Feb 2026 grid (Sun-first): row1 1..7 y=349 ; row2 8..14 y=457 ; row3 15..21 y=566 ; row4 22..28 y=674
  # training days: 2,3,5,16,17,19,21,23,25,27,28
  for xy in "158 349" "259 349" "460 349" "158 566" "259 566" "460 566" "661 566" "158 674" "360 674" "560 674" "661 674"; do tap $xy; sleep 2.5; done
}

# --- scenario 5a: Analyse tab open (Dashboard) + scroll
prep5a() { cold; }
scn5a() {
  tap $TAB_ANALYSE; sleep 3
  for i in $(seq 1 4); do vfling 1250 350; sleep 1.5; done
  for i in $(seq 1 4); do vfling 350 1250; sleep 1.5; done
}
# --- scenario 5b: Analysis graph (Bankdruecken, 1RM, Day) + range changes via the same DateRangePicker modal as PERF-001.
# New since PERF-001: filter panel; the modal opens via the "Custom" preset chip (477,284) of the expanded panel.
pick_bankdr() {
  tap 601 245; sleep 2                         # expand filter panel
  tap 219 562; sleep 1.5                       # metric 1RM
  tap 602 639; sleep 2; tap 405 250; sleep 1; $A shell input text Bankdr; sleep 1.5
  tap 360 418; sleep 1.5; tap 360 800; sleep 2.5   # select Bankdruecken, Done
}
set_start() {  # $1 = MM/DD/YYYY ; open modal, replace start date, save
  tap 477 284; sleep 2.5
  tap 120 228; sleep 1; key 123; for i in $(seq 12); do key 67; done
  $A shell input text "$1"; sleep 2.5
  tap 600 195; sleep 4
}
prep5b() { cold; tap $TAB_ANALYSE; sleep 3; analyse_drawer $D_ANALYSIS; pick_bankdr; }
scn5b() {
  for d in 01/01/2025 01/01/2024 01/01/2023 01/01/2025 01/01/2024 01/01/2023; do set_start $d; done
}

# --- scenario 5c: Metrics overview, swipe week ranges (start in the week 16-22/02/26 like PERF-001)
# New: filter panel (expand 671,228 -> Search all 602,299); range button now at (360,330).
set_range() {  # $1 start, $2 end (MM/DD/YYYY)
  tap 360 330; sleep 2.5
  tap 120 228; sleep 1; key 123; for i in $(seq 12); do key 67; done; $A shell input text "$1"; sleep 1
  tap 360 228; sleep 1; key 123; for i in $(seq 12); do key 67; done; $A shell input text "$2"; sleep 1.5
  tap 600 195; sleep 3
}
prep5c() {
  cold; tap $TAB_ANALYSE; sleep 3; analyse_drawer $D_METRICS
  tap 671 228; sleep 2; tap 602 299; sleep 2; tap 405 250; sleep 1; $A shell input text Bankdr; sleep 1.5
  tap 360 418; sleep 1.5; tap 360 800; sleep 2.5; tap 657 214; sleep 2
  set_range 02/16/2026 02/22/2026
}
scn5c() {
  for i in $(seq 1 10); do sw 100 600; sleep 2; done     # back in time (weeks)
  for i in $(seq 1 10); do sw 600 100; sleep 2; done
}

# --- scenario 6: AI chat. No API key on the device -> a DUMMY key ("sk-ant-perf004-dummy-not-a-key", invalid) was saved in
# Settings only for this series so the input renders; nothing is sent (no send tap), key removed afterwards.
# Open: alternate Dashboard <-> AI Chat via the drawer (6x). Type: tap input (311,1229), 11 chars + 11 DEL, 0.8 s apart.
prep6open() { tap $TAB_ANALYSE; sleep 3; analyse_drawer $D_DASH; }
scn6open() { for i in $(seq 1 6); do tap 46 105; sleep 1.5; tap 100 $D_AICHAT; sleep 3; tap 46 105; sleep 1.5; tap 100 $D_DASH; sleep 3; done; }
prep6type() { analyse_drawer $D_AICHAT; tap 311 1229; sleep 2; }
scn6type() {
  for c in b a n k d r s q u a t; do $A shell input text $c; sleep 0.8; done
  for i in $(seq 1 11); do key 67; sleep 0.8; done
}

# --- scenario 7: video analysis (10 analyses on the device, newest = analysis 10, "Done", gallery-backed video ~1:15)
prep7a() { cold; tap $TAB_ANALYSE; sleep 3; }
scn7a() {
  analyse_drawer $D_VIDEO                                   # open the list (drawer tap + row tap)
  for i in $(seq 1 4); do vfling 1250 450; sleep 1.5; done
  for i in $(seq 1 4); do vfling 450 1250; sleep 1.5; done
}
# open the newest analysis (row title 339,540), scroll to the player (slow drag), play 12 s (play 306,796), pause
prep7b() { cold; tap $TAB_ANALYSE; sleep 3; analyse_drawer $D_VIDEO; }
scn7b() {
  tap 339 540; sleep 3
  $A shell input swipe 360 1200 360 500 400; sleep 2.5
  tap 306 796; sleep 12
  tap 306 796; sleep 2
}

# --- repeated "open" measurements (n=5 incl. the first run of scn4a/scn4b/scn5a/scn7a/scn7b): cold start, then one open
open_ex() { tap $TAB_EXERCISES; sleep 4; }
open_dash() { tap $TAB_ANALYSE; sleep 4; }
open_hist() { analyse_drawer $D_HISTORY; sleep 1; }
open_vlist() { analyse_drawer $D_VIDEO; sleep 1; }
open_vdetail() { tap 339 540; sleep 4; }
prep_cold() { cold; }
prep_analyse() { cold; tap $TAB_ANALYSE; sleep 3; }
