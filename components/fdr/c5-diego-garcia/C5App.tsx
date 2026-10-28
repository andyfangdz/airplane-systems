"use client";
/**
 * The Diego Garcia replay: the C-5 in 3D flying the USAF animation's flight data, its instruments over the foot of the
 * view with the transport and the words being spoken, and a panel with the video (the cockpit audio, which keeps the
 * time once it plays), the moments of the event, the transcript, charts of the whole event, the airplane's systems
 * involved, and where every number comes from.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef, type ReactNode } from "react";
import { Facts, H3, Notes, Small } from "@/components/ui/controls";
import { f0 } from "@/lib/format";
import { clamp } from "@/lib/math";
import { useLiveSelector, useLiveSnapshot } from "@/lib/useLiveSnapshot";
import { FDR, FDR_DT, FDR_T0 } from "@/fdr/c5-diego-garcia/fdr";
import {
  DURATION,
  GEAR_TRANSIT_S,
  IAS_FLOOR,
  MOMENTS,
  SLAT_RET_LOCKED_UNTIL,
  T_START,
  VS_WINDOW_S,
} from "@/fdr/c5-diego-garcia/model";
import { AFMAN, ANIMATION, FSM, LACKLEN, WIKI } from "@/fdr/c5-diego-garcia/spec";
import { TRANSCRIPT, lastLineIndex, lineAt } from "@/fdr/c5-diego-garcia/transcript";
import { FdrShell } from "../FdrShell";
import { ViewToggles } from "@/components/engine/chrome";
import { ComponentIntro } from "@/components/engine/ComponentIntro";
import { drawAdi } from "./instruments";
import {
  attachPlayer,
  detachPlayer,
  playerState,
  replay,
  seek,
  spec,
  TILES_KEY,
  togglePlay,
  useC5View,
  useReplay,
  useReplayLoop,
  useTerrain,
  videoLoading,
  type Replay,
} from "./store";
import { HOST, loadYouTube, type YTPlayer } from "./youtube";
import "./c5.css";

const Scene = dynamic(() => import("./C5Scene"), { ssr: false, loading: () => <div /> });

/** m:ss into the video. */
const mmss = (t: number) => {
  const s = Math.max(0, Math.floor(t + 1e-6));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
/** A whole number with its sign; zero bare, never "−0". */
const signed = (v: number) => {
  const r = Math.round(v);
  return (r > 0 ? "+" : r < 0 ? "−" : "") + f0(Math.abs(r));
};
const hdg3 = (h: number) => String(Math.round(h) % 360 || 360).padStart(3, "0");
const bankText = (b: number) => (Math.round(b) === 0 ? "0" : `${f0(Math.abs(b))} ${b < 0 ? "L" : "R"}`);

/** The AOA tape's range in the animation, and the angle Lacklen gives as the stall in the recovery. */
const AOA_MIN = -10,
  AOA_MAX = 30,
  AOA_STALL = 18;
/** The animation's N1 scale. */
const N1_MAX = 110;

// ---------------------------------------------------------------- the instruments over the view

/** A canvas drawn by `draw` at its displayed size. */
function Dial({
  label,
  draw,
  className,
}: {
  label: string;
  draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void;
  className: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr) || 120,
      h = Math.round(c.clientHeight * dpr) || 120;
    if (c.width !== w || c.height !== h) [c.width, c.height] = [w, h];
    const ctx = c.getContext("2d");
    if (ctx) draw(ctx, w, h);
  });
  return <canvas ref={ref} className={className} role="img" aria-label={label} />;
}

/** A vertical bar gauge: the AOA and each engine's N1. */
function Bar({
  label,
  value,
  min,
  max,
  text,
  mark,
  bad,
  title,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  text: string;
  mark?: number;
  bad?: boolean;
  title: string;
}) {
  const at = (v: number) => `${clamp((v - min) / (max - min), 0, 1) * 100}%`;
  return (
    <div className="c5-bar" title={title}>
      <div className="c5-track" aria-hidden>
        <div className={bad ? "c5-fill bad" : "c5-fill"} style={{ height: at(value) }} />
        {mark !== undefined && <i style={{ bottom: at(mark) }} />}
      </div>
      <b className={bad ? "bad" : ""} aria-label={`${title}: ${text}`}>
        {text}
      </b>
      <span>{label}</span>
    </div>
  );
}

