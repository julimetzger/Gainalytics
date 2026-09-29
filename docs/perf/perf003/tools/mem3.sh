#!/bin/bash
# usage: mem3.sh <outdir> [runs]   PSS / native heap / views: cold start -> open plan (Next Training, Micro 7) -> swipe back to Micro 4
T=$(dirname "$(readlink -f "$0")")
source $T/scenarios3.sh
D=$1; mkdir -p $D
m() { sleep 4; $A shell dumpsys meminfo $P > $D/$1.txt; echo "$1 pss=$(grep -E '^\s+TOTAL PSS' $D/$1.txt | awk '{print $3}') native=$(grep -E '^\s+Native Heap:' $D/$1.txt | awk '{print $3}') java=$(grep -E '^\s+Java Heap:' $D/$1.txt | awk '{print $3}') views=$(grep -E '^\s+Views:' $D/$1.txt | awk '{print $2}')"; }
for r in $(seq 1 ${2:-5}); do
  cold > /dev/null; m run$r-1-start
  tap 360 1262; sleep 3; m run$r-2-plan-micro7
  for i in 1 2 3; do sw 100 600; sleep 2.5; done; m run$r-3-plan-micro4
  for i in 1 2 3 4; do sw 600 100; sleep 2; sw 100 600; sleep 2; done; m run$r-4-after-8-swipes
done
