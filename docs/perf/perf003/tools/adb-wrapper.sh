#!/bin/bash
exec timeout ${ADB_TIMEOUT:-25} adb -H 127.0.0.8 -P 5037 -s R5CN30HWZFN "$@"