function Transport({ t }: { t: number }) {
  const playing = useReplay((x) => x.playing);
  return (
    <div className="c5-transport">
      <button type="button" className="c5-play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
        <svg viewBox="0 0 16 16" aria-hidden>
          {playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="M4 2.5v11l9-5.5z" />}
        </svg>
      </button>
      <span className="c5-time">{mmss(t)}</span>
      <div className="c5-scrub">
        <input
          type="range"
          min={0}
          max={DURATION}
          step={0.1}
          value={t}
          onChange={(e) => seek(+e.target.value)}
          aria-label="Time in the video"
          aria-valuetext={mmss(t)}
        />
        <div className="c5-ticks" aria-hidden>
          {MOMENTS.map((m) => (
            <i key={m.t} style={{ left: `${(m.t / DURATION) * 100}%` }} />
          ))}
        </div>
      </div>
      <span className="c5-time">{mmss(DURATION)}</span>
    </div>
  );
}

function Monitor() {
  const x = useLiveSnapshot(replay, 50);
  const f = x.f;
  const lock = (on: boolean) => <b className={on ? "c5-locked" : "warnc"}>{on ? "LOCKED" : "NO LOCK"}</b>;
  return (
    <div className="eng-mon c5-mon" aria-live="off">
      <div className={f.data ? "c5-inst" : "c5-inst c5-pre"}>
        <div className="c5-adi-box">
          <Dial
            className="c5-adi"
            label={`Attitude: pitch ${signed(f.pitch)}°, bank ${bankText(f.bank)}`}
            draw={(c, W, H) => drawAdi(c, W, H, f.pitch, f.bank)}
          />
          <small>
            <span className="n">{signed(f.pitch)}°</span> · bank <span className="n">{bankText(f.bank)}</span>
          </small>
        </div>
        <div className="mon-big c5-big">
          <div>
            <span>IAS</span>
            <b className={f.iasFloor ? "bad" : ""}>{f.iasFloor ? `≤${IAS_FLOOR}` : f0(f.ias)}</b>
            <i>kt</i>
          </div>
          <div>
            <span>ALT</span>
            <b>{f0(f.alt)}</b>
            <i>ft</i>
          </div>
          <div>
            <span>VS</span>
            <b>{signed(Math.round(f.vs / 100) * 100)}</b>
            <i>fpm</i>
          </div>
          <div>
            <span>HDG</span>
            <b>{hdg3(f.hdg)}</b>
            <i>°</i>
          </div>
        </div>
        <div className="c5-bars">
          <Bar
            label="AOA"
            title="Angle of attack"
            value={f.aoa}
            min={AOA_MIN}
            max={AOA_MAX}
            mark={AOA_STALL}
            bad={f.aoa > AOA_STALL}
            text={f.aoaPegged ? `≥${AOA_MAX}` : String(Math.round(f.aoa))}
          />
          {f.n1.map((n, k) => (
            <Bar
              key={k}
              label={String(k + 1)}
              title={`Engine ${k + 1} N1, %`}
              value={n}
              min={0}
              max={N1_MAX}
              text={String(Math.round(n))}
            />
          ))}
        </div>
        <div className="c5-ann">
          <div>
            <span>SLATS</span>
          </div>
          <div>
            <span>EXT</span>
            {lock(f.slatExtLocked)}
          </div>
          <div>
            <span>RET</span>
            {lock(f.slatRetLocked)}
          </div>
          <div>
            <span>GEAR HDL</span>
            <b>{f.gear}</b>
          </div>
          <div>
            <span>FLAP</span>
            <b>{Math.round(f.flaps)} %</b>
          </div>
        </div>
      </div>
      <div className="c5-tags">
        {!f.data && <span className="c5-tag">Title cards: the data starts at {mmss(T_START)}</span>}
        {x.t >= SLAT_RET_LOCKED_UNTIL && (
          <span
            className="c5-tag bad"
            title={`${LACKLEN}: the slat malfunction disabled the stick-shaker stall warning; it never warned the crew`}
          >
            Stick shaker disabled
          </span>
        )}
        <span className="c5-tag" title={`${LACKLEN}: visual again passing 1,500 ft; the tops aren't known`}>
          {f.inCloud ? "In cloud" : "Below the cloud"}
        </span>
      </div>
      <Transport t={x.t} />
    </div>
  );
}

const lineNow = (r: Replay) => lineAt(r.t);

