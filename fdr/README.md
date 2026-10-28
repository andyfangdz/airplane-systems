# Flight data replays

Recorded flights replayed on a 3D airplane, at `/fdr/<id>`, each in step with its own record of the event (here, the
cockpit voice recording). Where the airplane and engine pages model a system from its manual, a replay shows what one
airplane's systems and instruments did on one flight, from whatever record of it is public, and says where that record
comes from and what it can't show.

The registry is `fdr/index.ts` (picker order, names and the route's static params); each replay's data, model and
`SOURCES.md` sit in `fdr/<id>/`, and its page in `components/fdr/<id>/`, listed in `components/fdr/FdrPage.tsx`. A page
wraps its scene and panel in `FdrShell` (`components/fdr/FdrShell.tsx`), the component pages' layout with the replay
marked in the picker. `tests/fdr-pages.test.ts` checks the registry and the pages name the same replays.

## C-5 stall, Diego Garcia (`c5-diego-garcia`)

A C-5's stall on approach to Diego Garcia in 1998, flown from flight data read frame by frame off the USAF's animation
of it (`fdr.ts`, corrected to the animation's digit windows in `readings.ts`) and kept in step with that video's cockpit
audio. No raw recorder data or mishap report is public; the animation is the best record found. `model.ts` samples and
interpolates the data, derives the vertical speed, flight path and a dead-reckoned track, and holds the timeline's
moments; `transcript.ts` is the timed transcript, machine-made except where Jay Lacklen's account quotes a line.

The page's store (`components/fdr/c5-diego-garcia/store.ts`) runs the replay on its own clock until the YouTube player
has played, then on the player's, so the audio and the airplane stay together however the reader plays, pauses or seeks.
The method, where the records differ and what the schematic 3D view chooses are in
[c5-diego-garcia/SOURCES.md](c5-diego-garcia/SOURCES.md); `tests/c5-diego-garcia.test.ts` checks the data against
Lacklen's account and `tests/c5-diego-garcia-store.test.ts` the clock.
