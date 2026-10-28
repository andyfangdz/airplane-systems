/**
 * What can be heard on the cockpit audio, in seconds into the video. Machine transcriptions (Whisper large-v3 over the
 * whole recording, and large-v3 and medium.en over short stretches of it) give the words and their times; nobody has
 * checked them by ear, except one line's speaker. Where Jay Lacklen's account quotes a line, his wording and the speaker
 * he names are used and the line is marked "account"; his times are this video's and agree with the transcription's
 * to about a second.
 *
 * In `text`, "…" stands for words that can't be made out and [brackets] for a word the recording doesn't make clear,
 * read from the context the note gives.
 */

export type Speaker = "Pilot" | "Copilot" | "Flight engineer" | "GPWS";

/**
 * `account`: Lacklen quotes these words. `asr`: the machine transcriptions agree on them. `unclear`: they don't, or
 * only some words can be made out.
 */
export type Basis = "account" | "asr" | "unclear";

export interface Line {
  /** Seconds into the video the words start and end. */
  t: number;
  end: number;
  /** Who speaks: where Lacklen says so, the GPWS's voice, or one voice heard on the recording (its note says so). */
  who?: Speaker;
  text: string;
  basis: Basis;
  note?: string;
}

export const TRANSCRIPT: readonly Line[] = [
  {
    t: 6.7,
    end: 10.7,
    text: "… Flaps 40. Flaps 40.",
    basis: "account",
    note: "Lacklen: the pilot started configuring by calling “Flaps 40,” and shortly thereafter, “Gear down.”",
  },
  {
    t: 29.3,
    end: 30.8,
    text: "Gear down, [before landing] check… gear down.",
    basis: "account",
    note: "“Gear down” as Lacklen has it; the transcriptions differ on the words between.",
  },
  {
    t: 35.1,
    end: 38.5,
    text: "310 both sides, 109.3.",
    basis: "asr",
    note: "Setting up runway 31's ILS: the course, 310°, on both pilots' instruments, and the localizer's frequency, 109.3 MHz.",
  },
  {
    t: 38.6,
    end: 40.4,
    text: "Looks like we still have an in-transit on our [slats].",
    basis: "asr",
    note: "The transcription hears “slew” or “sleep”; Lacklen: the slat annunciator illuminated as the slats extended.",
  },
  { t: 40.5, end: 41.7, text: "Yep, we got [it] still on our [slats].", basis: "asr" },
  { t: 47.7, end: 49.6, text: "310 both sides, localizer set, right?", basis: "asr" },
  { t: 49.8, end: 51.7, text: "Yeah, set at… what is it, ten knots.", basis: "asr" },
  { t: 57.8, end: 59.6, text: "Okay, before landing… landing gear …", basis: "unclear" },
  { t: 62.1, end: 63.9, text: "Yeah, let's go … Yeah, go …", basis: "unclear" },
  {
    t: 66.6,
    end: 69.1,
    text: "And we have the [scanner] checking out the [slats] for us.",
    basis: "asr",
    note: "Lacklen: the flight engineer sent the scanner to observe the slats.",
  },
  {
    t: 69.8,
    end: 70.2,
    who: "Copilot",
    text: "Descend.",
    basis: "account",
    note: "Lacklen, 1:10: the copilot tells the pilot to descend, since they are configured and past the final approach fix.",
  },
  {
    t: 76.6,
    end: 77.3,
    who: "Copilot",
    text: "What's up with our…?",
    basis: "account",
    note: "Lacklen, 1:17: the airplane is level, with low but acceptable airspeed. This is where the climb begins.",
  },
  {
    t: 79.9,
    end: 81.1,
    who: "Copilot",
    text: "You're showing like a 10-degree climb.",
    basis: "account",
    note: "Lacklen, 1:20.",
  },
  { t: 86.1, end: 87.1, who: "Copilot", text: "What's up with our INSs?", basis: "account", note: "Lacklen, 1:26." },
  { t: 87.4, end: 87.8, who: "Pilot", text: "I don't know.", basis: "account" },
  {
    t: 90.3,
    end: 91.0,
    who: "Copilot",
    text: "That's not good.",
    basis: "account",
    note: "Lacklen, 1:30: apparently about the INSs, as the airspeed falls below 100 kt.",
  },
  { t: 91.6, end: 93.1, who: "Copilot", text: "Okay, you're climbing. You don't want…", basis: "account" },
  {
    t: 95.9,
    end: 96.7,
    who: "Copilot",
    text: "Accelerate. Accelerate.",
    basis: "account",
    note: "Lacklen, 1:35: the pilot acknowledges, but the throttles do not move from the low 80% N1 range.",
  },
  {
    t: 98.3,
    end: 100.2,
    who: "Pilot",
    text: "Gear up. Gear up.",
    basis: "account",
    note: "Lacklen, 1:38: he presumes the pilot is starting a missed approach. The gear was up as they recovered over the lagoon.",
  },
  {
    t: 102.3,
    end: 104.1,
    who: "Copilot",
    text: "TRT. TRT.",
    basis: "account",
    note: "Lacklen, 1:42: twice in rapid succession, with N1 at 85%; after initial hesitation the pilot starts the throttles forward.",
  },
  {
    t: 112.1,
    end: 113.2,
    who: "Copilot",
    text: "Put TRT in.",
    basis: "account",
    note: "Lacklen, 1:52: with urgency, but the throttles are already near 100%.",
  },
  {
    t: 113.3,
    end: 114.9,
    who: "Copilot",
    text: "You got more power available to you.",
    basis: "asr",
    note: "The copilot's voice on the recording, running straight on into “Put the nose down.” Lacklen gives the call to the flight engineer: she “adds that there is more power available even though the N1 is at or near 100%.”",
  },
  {
    t: 115.3,
    end: 116.4,
    who: "Copilot",
    text: "Put the nose down.",
    basis: "account",
    note: "Lacklen, 1:55: in full stall. Reportedly the pilot is holding full back pressure, with no stick shaker to warn of the stall.",
  },
  {
    t: 116.8,
    end: 118.3,
    who: "Copilot",
    text: "Watch your temperatures. You're climbing.",
    basis: "account",
    note: "Lacklen, 1:58: the engine temperatures. In fact the nose is falling through level flight in a full stall.",
  },
  {
    t: 135.7,
    end: 138.9,
    who: "Copilot",
    text: "Put the nose down. Put the nose down. You've got altitude to work with.",
    basis: "account",
    note: "Lacklen: passing through 1,500 ft the crew regains visual conditions.",
  },
  {
    t: 139.2,
    end: 140.3,
    who: "GPWS",
    text: "Terrain. Terrain.",
    basis: "asr",
    note: "Lacklen: the ground proximity warning system activates as the ocean surface approaches.",
  },
  { t: 141.4, end: 142.5, who: "Copilot", text: "You've got altitude to work with.", basis: "account" },
  { t: 146.3, end: 147.1, text: "Okay.", basis: "asr" },
  { t: 148.5, end: 149.6, text: "… God knows.", basis: "unclear" },
  { t: 151.7, end: 153.0, text: "All right, we have speed.", basis: "asr" },
  { t: 156.6, end: 158.6, text: "… encounter something … not sure …", basis: "unclear" },
  { t: 164.4, end: 165.1, text: "Acknowledged.", basis: "asr" },
  { t: 167.8, end: 170.2, text: "…, tower, roger, no traffic.", basis: "asr" },
];

/** The line being spoken at `t`, or null between lines. */
export function lineAt(t: number, lines: readonly Line[] = TRANSCRIPT): Line | null {
  for (const l of lines) if (t >= l.t && t < l.end) return l;
  return null;
}

/** The index of the last line started by `t` (−1 before the first): the transcript list's place. */
export function lastLineIndex(t: number, lines: readonly Line[] = TRANSCRIPT): number {
  let i = -1;
  for (let k = 0; k < lines.length && lines[k].t <= t; k++) i = k;
  return i;
}