/** The words being spoken, as subtitles; their place is kept between lines. */
function Caption() {
  const l = useLiveSelector(replay, lineNow, 100);
  return (
    <div className="c5-caption">
      {l && (
        <span>
          {l.who && <b>{l.who}: </b>}
          {l.text}
        </span>
      )}
    </div>
  );
}

function Foot() {
  return (
    <>
      <Caption />
      <Monitor />
    </>
  );
}

// ---------------------------------------------------------------- the video

function Video() {
  const video = useReplay((x) => x.video);
  const host = useRef<HTMLDivElement>(null);
  const own = useRef<YTPlayer | null>(null);
  useEffect(
    () => () => {
      own.current?.destroy();
      own.current = null;
      detachPlayer();
    },
    [],
  );
  const load = async () => {
    if (own.current) return;
    videoLoading();
    try {
      const YT = await loadYouTube();
      if (!host.current || own.current) return;
      // the player replaces this element with its iframe: one React doesn't own
      const el = document.createElement("div");
      host.current.appendChild(el);
      const p: YTPlayer = new YT.Player(el, {
        videoId: spec.video.id,
        host: HOST,
        width: "100%",
        height: "100%",
        playerVars: { start: Math.floor(replay.t), rel: 0, playsinline: 1 },
        events: {
          onReady: () => attachPlayer(p),
          onStateChange: (e) => playerState(e.data),
          onError: () => {
            p.destroy();
            own.current = null;
            detachPlayer(true);
          },
        },
      });
      own.current = p;
    } catch {
      detachPlayer(true);
    }
  };
  const link = (
    <a href={spec.video.url} target="_blank" rel="noopener noreferrer">
      {spec.video.title}
    </a>
  );
  return (
    <>
      <H3>Cockpit audio</H3>
      <div className="c5-frame" ref={host}>
        {video !== "ready" && (
          <button type="button" className="c5-facade" onClick={load} disabled={video === "loading"}>
            <svg viewBox="0 0 16 16" aria-hidden>
              <path d="M4 2.5v11l9-5.5z" />
            </svg>
            <b>{video === "loading" ? "Loading the video…" : "Load the video with the cockpit audio"}</b>
            <span>YouTube · {spec.video.channel}</span>
          </button>
        )}
      </div>
      {video === "error" ? (
        <Small>
          The video couldn&apos;t be played here: watch {link} on YouTube. The replay runs silently on its own clock.
        </Small>
      ) : (
        <Small>
          {link}: the {ANIMATION} of the flight data, with the cockpit voice recording. Loading it fetches
          YouTube&apos;s player; once it plays, the replay follows the video however you play, pause or seek it, here or
          in the player. Without it the replay runs silently on its own clock.
        </Small>
      )}
    </>
  );
}

// ---------------------------------------------------------------- the event

/** The moment the replay is in: the last one started (a little early, so a seek to one lands on it). */
const momentNow = (r: Replay) => {
  let i = -1;
  MOMENTS.forEach((m, k) => {
    if (m.t <= r.t + 0.25) i = k;
  });
  return i;
};

function Timeline() {
  const i = useLiveSelector(replay, momentNow, 150);
  return (
    <>
      <H3>What happened</H3>
      <ol className="c5-list c5-moments">
        {MOMENTS.map((m, k) => (
          <li key={m.t} aria-current={k === i ? "step" : undefined}>
            <button type="button" onClick={() => seek(m.t)}>
              <span className="c5-at">{mmss(m.t)}</span>
              <b>{m.title}</b>
            </button>
            {k === i && <p>{m.text}</p>}
          </li>
        ))}
      </ol>
    </>
  );
}

const lineIndexNow = (r: Replay) => lastLineIndex(r.t + 0.25);

function Transcript() {
  const i = useLiveSelector(replay, lineIndexNow, 150);
  return (
    <>
      <H3>Cockpit voice recording</H3>
      <Small>
        Machine transcription, timed to the video. Where {LACKLEN} quotes a line his words and the speaker he names are
        used; [brackets] mark a word the recording doesn&apos;t make clear, … words that can&apos;t be made out.
      </Small>
      <ol className="c5-list c5-lines">
        {TRANSCRIPT.map((l, k) => (
          <li key={l.t} aria-current={k === i ? "true" : undefined}>
            <button type="button" onClick={() => seek(l.t)}>
              <span className="c5-at">{mmss(l.t)}</span>
              <span className="c5-text">
                {l.who && <b>{l.who}: </b>}
                {l.text}
                {l.basis === "account" && <em className="c5-basis"> {LACKLEN}</em>}
                {l.basis === "unclear" && <em className="c5-basis"> unclear</em>}
              </span>
            </button>
            {k === i && l.note && <p>{l.note}</p>}
          </li>
        ))}
      </ol>
    </>
  );
}

