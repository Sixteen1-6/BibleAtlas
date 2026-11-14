set -e
run() { name=$1; knobs=$2
  for set in bf13 d12; do
    inp=bf13-live.json; [ $set = d12 ] && inp=d12live.json
    PORT=5191 LIVEONLY=1 N=6 KNOBS="$knobs" node run14.cjs $inp v-$name-$set.json >> variants.log 2>&1
  done
  echo "$name done" >> variants.log
}
run first8 '{"PICK":{"way":"first","max":8}}'
run bible8 '{"PICK":{"way":"bible","max":8}}'
run rare8 '{"PICK":{"way":"rare","max":8}}'
run first12 '{"PICK":{"way":"first","max":12}}'
run bible6 '{"PICK":{"way":"bible","max":6}}'
run rare6 '{"PICK":{"way":"rare","max":6}}'
echo ALL-DONE >> variants.log
