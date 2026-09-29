# Interaction functions for PERF-003 (device SM-G986B, display override 720x1600 -> tap coordinates in that space)
A=/tmp/a.sh
P=com.powerliftingworkoutplanner
sw() { $A shell input swipe $1 800 $2 800 ${3:-150}; }
tap() { $A shell input tap $1 $2; }
cold() { $A shell am force-stop $P; sleep 1; $A shell am start -W -n $P/.MainActivity | grep -E "TotalTime"; sleep 7; }
# Home -> "Next Training" (Micro 7) -> 3x back = Micro 4 (finished); then alternate Micro 3 <-> Micro 4
prep3() { cold; tap 360 1262; sleep 3; for i in 1 2 3; do sw 100 600; sleep 2.5; done; }
prep3plan() { prep3; tap 120 183; sleep 2; }
prep3train() { prep3; tap 360 183; sleep 2; }
prep3analysis() { prep3; tap 600 183; sleep 2; }
scn3() { for i in $(seq 1 12); do sw 100 600; sleep 2; sw 600 100; sleep 2; done; }

# --- part 2: toggle bars (12 taps each, 2.6 s apart). Coordinates in the 720x1600 space.
tapcycle() { for i in $(seq 1 ${REPEAT:-4}); do for xy in "$@"; do tap $xy; sleep 2.6; done; done; }
open_drawer() { tap 46 105; sleep 1.5; }
prepHero() { cold; }                                                                   # Training home
bar_hero() { tapcycle "360 401" "572 401" "148 401"; }                                 # Sets, Time, Volume
prepSub() { prep3; }                                                                   # Micro 4 (finished) -> default Analysis
bar_sub() { tapcycle "360 183" "120 183" "600 183"; }                                  # Train, Plan, Analysis
prepData() { prep3; tap 600 183; sleep 2; }                                            # Analysis tab
bar_data() { REPEAT=6 tapcycle "241 267" "551 267"; }                                  # Plan, Train
prepOverview() { prep3; open_drawer; tap 81 972; sleep 3; }                            # Overview (Exercise view)
bar_overview() { tapcycle "447 192" "620 192" "100 192" "275 192"; }                   # Muscle, Plan, Total, Exercise (12 taps = 3 rounds)
prepSort() { prepOverview; }
bar_sort() { REPEAT=12 tapcycle "668 284"; }
prepDrawer() { prep3; open_drawer; }
bar_drawer() { REPEAT=6 tapcycle "175 1130" "420 1130"; }                              # Micro - 1 / Micro + 1 buttons in the drawer

# --- first visits: from "Next Training" (Micro 7) swipe back six times, every swipe lands on a micro that has not been shown yet
prepFwd() { cold; tap 360 1262; sleep 3; }
scnFwd() { for i in 1 2 3 4 5 6; do sw 100 600; sleep 4; done; }