// ---------------------------------------------------------------- charts of the whole event

const CW = 330,
  CH = 100,
  PAD = { l: 38, r: 8, t: 8, b: 16 };
const cx = (t: number) => PAD.l + (t / DURATION) * (CW - PAD.l - PAD.r);
const TIMES = FDR.ias.map((_, i) => FDR_T0 + i * FDR_DT);

interface Series {
  ys: readonly number[];
  cls: string;
}
interface Line {
  v: number;
  label: string;
}

const tNow = (r: Replay) => Math.round(r.t * 10) / 10;

function NowLine() {
  const t = useLiveSelector(replay, tNow, 100);
  return <line className="now" x1={cx(t)} x2={cx(t)} y1={PAD.t} y2={CH - PAD.b} />;
}

function Chart({
  title,
  unit,
  lo,
  hi,
  ticks,
  series,
  lines = [],
}: {
  title: string;
  unit: string;
  lo: number;
  hi: number;
  ticks: number[];
  series: Series[];
  lines?: Line[];
}) {
  const py = (v: number) => CH - PAD.b - ((clamp(v, lo, hi) - lo) / (hi - lo)) * (CH - PAD.t - PAD.b);
  const path = (ys: readonly number[]) =>
    ys.map((v, i) => `${i ? "L" : "M"}${cx(TIMES[i]).toFixed(1)},${py(v).toFixed(1)}`).join("");
  const click = (e: React.MouseEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * CW;
    seek(((x - PAD.l) / (CW - PAD.l - PAD.r)) * DURATION);
  };
  return (
    <figure className="c5-fig">
      <figcaption>
        {title} <span>{unit}</span>
      </figcaption>
      <svg
        className="eng-chart c5-chart"
        viewBox={`0 0 ${CW} ${CH}`}
        role="img"
        aria-label={`${title} over the event; click to go to a time`}
        onClick={click}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={CW - PAD.r} y1={py(v)} y2={py(v)} className="grid" />
            <text x={PAD.l - 4} y={py(v) + 3.5} textAnchor="end">
              {f0(v)}
            </text>
          </g>
        ))}
        {lines.map((l) => (
          <g key={l.label} className="c5-limit">
            <line x1={PAD.l} x2={CW - PAD.r} y1={py(l.v)} y2={py(l.v)} />
            <text x={PAD.l + 4} y={py(l.v) - 3}>
              {l.label}
            </text>
          </g>
        ))}
        {series.map((s, k) => (
          <path key={k} d={path(s.ys)} className={s.cls} />
        ))}
        {[0, 30, 60, 90, 120, 150].map((t) => (
          <text key={t} x={cx(t)} y={CH - 4} textAnchor={t ? "middle" : "start"}>
            {mmss(t)}
          </text>
        ))}
        <NowLine />
      </svg>
    </figure>
  );
}

function Charts() {
  return (
    <>
      <H3>The whole event</H3>
      <Small>Click a chart to go to that moment.</Small>
      <Chart
        title="Altitude"
        unit="ft"
        lo={0}
        hi={5000}
        ticks={[0, 2500, 5000]}
        series={[{ ys: FDR.alt, cls: "trace" }]}
        lines={[{ v: spec.cloudBaseFt, label: "cloud base" }]}
      />
      <Chart
        title="Indicated airspeed"
        unit={`kt (the animation reads no lower than ${IAS_FLOOR})`}
        lo={0}
        hi={220}
        ticks={[0, 100, 200]}
        series={[{ ys: FDR.ias, cls: "trace" }]}
      />
      <Chart
        title="Angle of attack"
        unit={`(the tape's ${AOA_MIN} to ${AOA_MAX})`}
        lo={AOA_MIN}
        hi={AOA_MAX}
        ticks={[-10, 0, 10, 20, 30]}
        series={[{ ys: FDR.aoa, cls: "trace" }]}
        lines={[{ v: AOA_STALL, label: `${AOA_STALL}: ${LACKLEN}'s stall` }]}
      />
      <Chart
        title="Pitch and bank"
        unit="° (pitch red, bank blue; right wing down +)"
        lo={-100}
        hi={100}
        ticks={[-90, 0, 90]}
        series={[
          { ys: FDR.bank, cls: "c5-s2" },
          { ys: FDR.pitch, cls: "trace" },
        ]}
      />
      <Chart
        title="N1, engines 1 to 4"
        unit="% (the four traces nearly coincide)"
        lo={0}
        hi={N1_MAX}
        ticks={[0, 50, 100]}
        series={FDR.n1.map((ys, k) => ({ ys, cls: `c5-n${k + 1}` }))}
      />
    </>
  );
}

