#!/bin/bash
# runvars.sh set.json name=json ... : run each variant on the set, 3 at a time
set=$1; shift
pids=()
for kv in "$@"; do
  name=${kv%%=*}; more=${kv#*=}
  LIVEONLY=1 MORE="$more" node run12.cjs $set d-$name.json > d-$name.log 2>&1 &
  pids+=($!)
  if [ ${#pids[@]} -ge 3 ]; then wait ${pids[0]}; pids=("${pids[@]:1}"); fi
done
wait
for kv in "$@"; do name=${kv%%=*}; echo "$name: $(cat d-$name.log)"; done
