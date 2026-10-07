# Ideas

Roughly in order of how much they would add for how much work. Each one builds on data the atlas already has (the cross-reference graph, the word index, PageRank, the STEPBible tags) unless it says otherwise.

## Quick wins

**Verse of the day on the map.** Open on a different well-connected verse each day (pick from the top 2,000 by PageRank, seeded by the date) so the first thing people see is a lit-up story, not the full field.

**Guided tours.** A tour is just a list of links the app already understands (`#v=`, `#p=`, `#w=`). Ship five: "The Lamb, Genesis to Revelation", "Psalm 22 and the cross", "The seed promise", "Creation and new creation", "The shepherd". Next and back buttons step through them while the map animates.

**Share as image.** Render the current map view plus the verse text to a PNG (the WebGL canvas and the SVG overlay can be composited in a 2D canvas). People share pictures far more than links.

**Reading plans with a progress glow.** Track chapters read in local storage and let read chapters glow brighter on the book band. Over a year the map fills in.

**Keyboard tour of a chapter.** `J` and `K` step through verses and the map follows, so you can read Isaiah 53 and watch each verse's arcs light up.

## Bigger features

**Timeline mode.** Lay the books out by approximate date of writing instead of canon order, with the dates and their uncertainty shown as bands. Arcs that point backwards in time become visible, which is the story of how later writers quoted earlier ones.

**Quotations versus allusions.** Split direct New Testament quotations of the Old Testament (a short, well-documented list) from looser cross-references and draw quotations as solid gold arcs. This answers "where does the New Testament actually quote the Old" at a glance.

**People and places.** STEPBible's TIPNR dataset (CC BY) tags every proper name with an ID. Add a people graph (who appears with whom) and a real map of places that lights up as you read. Clicking Abraham shows every verse he appears in on the arc map.

**Theme discovery.** Run community detection (Louvain) on the cross-reference graph in the Rust build, then name each cluster by its most distinctive Hebrew and Greek roots. The current hand-made themes become a starting point and the graph suggests new ones.

**Compare translations side by side.** BSB next to ESV (through the API, one chapter at a time) with the Hebrew or Greek underneath, highlighting words the two translations render differently.

**Audio.** The BSB has public-domain audio recordings. Play a chapter and highlight the current verse on the map as it reads.

## Engineering

**Offline mode.** A service worker that caches `atlas.bin`, the per-book text and the lexicon after the first visit, so it works on a plane. The ESV stays online-only because it cannot be stored.

**WebGPU renderer.** Draw the arcs as compute-generated quads with real thickness and anti-aliasing, and keep WebGL2 as the fallback.

**Installable app.** A web manifest and icons so it can be added to a phone's home screen.

**Deploy with the ESV.** The static site is on GitHub Pages with the ESV turned off. To offer the ESV too, run `make serve` (the site plus the small Node proxy) as a single small service on Fly.io or Render with the API key as a secret.