// ---------------------------------------------------------------- the airplane and the sources

function Airplane() {
  const a = spec.airplane;
  const ft = (v: number) => `${Math.floor(v)} ft ${Math.round((v % 1) * 12)} in`;
  const rows: [ReactNode, ReactNode][] = [
    [
      "Lockheed C-5 Galaxy",
      `${ft(a.lengthFt)} long, ${ft(a.spanFt)} span, ${ft(a.heightFt)} high; wing ${f0(a.wingAreaSqFt)} sq ft, swept ${a.sweepDeg}°, high on the fuselage, with a T-tail (${WIKI})`,
    ],
    [
      "Engines",
      `Four ${a.engines}, numbered 1 to 4 from the left outboard as the ${ANIMATION}'s N1 columns are; the last TF39-powered C-5 flew in late 2017 (${WIKI})`,
    ],
    [
      "Slats",
      `${a.slats} on the wings' leading edges, all ${a.slats} required for flight, with a slat position indicator; with the indicator out, the slats are scanned to verify their position (${AFMAN} Table 3.5, p. 38). Their “target” pads didn't seat as they extended: the slat annunciator came on, and the flight engineer sent the scanner to look (${LACKLEN}). The ${ANIMATION} shows the extend and retract locks.`,
    ],
    [
      "Stall warning",
      `The stick shaker on the pilots' yokes. The slat malfunction disabled it: it never warned the crew of the stall (${LACKLEN}). The ${AFMAN}'s warning systems include the Stallimiter System: ${a.stallimiters} installed, “1 fully functioning system required for all departures” (Table 3.14, p. 60); with one of the two angle-of-attack de-ice systems out, the other's stallimiter must work (Table 3.2, p. 24). It doesn't describe what the system does.`,
    ],
    [
      "Flaps",
      `In percent of their travel on the ${ANIMATION}'s “% FLAP” tape: “Flaps 40” takes them from 0 to 40% between 9.4 s and about 52 s.`,
    ],
    [
      "Angle of attack",
      `The ${ANIMATION}'s tape runs from ${AOA_MIN} to ${AOA_MAX}. In the recovery the indicator showed 16, with only two degrees to work with: above 18 another stall (${LACKLEN}).`,
    ],
    [
      "Landing gear",
      `“Its high-flotation main landing gear provides ${a.wheels} wheels” (${WIKI}). The ${ANIMATION} shows the gear handle, GEAR HDL, not the gear.`,
    ],
    [
      "Training",
      `Today's C-5 crews may not practise stalls and approaches to stalls, unusual attitudes, or banks over 45° in the airplane (${AFMAN} 7.4.1, p. 87).`,
    ],
    [
      "Flight data recorder",
      `A tape recorder, as on the C-130, C-141 and E-3 (${FSM}, ${spec.recorder.date}, p. 7). The depot's standard equipment found the whole ${spec.recorder.incidentS}-second incident missing from it; the animation facility recovered all but ${spec.recorder.unrecoveredS} second and helped “determine the true cause of the incident” (pp. 8–9). The crew had first blamed wind shear (${LACKLEN}).`,
    ],
    [
      "TRT",
      `The power the copilot called for at 1:42 and 1:52; the pilot moved the throttles to near 100% N1 (${LACKLEN}). His account doesn't spell the abbreviation out.`,
    ],
  ];
  return (
    <>
      <H3>The airplane and its systems</H3>
      <Facts rows={rows} />
    </>
  );
}

