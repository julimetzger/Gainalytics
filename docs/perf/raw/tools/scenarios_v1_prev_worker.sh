A=/tmp/a.sh
sw() { $A shell input swipe $1 800 $2 800 ${3:-150}; }
scn3_swipe_days() {
  $A shell input tap 120 183; sleep 2
  for i in $(seq 1 10); do sw 600 100; sleep 1.5; done
  for i in $(seq 1 10); do sw 100 600; sleep 1.5; done
  # fast flicks
  for i in $(seq 1 6); do sw 600 100 80; sleep 0.6; done
  for i in $(seq 1 6); do sw 100 600 80; sleep 0.6; done
}
