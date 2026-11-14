for r in 0 1 2 3; do PORT=5191 LIVEONLY=1 N=6 KNOBS="{\"AROUND\":{\"reach\":$r}}" node run14.cjs cite-seen.json a-$r.json >> around.log 2>&1; done; echo AROUND-DONE >> around.log
