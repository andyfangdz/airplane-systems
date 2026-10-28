# C-5 stall at Diego Garcia: sources and how the numbers were read

The page replays a C-5 Galaxy's stall and fall on approach to Diego Garcia in the summer of 1998. No investigation
report is public. Two records are used, and where they differ both are given:

- the USAF Mishap Analysis Animation Facility's flight data animation, with the cockpit voice recording on its sound
  track ("the animation"), as published on YouTube; and
- Jay Lacklen's account. He is a former C-5 pilot who sat on the crew's initial debriefing at Dover AFB, and his times
  are this video's.

## Documents

| Document                                                                                                                                                                                                                                                                                                             | What was read                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [C5 USAF Diego Garcia Incident (1998 Summer)](https://www.youtube.com/watch?v=G0Z2gDHQx1M), ChilloutJr's - CVR & ATC Audio Archive, YouTube                                                                                                                                                                          | The whole video (171.4 s, 640 × 480, 10 frames a second): the title cards; the airspeed, altitude, attitude, AOA, flap, N1, heading, gear handle and slat lock displays; the cockpit audio                                                                                                                          |
| Jay Lacklen, [“Stall and Fall! That time a C-5 Galaxy nearly crashed while approaching Diego Garcia”](https://theaviationgeekclub.com/stall-and-fall-that-time-a-c-5-galaxy-nearly-crashed-while-approaching-diego-garcia/), The Aviation Geek Club, 13 July 2018 (from book three of his memoir, _Flying the Line_) | The whole account: weather, the slat fault and the stick shaker, the timeline at the video's times, the quoted calls, and the recovery                                                                                                                                                                              |
| [Lockheed C-5 Galaxy](https://en.wikipedia.org/wiki/Lockheed_C-5_Galaxy), Wikipedia                                                                                                                                                                                                                                  | Specifications (length, span, height, wing area, sweep, wing sections), the 28-wheel main gear, the TF39 engines                                                                                                                                                                                                    |
| Greg Smith, Chief, MAAF Facility, [“The USAF Mishap Analysis and Animation Facility”](https://www.safety.af.mil/Portals/71/documents/Magazines/FSM/fsmdec98.pdf?ver=2017-03-28-101008-997), _Flying Safety_, HQ Air Force Safety Center, December 1998, pp. 6–9                                                      | The facility's work and history, the tape recorders (p. 7), what an animation is built from (p. 8), and the recovery of this event's data (pp. 8–9). Its p. 9 plots of corrected recorder data aren't said to be this event's, so nothing is read from them                                                         |
| Master Sgt. Steve Marciniak, [“C-5 mishap investigated”](https://www.dover.af.mil/News/Article/231053/c-5-mishap-investigated), 436th Airlift Wing Public Affairs, Dover AFB, 29 June 2006                                                                                                                           | About a different C-5 mishap (Dover, 3 April 2006); read only for what becomes public after an Air Force mishap                                                                                                                                                                                                     |
| [_AFMAN 11-2C-5 Volume 3, C-5 Operations Procedures_](https://static.e-publishing.af.mil/production/1/af_a3/publication/afman11-2c-5v3/afman11-2c-5v3.pdf), 20 October 2022 (the C-5M's; the 1998 rules may have differed)                                                                                           | Table 3.5 items 5-5d to f (slats, slat position indicator; p. 38), Table 3.2 item 2-10 (angle-of-attack de-ice and its stallimiter; p. 24), Table 3.14 items 14-1 and 14-2 (Stallimiter System, GPWS; p. 60), 7.4.1 (manoeuvres crews may not practise in the airplane; p. 87). It does not say what TRT stands for |
| [FJDG](https://ourairports.com/airports/FJDG/), OurAirports (airports.csv and runways.csv)                                                                                                                                                                                                                           | Diego Garcia's elevation (9 ft), and runway 13/31: its length and width (12,003 × 200 ft), the latitude and longitude of its two ends, and runway 31's true heading (301.7°)                                                                                                                                        |
| [FJDG](https://flightplandatabase.com/airport/FJDG), Flight Plan Database                                                                                                                                                                                                                                            | Runway 31's ILS as listed today: localizer and glideslope INKW on 109.30 MHz, the localizer on 301.84° true (the runway's 301.86°), a 3.00° glideslope with a range of 10 nm. It gives no threshold crossing height and doesn't place the glideslope's antenna, and says its data are not for real-world navigation |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) (© OpenStreetMap contributors, ODbL), read through the Overpass API                                                                                                                                                                                         | Diego Garcia's coastline, to compare the animation's island with and to say what is under the track. Nothing of it is drawn                                                                                                                                                                                         |
| [IGRF-14](https://www.ncei.noaa.gov/products/international-geomagnetic-reference-field), the International Geomagnetic Reference Field, 14th generation (IAGA, November 2024): its coefficients file, igrf14coeffs.txt                                                                                               | The magnetic variation at the runway 31 end in the summer of 1998, 7.96° W: the definitive 1995 and 2000 fields, interpolated to mid-1998 and evaluated at sea level                                                                                                                                                |
| [Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles), Google Maps Platform                                                                                                                                                                                                      | The island and the airfield the 3D view draws under the track, where the site has a Maps key. Their heights are above the WGS84 ellipsoid; the EGM96 geoid, 74.72 m below it at the runway 31 end (the egm96-universal package), is taken as sea level                                                              |
| [APS Training's page on the event](https://blog.apstraining.com/resources/c5-galaxy-diego-garcia)                                                                                                                                                                                                                    | A summary of the same event, read for background; no number is taken from it                                                                                                                                                                                                                                        |

## Taken as stated

| What                                                                                                                                                                                                                                                  | Where                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Night; generally visual conditions, but the only clouds for 100 miles enveloped them as they configured and approached the final approach fix                                                                                                         | Lacklen               |
| The slats' “target” pads did not seat as they extended; an annunciator warned, and the flight engineer sent the scanner to look                                                                                                                       | Lacklen               |
| The slat malfunction disabled the stick-shaker stall warning on the pilots' yokes; it never warned the crew                                                                                                                                           | Lacklen               |
| “Flaps 40”, then “Gear down”; level flight with the throttles advanced instead of a descent; the pilot's attention on his INS                                                                                                                         | Lacklen               |
| “TRT” called twice at 1:42 with N1 at 85%; the stall begins at 1:46 at 50 kt; the throttles near 100% at 1:52; the highest altitude 4,900 ft                                                                                                          | Lacklen               |
| At 1:55 in full stall, having lost almost 1,000 ft; at 1:58 50 kt for 15 s and a near 90° right bank                                                                                                                                                  | Lacklen               |
| At 2:06 10° nose low, 90° left bank, passing 3,000 ft; at 2:14 a 110° right bank passing 2,000 ft at 105 kt                                                                                                                                           | Lacklen               |
| GPWS as the ocean approaches; the tower saw the wingtip lights one above the other; visual again passing 1,500 ft                                                                                                                                     | Lacklen               |
| The AOA at 16 with two degrees to work with, 18 being another stall; pulled to 18; 150 kt; recovery at 2:27 at 733 ft                                                                                                                                 | Lacklen               |
| Length 247 ft 1 in, span 222 ft 9 in, height 65 ft 1 in, wing area 6,200 sq ft, sweep 25°, high wing, T-tail                                                                                                                                          | Wikipedia             |
| “Its high-flotation main landing gear provides 28 wheels”; General Electric TF39 engines until the C-5M                                                                                                                                               | Wikipedia             |
| The C-5's flight data recorder was a tape recorder, as on the C-130, C-141 and E-3                                                                                                                                                                    | Flying Safety p. 7    |
| An animation's flight path and attitude come from the recorded airspeed, altitude, heading, pitch and roll                                                                                                                                            | Flying Safety p. 8    |
| “A C-5 incident at Diego Garcia”: the depot's standard equipment found “the entire 45-second incident” missing from the recorder; the facility recovered “all but 1 second of the missing data and help[ed] determine the true cause of the incident” | Flying Safety pp. 8–9 |
| The crew's initial analysis blamed wind shear                                                                                                                                                                                                         | Lacklen               |
| A safety investigation board's report “contains privileged information and is not releasable to the public”; an accident investigation board's report is released (said of the 2006 Dover mishap)                                                     | Dover AFB             |
| 14 slats, all required for flight; a slat position indicator, and with it out the slats are scanned to verify their position                                                                                                                          | AFMAN                 |
| Stallimiter System: 2 installed, “1 fully functioning system required for all departures”; with one angle-of-attack de-ice system out, the other's stallimiter must work                                                                              | AFMAN                 |
| Practice of stalls and approaches to stalls, unusual attitudes and banks over 45° is prohibited in the airplane                                                                                                                                       | AFMAN                 |
| Runway 31's ILS: localizer and glideslope on 109.30 MHz, a 3.00° glideslope (today's listing; the 1998 approach may have differed)                                                                                                                    | Flight Plan Database  |

## Records looked for and not found

- **The recorder's data and the investigation report.** Neither is public, and no accident investigation board report on
  this event has been found. The recovered data went to the safety investigation (Flying Safety), and a safety board's
  report is privileged (Dover AFB, of a different mishap). A Freedom of Information Act request to the Air Force would
  be the way to ask; the privileged parts may be withheld.
- **A sharper copy of the animation.** The other copies found (on YouTube and Dailymotion) are the same 171 s, at
  640 × 480 or less.

## The flight data: how they were read

The animation draws its instruments on a fixed panel. Each frame was read by machine at the animation's own 10 frames
a second. Each instrument was calibrated from zoomed frames:

| Instrument | Read as                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Airspeed   | The needle's angle, scaled so the needle agrees with the digit window. The scale never reads below 50 kt.                                         |
| Altitude   | The needle, at 1,000 ft a turn, counted on from the window's 4,601 ft in the first frame.                                                         |
| Attitude   | The horizon line's angle gives the bank, right wing down positive. Its offset from the centre gives the pitch, at 10° to 21 pixels on the ladder. |
| AOA        | The tape's marker, scaled from −10 to 30. The marker stops at 30 off the top of the tape.                                                         |
| Flaps      | The “% FLAP” tape's marker, in percent of travel.                                                                                                 |
| N1         | Each engine's marker on the N1 scale, engines 1 to 4 from the left.                                                                               |
| Heading    | The window's digits only (below).                                                                                                                 |

The animation's values are the recorder's: the facility builds an animation's flight path and attitude from the
recorded airspeed, altitude, heading, pitch and roll, and it recovered all but 1 s of this event's 45 s from the tape
(Flying Safety). Where the lost second falls isn't said; the animation shows no gap.

Each needle and marker was median-filtered over five frames, about half a second. Bank, pitch, AOA and N1 were then
averaged over three samples. So the values here are the animation's, smoothed. They are not the recorder's own samples.

**Digit anchors.** The airspeed, altitude and heading windows were read by eye about once a second, and every half
second through the spiral's heading changes (`readings.ts`). The airspeed and altitude needles were then shifted to
agree with these readings, the shift interpolated between them. A reading was rejected if it differed from its needle
by more than 15 kt or 90 ft. Two altitude readings in the fall, at 121 and 122 s, disagreed with the needle by about
100 ft. That is the height lost there in two thirds of a second, so they are not used. The heading channel is the
readings themselves, joined by straight lines the short way round.

**The airspeed floor.** From 102.2 to 117 s the window reads 50 throughout. Needle noise either side of the floor is
taken as the floor. At 50 kt the page shows “≤50”: the airplane was that slow or slower.

**Flaps.** The marker is hard to pick out, so it was median-filtered over 4 s. Frames checked by eye show the flaps at 40%
from about 52 s to the end.

**Discrete displays.** The times of the gear handle and the two slat locks were found from the colours of their words.
Each change was then checked frame by frame:

- gear handle DOWN at 26.7 s, UP at 95.7 s;
- retract lock LOCKED until 9.3 s;
- extend lock LOCKED from 122.3 to 134.6 s, from 142.7 to 143.3 s, and from 145.3 s.

**Derived, not shown by the animation:**

- the vertical speed, the altitude's least-squares slope over 4 s;
- the flight path angle through the air, from that and the true airspeed;
- the track the 3D view draws: the animation's top view traced frame by frame against its runway and its 1 nm grid
  (below).

The speed below the 50 kt floor isn't known. In the spiral the animation's altitude holds, then drops hundreds of feet
in a second. The vertical speed is therefore an average, not what a VSI would have shown.

**Where the track lies.** No record gives the airplane's position, but the animation's top view shows it over its
ground: a white island on a blue sea ruled with a square grid. The view's camera follows the airplane from a fixed
distance and looks along one bearing, whatever the airplane does. So each frame can be projected onto sea level
through that camera, from the altitude the animation reads.

- **The camera.** The grid's two sets of lines meet at two points on the horizon. Fitted to the lines in frames from
  0:07 to 2:51, they give a camera looking 17° down with about 88° across the view, on a bearing between 41° and 43°
  to the grid's lines throughout. The airplane's drawn size puts the camera about 96 m from it.
- **The grid** is 1 nm square, and north–south on the island: matched to OpenStreetMap's coastline, the projected
  island needs no turn and a scale that makes the squares 1,852 m, and the airplane crosses them at its true airspeed.
- **The animation's motion.** Where the grid's lines fall in each frame, at the animation's 10 frames a second, gives
  the airplane's position within its square; followed from frame to frame, how far the animation moves it. In the
  first seconds the lines misread by up to 750 m; there the island's land, matched from frame to frame, gives the
  motion instead. From 0:07 to 1:52 the animation moves the airplane at the true airspeed (the indicated, corrected for
  ISA density) along the heading window's heading, with no wind: the grid keeps to that to 61 m RMS along the runway
  and 41 m across, and the island to 80 m from 0:07 to 0:20. Through the stall it doesn't. From about 2:21 too few
  lines are in view to follow: the grid drifts up to 480 m from where the runway, then in full view, puts the airplane.
- **Magnetic as true.** The heading window reads magnetic, and the runway's edges cross the grid at 309.2°. That is
  runway 31's magnetic heading in 1998: 301.7° true, with a variation of 7.96° W (IGRF-14), is 309.7°. The animation
  flies the magnetic heading and draws the runway on it, as if both were true; its island is set to true north. Here
  the track is laid on runway 31 as it was traced against the animation's, and the heading is turned to true by the
  variation, so the airplane points along it as it does in the animation.
- **The runway, across.** The runway is a dark line along a white strip of the island from 0:46, and fills the view
  from 2:18. In each frame its pixels, projected to sea level, run on its heading across the grid to within 1.5°;
  frames where they don't (the wing seen edge-on) are left out. Fitted, they give the airplane's offset from the
  centreline in 990 frames. From 0:46 to 1:52 that offset stays a constant distance from where the still air takes the
  airplane, its 1 s medians within 35 m (SD), and from 2:21 to the end within 13 m. Through the stall it moves 270 m.
- **The runway, along.** Where the dark line's near end holds still on the ground as the airplane flies on, it is the
  threshold. It does in five stretches: 1:32 to 1:42 (101 frames), 1:53 to 1:55 (21), 2:01 to 2:04 (29), 2:10 to 2:12
  (16) and 2:31 (9). Elsewhere the airplane hides it, and the line ends where the airplane does. Between the
  stretches, the airplane's motion over the grid keeps to the threshold to 110 m, through the spiral too.
- **The island doesn't agree with the runway.** The island is drawn to true north. Its land and sea, projected to sea
  level in each frame from 0:07 to 0:35 and carried by the animation's motion, match OpenStreetMap's coastline (on
  20 m cells) at a correlation of 0.72 with no turn, 0.62 to 0.66 turned 4° either way, and −0.07 as the track lies.
  So fitted, the island puts the animation's runway end 940 m up the real runway, on its centreline, with the runway
  turned 7.5° off the real one from there: the magnetic heading drawn as true. The island and the runway then place
  the airplane differently. At 0:07 the island has it 8.5 km short of the runway 31 end and 1,640 m left; at 0:13,
  7.9 km and 1,720 m; at 0:35, 5.5 km and 1,200 m. The track has 9.6 km and 400 m, 8.9 km and 565 m, and 6.5 km and
  360 m: about 1.1 km further out and 1.2 km to the right at the start, 1.3 km apart by 0:35. Later the land in view
  is the west arm, a long strip along the runway, which can't fix the along position: fitted over windows from 2:05
  to 2:51, it would move the track anywhere from 1.3 to 3.1 km along the runway. Carried on by the animation's motion,
  the island's placement has the airplane over land by 1:55, at its lowest at 2:24 63 m short of the runway 31 end,
  and at 2:27, where Lacklen has the recovery "above the lagoon", 150 m past it. The track follows the runway: it is
  what the crew flew to, on runway 31's localizer, and it keeps the recovery over the lagoon.

**The traced track** is the runway, frame by frame. Across, it is the runway's offset in each frame, smoothed over 5 s.
Along, it is pinned to the threshold in each of the five stretches, and moves as the grid moves the airplane between
them and as the still air does beyond them. From 2:11 to 2:21 the grid can't be followed: the airplane rolls past
vertical, with few lines in view. There the along offset is joined straight, from the threshold at 2:11 to the still
air the runway shows resuming at 2:21, which the threshold at 2:31 confirms. Before 0:46 the runway isn't in view. The
across offset is held from its first 15 s, and the track rests on the still air, which the grid follows there to about
60 m. Over the first 5 s the runway is seen, the smoothing has frames on one side only, so the offset eases from the
held value into the traced one rather than stepping onto that edge.

Drawn back into the frames, the traced runway falls on the dark line, and its threshold on the line's end from 1:32
to 2:31. That includes 2:18 to 2:28, where the end wasn't read. The track keeps to the runway's offset to 24 m RMS
across 990 frames, and to the threshold to 16 m RMS (52 m at most) across 176. Laid on runway 31, the track:

- is in a right turn at 0:07 at 4,601 ft, over the sea east of the east arm, 9.6 km (5.2 nm) short of the runway 31
  end and 400 m left of its extended centreline, joining it;
- swings out to 580 m left at 0:15 as it rolls out, crosses the east arm from 0:33 to 0:48 at about 4,400 to
  4,560 ft, and closes to 120 m left at 0:55;
- is 3.7 km (2.0 nm) short at 1:10, 280 m left of the centreline, at 4,556 ft, when the copilot calls for the descent,
  and between 260 and 320 m left of it until 1:42;
- stalls and spirals over the lagoon, between 1.9 and 1.2 km short, up to 410 m left;
- is at its lowest, 771 ft at 2:24, 1.0 km short of the runway, 30 m left of its centreline, over the lagoon;
- is still over the lagoon at 2:27, where Lacklen has the recovery at 733 ft “above the lagoon”, and crosses its shore
  at 2:32;
- ends 1.2 km past the runway 31 end and 150 m right of its centreline.

No source gives the night's wind. The animation flies none, so neither does the track. A wind would have moved the
real airplane's path by about 31 m a minute for each knot.

**The cloud.** The page's cloud base is Lacklen's 1,500 ft. The tops are not known.

## The cockpit voice recording

The words and their times are machine transcriptions, which nobody has checked by ear but for one speaker. Whisper large-v3 transcribed
the whole sound track. Short stretches were transcribed again with large-v3 and medium.en, after filtering the audio
to the voice band. Each line's basis is marked:

- **account**: Lacklen quotes these words, so his wording and the speaker he names are used. His times agree with the
  transcription's to about a second.
- **asr**: the transcriptions agree on these words.
- **unclear**: they don't agree, or only some words can be made out.

“…” stands for words that can't be made out. [Brackets] mark a word the recording doesn't make clear, read from the
context the line's note gives. Speakers are named where Lacklen names them, and for the GPWS's voice. One call was
attributed by ear: “You got more power available to you” (113.3 s) is the copilot's voice, running straight on into the
copilot's “Put the nose down.” Lacklen gives it to the female flight engineer.

“310 both sides, 109.3” (35.1 s) and “310 both sides, localizer set, right?” (47.7 s): the transcriptions agree on these
words. They set up runway 31's ILS: the course on both pilots' instruments and the localizer's frequency.

## Where the records differ

|                        | Lacklen             | The animation                                         |
| ---------------------- | ------------------- | ----------------------------------------------------- |
| Bank at 2:14           | 110° right          | about 94° right                                       |
| Airspeed at 2:14       | 105 kt              | 96 kt                                                 |
| Height lost by 1:55    | almost 1,000 ft     | about 860 ft                                          |
| Bank at 1:58           | near 90° right      | 58° right at most                                     |
| Recovery               | 733 ft at 2:27      | the altimeter bottoms out at 771 ft at 144.2 s (2:24) |
| “More power available” | the flight engineer | the copilot's voice on the sound track                |

The animation shows the gear handle move 2.6 s before each gear call is heard: “Gear down” at 29.3 s and “Gear up” at
98.3 s. It isn't known whether the animation's data lead its audio. The replay keeps the animation's timing.

## Not shown

- The animation's normal acceleration. It is partly legible, about 2 g in the pull-out.
- One parameter the animation shows without a name.
- What TRT stands for. Lacklen doesn't spell it out; he gives only what the call did. The AFMAN doesn't define it.

## The 3D view

The view is schematic. The C-5's overall dimensions come from Wikipedia: length, span, height, wing area, sweep, and
the root and tip wing sections. Everything else is drawn to look right: the fuselage, the pods, the T-tail, the gear and
the engine nacelles.

These sources don't give the following, so the drawing chooses them:

- **Flaps:** how far they turn at each percent. They are drawn turning to 35° at 100%.
- **Slats:** how far they droop, and where along the span each of the 14 sits. They are drawn drooping 22°, seven
  of equal width on each wing.
- **Transit times:** how long the gear and slats take to move. The drawing uses 8 s for the gear and 4 s for the slats.
- **Unseated slats:** while neither lock shows LOCKED, they are drawn stopped at 80% of their travel, exaggerated so the
  shortfall can be seen.

The airplane flies the track traced above, nose 7.96° left of the heading window's heading: the magnetic heading
turned to true by the variation.
With a Maps key, Google's 3D tiles draw Diego Garcia under it. Without one, a flat sea at 0 ft stands in.

It was night; the view is lit to be seen.

## Runway 31's ILS

The crew set up runway 31's ILS (“310 both sides, 109.3”). 310° was the runway's magnetic heading in 1998: 301.7° true
with IGRF-14's 7.96° W. Flight Plan Database lists 109.30 MHz as the localizer's frequency today, with a 3.00°
glideslope. No 1998 approach chart is public, so the glideslope is today's.

The view draws the localizer's course along the runway's extended centreline, on the sea (10 m up when the island's
3D tiles are shown, so their runway and shore don't flicker through it), and the glideslope rising
3° from the threshold at the runway's 9 ft, both out to the glideslope's 10 nm. The sources differ on the course:
Flight Plan Database puts the localizer on 301.84° true and the runway on 301.86°, OurAirports the runway on 301.7°.
The view keeps OurAirports' 301.7°, the runway the track is traced against; 0.14° apart, the two courses are about 45 m
apart at 10 nm. Past the threshold the glideslope has ended, so the panel gives no height above it. They show through the cloud. The real
glide path meets the runway beyond the threshold, abeam the glideslope's antenna, which these sources don't place, so it
is a little higher than drawn.

Against it, from the track: the airplane is 2,814 ft above the glideslope at 0:18, its closest, and 4,588 ft above at
the top of the climb (1:44). At “Descend” (1:10) it is 2.0 nm from the threshold at 4,556 ft, where the glideslope is at
about 650 ft: about 3,900 ft above. Neither record says why it was this high.
