# Interaction functions for run.sh (device SM-G986B, display override 720x1600 -> tap coordinates in that space)
A=/tmp/a.sh
P=com.powerliftingworkoutplanner
sw() { $A shell input swipe $1 800 $2 800 ${3:-150}; }           # horizontal swipe at y=800
vfling() { $A shell input swipe 360 $1 360 $2 ${3:-120}; }        # vertical fling
tap() { $A shell input tap $1 $2; }
TAB_TRAINING="90 1420"; TAB_EXERCISES="270 1420"; TAB_ANALYSE="450 1420"

cold() { $A shell am force-stop $P; sleep 1; $A shell am start -W -n $P/.MainActivity | grep -E "TotalTime"; sleep 7; }
analyse_drawer() { tap 46 105; sleep 1.5; tap 300 $1; sleep 3; }

# --- scenario 3: swipe between trainings in the plan. Swipes move between micros of the same
# training slot. Home -> "Next Training" (Micro 7, empty) -> 3x back = Micro 4 (finished 16/02/26);
# then alternate Micro 3 <-> Micro 4 (both finished, full data) so every swipe is a real change.
prep3() { cold; tap 360 1262; sleep 3; for i in 1 2 3; do sw 100 600; sleep 2.5; done; }
prep3plan() { prep3; tap 120 183; sleep 2; }
prep3analysis() { prep3; tap 600 183; sleep 2; }
scn3() {
  for i in $(seq 1 12); do sw 100 600; sleep 2; sw 600 100; sleep 2; done
}

# --- scenario 4a: Exercises tab (open + flings)
prep4a() { cold; }
scn4a() {
  tap $TAB_EXERCISES; sleep 3
  for i in $(seq 1 8); do vfling 1250 350; sleep 1.5; done
  for i in $(seq 1 8); do vfling 550 1300; sleep 1.5; done
}

# --- scenario 4b: training history list (Analyse -> History, FlashList)
prep4b() { cold; tap $TAB_ANALYSE; sleep 3; }
scn4b() {
  analyse_drawer 401
  for i in $(seq 1 12); do vfling 1250 350; sleep 1.5; done
  for i in $(seq 1 6); do vfling 350 1250; sleep 1.5; done
}

# --- scenario 4c: history calendar (Training drawer -> History): month back, tap training days
prep4c() { cold; tap 360 1262; sleep 3; }
scn4c() {
  tap 46 95; sleep 1.5; tap 300 1036; sleep 3            # open calendar (Sept 2026)
  for i in $(seq 1 7); do tap 65 196; sleep 2; done       # -> Feb 2026
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

# --- scenario 5b: Analysis graph (Bankdruecken, 1RM, Day) + range changes via DateRangePicker
set_start() {  # $1 = MM/DD/YYYY ; open modal, replace start date, save
  tap 360 385; sleep 2.5
  tap 120 228; sleep 1; $A shell input keyevent 123; for i in $(seq 12); do $A shell input keyevent 67; done
  $A shell input text "$1"; sleep 2.5
  tap 600 195; sleep 4
}
pick_bankdr() {
  tap 300 210; sleep 1.5; tap 400 360; sleep 1; $A shell input text Bankdr; sleep 1.5
  tap 150 417; sleep 1.5; tap 150 417; sleep 1.5; $A shell input keyevent 4; sleep 2
}
prep5b() { cold; tap $TAB_ANALYSE; sleep 3; analyse_drawer 212; pick_bankdr; }
scn5b() {
  for d in 01/01/2025 01/01/2024 01/01/2023 01/01/2025 01/01/2024 01/01/2023; do set_start $d; done
}

# --- scenario 5c: Metrics overview, swipe week ranges
set_range() {  # $1 start, $2 end (MM/DD/YYYY)
  tap 360 385; sleep 2.5
  tap 120 228; sleep 1; $A shell input keyevent 123; for i in $(seq 12); do $A shell input keyevent 67; done; $A shell input text "$1"; sleep 1
  tap 360 228; sleep 1; $A shell input keyevent 123; for i in $(seq 12); do $A shell input keyevent 67; done; $A shell input text "$2"; sleep 1.5
  tap 600 195; sleep 3
}
# Metrics has no metric rows in the picker -> one tap selects; start in a week with data (16-22/02/26)
prep5c() {
  cold; tap $TAB_ANALYSE; sleep 3; analyse_drawer 495
  tap 300 210; sleep 1.5; tap 400 360; sleep 1; $A shell input text Bankdr; sleep 1.5; tap 150 417; sleep 1.5
  $A shell input keyevent 4; sleep 1; $A shell input keyevent 4; sleep 2
  set_range 02/16/2026 02/22/2026
}
scn5c() {
  for i in $(seq 1 10); do sw 100 600; sleep 2; done     # back in time (weeks)
  for i in $(seq 1 10); do sw 600 100; sleep 2; done
}

# --- scenario 6: AI chat, type into the input (never send)
prep6() { cold; tap $TAB_ANALYSE; sleep 3; analyse_drawer 985; }
# The chat input is not rendered without an Anthropic API key (AIChatTab returns early), and the
# device has no chat history -> measure opening the AI Chat screen, plus per-keystroke typing
# into the Exercises search field as a text-input proxy. Nothing is sent or persisted.
prep6open() { cold; tap $TAB_ANALYSE; sleep 3; }
scn6open() { for i in $(seq 1 6); do tap 46 105; sleep 1.5; tap 300 985; sleep 3; tap 46 105; sleep 1.5; tap 300 117; sleep 3; done; }
prep6type() { cold; tap $TAB_EXERCISES; sleep 3; tap 360 210; sleep 2; }
scn6type() {
  for c in b a n k d r s q u a t; do $A shell input text $c; sleep 0.8; done
  for i in $(seq 1 11); do $A shell input keyevent 67; sleep 0.8; done
}
# --- scenario 2: running measurement training (Micro 7 "Push squat", only Bankdruecken, created for
# this measurement and deleted afterwards). Set row: Reps (104,461) RIR (238,461) Weight (396,461) Add (630,454).
# Values stay prefilled (5 reps / RIR 0 / 20 kg, far below the 150 kg PR -> no record written).
scn2save() {
  sleep 10                                   # idle window: training timer + rest timer ticking
  for i in $(seq 1 12); do tap 630 454; sleep 4; done
}
scn2type() {
  for i in $(seq 1 5); do
    tap 104 461; sleep 1.5; $A shell input keyevent 67; sleep 1.2; $A shell input text 5; sleep 1.2
    tap 396 461; sleep 1.5; $A shell input keyevent 67; sleep 1.2; $A shell input text 0; sleep 1.2
  done
}
