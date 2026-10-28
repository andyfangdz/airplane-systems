/**
 * The C-5 Galaxy's stall and fall on approach to Diego Garcia, summer 1998: what the replay page shows and where each
 * fact comes from. No investigation report is public. The record is the USAF Mishap Analysis Animation Facility's
 * flight data animation with the cockpit voice recording (the video below), read frame by frame for the flight data
 * (fdr.ts) and transcribed for the voices (transcript.ts), and the account of Jay Lacklen, a C-5 pilot who sat on the
 * crew's first debriefing, whose times are this video's. SOURCES.md has the method and the limits.
 */

/** Short labels for the sources, as the notes cite them. */
export const ANIMATION = "USAF animation";
export const LACKLEN = "Lacklen";
export const WIKI = "Wikipedia";
export const AFMAN = "AFMAN 11-2C-5V3";
export const FSM = "Flying Safety";

export const C5_DIEGO_GARCIA = {
  id: "c5-diego-garcia",
  name: "C-5 stall, Diego Garcia",
  sub: "1998 flight data and cockpit audio replay",
  lead: "A C-5 Galaxy's stall and fall on approach to Diego Garcia in 1998, replayed from the USAF's flight data animation in step with its cockpit voice recording: the slats that would not lock and the stick shaker they silenced, flaps, gear, engines and the flight instruments.",
  /** The video: the USAF animation with the cockpit audio, as published on YouTube. */
  video: {
    id: "G0Z2gDHQx1M",
    title: "C5 USAF Diego Garcia Incident (1998 Summer)",
    channel: "ChilloutJr's - CVR & ATC Audio Archive",
    url: "https://www.youtube.com/watch?v=G0Z2gDHQx1M",
    /** Seconds. */
    duration: 171.4,
    /** The title cards: "USAF Mishap Analysis Animation Facility, HQ-AFSC/SEFE-OL, Tinker AFB, OK", then "C-5 Loss of
     * Control, Diego Garcia". The data starts after them. */
    titleCards: [
      "USAF Mishap Analysis Animation Facility, HQ-AFSC/SEFE-OL, Tinker AFB, OK",
      "C-5 Loss of Control, Diego Garcia",
    ],
  },
  account: {
    author: "Jay Lacklen",
    title: "Stall and Fall! That time a C-5 Galaxy nearly crashed while approaching Diego Garcia",
    publisher: "The Aviation Geek Club",
    date: "13 July 2018",
    url: "https://theaviationgeekclub.com/stall-and-fall-that-time-a-c-5-galaxy-nearly-crashed-while-approaching-diego-garcia/",
    /** Lacklen calls the video's times "the 1:10 minute point on this video" and so on; they are this video's. */
    note: "A former C-5 pilot with 12,500 flying hours, who sat on the crew's initial debriefing at Dover AFB; from book three of his memoir, Flying the Line.",
  },
  /** The recorder, in the animation facility's own words: its chief's article on the facility, which tells how the data
   * of "a C-5 incident at Diego Garcia" were recovered. */
  recorder: {
    author: "Greg Smith, Chief, MAAF Facility",
    title: "The USAF Mishap Analysis and Animation Facility",
    publisher: "Flying Safety, HQ Air Force Safety Center",
    date: "December 1998",
    url: "https://www.safety.af.mil/Portals/71/documents/Magazines/FSM/fsmdec98.pdf?ver=2017-03-28-101008-997",
    /** "The depot used standard downloading equipment to try to get the data, but the entire 45-second incident was
     * missing" (pp. 8–9). */
    incidentS: 45,
    /** "We were able to recover all but 1 second of the missing data and help determine the true cause of the
     * incident" (p. 9). Where the lost second falls isn't said. */
    unrecoveredS: 1,
  },
  event: {
    when: "Summer 1998, at night",
    where: "Approach to Diego Garcia, in the Indian Ocean",
    crew: "A Dover AFB reserve crew with an active-duty copilot; the pilot was flying",
    weather:
      "Generally visual conditions, but the only clouds for 100 miles enveloped them as they configured and approached the final approach fix",
  },
  /** The C-5's operations manual: today's (C-5M) minimum equipment and training rules. The 1998 rules may have
   * differed. */
  manual: {
    title: "AFMAN 11-2C-5 Volume 3, C-5 Operations Procedures",
    date: "20 October 2022",
    /** As the Wikipedia article on the C-5 cites it. */
    url: "https://static.e-publishing.af.mil/production/1/af_a3/publication/afman11-2c-5v3/afman11-2c-5v3.pdf",
  },
  /** Lockheed C-5 Galaxy dimensions and layout (Wikipedia, "Lockheed C-5 Galaxy", specifications and design). */
  airplane: {
    lengthFt: 247 + 1 / 12,
    spanFt: 222 + 9 / 12,
    heightFt: 65 + 1 / 12,
    wingAreaSqFt: 6200,
    sweepDeg: 25,
    /** "Its high-flotation main landing gear provides 28 wheels" (Wikipedia). */
    wheels: 28,
    /** Leading-edge slats: 14 installed, all 14 required for flight (AFMAN 11-2C-5V3, Table 3.5, item 5-5d, p. 38). */
    slats: 14,
    /** "Stallimiter System": 2 installed, "1 fully functioning system required for all departures" (AFMAN 11-2C-5V3,
     * Table 3.14, item 14-1, p. 60). */
    stallimiters: 2,
    /** Every C-5 flew on TF39s until the C-5M's re-engining; the last TF39-powered C-5 flew in late 2017. */
    engines: "General Electric TF39 turbofans",
    engineCount: 4,
  },
  /** Cloud: "Passing through 1500-feet the crew regains visual conditions" (Lacklen). The tops aren't published. */
  cloudBaseFt: 1500,
  /** The airfield, as OurAirports lists it (airports.csv and runways.csv). */
  airport: {
    ident: "FJDG",
    name: "Naval Support Facility Diego Garcia",
    url: "https://ourairports.com/airports/FJDG/",
    elevationFt: 9,
    runway: {
      lengthFt: 12003,
      widthFt: 200,
      /** The runway's ends, degrees: 13 at the north-west end, 31 at the south-east; both at 9 ft. */
      end13: { lat: -7.304570198059082, lon: 72.39700317382812 },
      end31: { lat: -7.321959972381592, lon: 72.42520141601562 },
      /** Runway 31's true heading, degrees. */
      heading31T: 301.7,
    },
    /** The EGM96 geoid's height above the WGS84 ellipsoid at the runway 31 end, m: the 3D tiles' heights are
     * ellipsoidal, so sea level is this far below their zero (egm96-universal's meanSeaLevel). */
    geoidM: -74.72,
    /** Runway 31's ILS as Flight Plan Database lists it today: localizer and glideslope INKW on 109.30 MHz, the
     * localizer on 301.84° true (the runway's 301.86°), the glideslope at 3.00° with a range of 10 nm. It gives no
     * threshold crossing height and doesn't place the glideslope's antenna. The crew set it up: “310 both sides,
     * 109.3”. The 1998 approach may have differed. */
    ils: {
      source: "Flight Plan Database",
      url: "https://flightplandatabase.com/airport/FJDG",
      ident: "INKW",
      mhz: 109.3,
      glideslopeDeg: 3,
      glideslopeRangeNm: 10,
    },
  },
} as const;

export type C5Spec = typeof C5_DIEGO_GARCIA;