function About() {
  const ac = spec.account;
  const a = (href: string, text: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  );
  return (
    <>
      <H3>Where this comes from</H3>
      <Notes
        items={[
          <>
            No investigation report is public. The record is the {ANIMATION}: the USAF Mishap Analysis Animation
            Facility&apos;s replay of the flight data with the cockpit voice recording ({a(spec.video.url, "YouTube")}),
            and the account of {ac.author}, a former C-5 pilot who sat on the crew&apos;s initial debriefing:{" "}
            {a(ac.url, `“${ac.title}”`)}, {ac.publisher}, {ac.date}. His times are this video&apos;s. The
            facility&apos;s chief wrote how it recovered the recorder&apos;s data:{" "}
            {a(spec.recorder.url, `“${spec.recorder.title}”`)}, {FSM}, {spec.recorder.date}.
          </>,
          <>
            The flight data here were read from the animation&apos;s instruments, frame by frame, five times a second,
            and checked against its digit windows; they are not the recorder&apos;s own samples, and are smoothed over
            about half a second. One second of the recorder&apos;s {spec.recorder.incidentS} was never recovered, and
            where it falls isn&apos;t said. The airspeed indicator reads no lower than {IAS_FLOOR} kt: from 1:42 to 1:57
            the airplane was that slow or slower. The animation has no vertical speed; the one here is the
            altitude&apos;s slope over {VS_WINDOW_S} s.
          </>,
          <>
            The two records differ in places, and both are given: {LACKLEN} has a 110° right bank at 2:14 where the
            animation&apos;s attitude indicator shows about 94°, 105 kt where it shows 96, and the recovery at 733 ft
            where its altimeter bottoms out at 771. The gear handle moves in the animation 2.6 s before each gear call
            is heard; whether its data lead its audio isn&apos;t known, and the replay keeps its timing.
          </>,
          <>
            {a(spec.manual.url, spec.manual.title)}, {spec.manual.date} ({AFMAN}): the C-5M&apos;s minimum equipment and
            training rules, for the slats, the Stallimiter and what crews may practise. It is today&apos;s manual, not
            1998&apos;s, whose rules may have differed.
          </>,
          <>
            The 3D view is schematic: the C-5&apos;s length, span, height, wing area, sweep and wing sections are {WIKI}
            &apos;s, the number of slats the {AFMAN}&apos;s, the rest is drawn to look right. The flaps&apos; angle at
            each percent and how long the gear and slats take to move aren&apos;t in these sources: the gear is drawn
            moving over {GEAR_TRANSIT_S} s, and the slats&apos; shortfall while neither lock holds is exaggerated to be
            seen. The trail is the airspeed and heading through a wind fitted to the animation, held where its top view
            shows the island (to 1:10) and the runway (from 2:18); between, it is approximate. It was night; the view is
            lit to be seen.
          </>,
          <>
            Not shown: the animation&apos;s normal acceleration (about 2 g in the pull-out, partly legible) and one
            parameter it doesn&apos;t name. More:{" "}
            {a("https://blog.apstraining.com/resources/c5-galaxy-diego-garcia", "APS Training")},{" "}
            {a("https://en.wikipedia.org/wiki/Lockheed_C-5_Galaxy", "Lockheed C-5 Galaxy (Wikipedia)")}.
          </>,
        ]}
      />
    </>
  );
}

function Panel() {
  return (
    <div className="panel-inner">
      <ComponentIntro label="Flight data replay" source={`${ANIMATION} · ${LACKLEN}, ${spec.account.date}`}>
        <p className="lead">{spec.lead}</p>
      </ComponentIntro>
      <Video />
      <Timeline />
      <Transcript />
      <Charts />
      <Airplane />
      <About />
    </div>
  );
}

const TOGGLES = [
  ["labels", "Labels", "Name the parts and the engines' N1"],
  ["trail", "Trail", "Draw the path flown (fitted to the animation, approximate)"],
  ["path", "Flight path", "Show which way the airplane is moving, against where its nose points"],
  ["cloud", "Cloud base", "Show the cloud base at 1,500 ft"],
  ...(TILES_KEY
    ? ([
        ["terrain", "Terrain", "Show Diego Garcia in 3D (Google), placed by the animation's view of the runway"],
      ] as const)
    : []),
] as const;

/** The data providers of the 3D tiles in view, which must be shown with them. */
function TilesCredit() {
  const on = useC5View((x) => x.terrain);
  const credit = useTerrain((x) => (x.state === "shown" ? x.credit : ""));
  if (!on || !TILES_KEY || !credit) return null;
  return <div className="c5-credit">{credit}</div>;
}

export default function C5App() {
  useReplayLoop();
  const view = useC5View();
  return (
    <FdrShell
      id={spec.id}
      scene={
        <>
          <Scene />
          <TilesCredit />
        </>
      }
      toolbar={<ViewToggles items={TOGGLES} view={view} set={view.set} />}
      foot={<Foot />}
      panel={<Panel />}
    />
  );
}
