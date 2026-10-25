"use client";
import { ComponentIntro } from "../ComponentIntro";
/** The SureFly page's side panel: the dip switch, installing and timing the SIM, running it, and the documents. */
import {
  BtnRow,
  Caution,
  Check,
  Facts,
  H3,
  HoldButton,
  Notes,
  Readouts,
  Seg,
  Slider,
  Small,
} from "@/components/ui/controls";
import { f0 } from "@/lib/format";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import {
  ADVANCE_SHAPE,
  dipFor,
  ENGINES,
  LED_WINDOW,
  ledCodeText,
  MAX_ADVANCE,
  readDip,
  START_RPM,
  SUPPLY,
  SYNC_TOLERANCE,
  type Dip,
  type Mode,
} from "@/engines/components/surefly/model";
import { AMBIENT, bench, CLOCK_RANGE, CRANK_RPM, syncError, useUi, type Stage } from "./store";

function DipSwitch() {
  const dip = useUi((x) => x.dip),
    engineId = useUi((x) => x.engine),
    set = useUi((x) => x.set);
  const engine = ENGINES.find((e) => e.id === engineId)!;
  const { mode, timing } = readDip(dip);
  const flip = (i: number) => set({ dip: dip.map((on, j) => (j === i ? !on : on)) as Dip });
  return (
    <>
      <H3>Dip switch</H3>
      <Seg
        id="sf-engine"
        label="Engine data plate"
        options={ENGINES.map((e): [string, string] => [e.id, `${e.name.replace("Lycoming ", "")} · ${e.timing}°`])}
        value={engineId}
        onChange={(v) => set({ engine: v })}
      />
      <div className="sf-dip" role="group" aria-label="Dip switches 1 to 4">
        {dip.map((on, i) => (
          <button
            key={i}
            type="button"
            className={`sf-sw${on ? " on" : ""}`}
            aria-pressed={on}
            aria-label={`Switch ${i + 1} ${on ? "ON" : "OFF"}`}
            onClick={() => flip(i)}
          >
            <span className="knob" />
            <b>{i + 1}</b>
          </button>
        ))}
        <div className="sf-dip-read">
          <b>
            {timing}° {mode}
          </b>
          <span>
            LED code <code>{ledCodeText(dip)}</code>
          </span>
        </div>
      </div>
      <Small>
        ON is up toward the shaft. Switch 1 picks the mode (OFF advance, ON fixed); 2–4 pick the timing. The LED blinks
        one flash per switch, short for ON and long for OFF (SF1001 §2.7).
      </Small>
      <BtnRow>
        {(["advance", "fixed"] as Mode[]).map((m) => (
          <button key={m} type="button" className="btn" onClick={() => set({ dip: dipFor(engine.timing, m) })}>
            Set {engine.timing}° {m}
          </button>
        ))}
      </BtnRow>
      {timing !== engine.timing && (
        <Caution title="Doesn't match the data plate">
          The switch is set for {timing}°; the {engine.name} plate says {engine.timing}° ({engine.ref}).
        </Caution>
      )}
    </>
  );
}

function Timing() {
  const u = useUi();
  const b = useLiveSnapshot(bench, 100);
  const err = syncError(u);
  const mount = () =>
    // the gear meshes where it is: the shaft keeps its angle from internal TDC
    u.set({ mounted: true, clock: 0, mesh: (((u.gear - u.hand) % 360) + 360) % 360 });
  return (
    <>
      <H3>Install and time</H3>
      <Small>
        Unlike a magneto, the SIM is timed to #1 compression top centre (0°); it sets its own advance from the dip
        switch (SF1001 §1.1). With power on the TIMING terminal its LED is green and goes out over a {LED_WINDOW}°
        window at internal TDC (§2.9).
      </Small>
      <div className="eng-checks">
        <Check
          id="sf-tpower"
          label="Power on TIMING terminal"
          checked={u.timingPower}
          onChange={(v) => u.set({ timingPower: v })}
        />
        <Check id="sf-plead" label="P-lead grounded" checked={!u.ignition} onChange={(v) => u.set({ ignition: !v })} />
      </div>
      {!u.mounted ? (
        <>
          <Slider
            id="sf-gear"
            label="1. Turn the drive gear slowly until the LED goes out"
            min={0}
            max={360}
            step={0.1}
            value={u.gear}
            onChange={(v) => u.set({ gear: v })}
            fmt={(v) => `${v.toFixed(1)}°`}
          />
          <Slider
            id="sf-hand"
            label="2. Engine at #1 compression TDC"
            min={0}
            max={720}
            step={0.5}
            value={u.hand}
            onChange={(v) => u.set({ hand: v })}
            fmt={(v) => `${v.toFixed(1)}° after #1 TDC`}
          />
          <BtnRow>
            <button type="button" className="btn" onClick={mount}>
              3. Mount on the engine
            </button>
          </BtnRow>
        </>
      ) : (
        <>
          <Slider
            id="sf-clock"
            label="Clock the SIM in its ear slots"
            min={-CLOCK_RANGE}
            max={CLOCK_RANGE}
            step={0.1}
            value={u.clock}
            onChange={(v) => u.set({ clock: v })}
            fmt={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}°`}
          />
          <Slider
            id="sf-hand"
            label="Turn the engine by hand (timing check)"
            min={0}
            max={720}
            step={0.1}
            value={u.hand}
            onChange={(v) => u.set({ hand: v })}
            fmt={(v) => `${v.toFixed(1)}° after #1 TDC`}
          />
          <Readouts
            items={[
              ["LED goes out at", `${err > 0 ? err.toFixed(1) + "° after" : (-err).toFixed(1) + "° before"} #1 TDC`],
              [
                "Timing check",
                Math.abs(err) <= SYNC_TOLERANCE ? "In sync" : [`Out by more than ${SYNC_TOLERANCE}°: re-clock`, "bad"],
              ],
            ]}
          />
          <BtnRow>
            <button type="button" className="btn" onClick={() => u.set({ mounted: false })}>
              Remove the SIM
            </button>
          </BtnRow>
          <Small>
            Mount with the engine at #1 TDC and the LED out, then clock the SIM to keep it out and torque the nuts.
            Check by turning the engine back ⅛ turn and slowly forward: the LED must go out within {SYNC_TOLERANCE}° of
            #1 TDC (SF1001 §2.10–2.11). If it can't be found, the gear may have skipped a tooth, or needs turning 180°
            on the shaft (§2.6).
          </Small>
        </>
      )}
      {!u.ignition && b.led === false && u.timingPower && (
        <Small>The LED won't light while the p-lead is grounded (SF1001 §2.9 e).</Small>
      )}
    </>
  );
}

function Run() {
  const u = useUi();
  const { mode } = readDip(u.dip);
  return (
    <>
      <H3>Run</H3>
      {!u.mounted && <Small>The SIM is off the engine: mount and time it under Install and time first.</Small>}
      <div className="eng-mags">
        <Seg
          id="sf-ign"
          label="Ignition switch"
          options={[
            ["off", "Off (p-lead grounded)"],
            ["on", "On"],
          ]}
          value={u.ignition ? "on" : "off"}
          onChange={(v) => u.set({ ignition: v === "on" })}
        />
        <HoldButton
          className={`btn eng-start${u.cranking ? " on" : ""}`}
          title={`Hold to crank at about ${CRANK_RPM} rpm: below ${START_RPM} rpm the SIM fires at top centre`}
          onDown={() => u.set({ cranking: true })}
          onUp={() => u.set({ cranking: false })}
        >
          Hold to crank
        </HoldButton>
      </div>
      <Small>Switching on with power blinks the dip switch code 4 times, then the LED goes out (SF1001 §3.3).</Small>
      <Slider
        id="sf-rpm"
        label="Engine speed"
        min={0}
        max={2800}
        step={10}
        value={u.rpm}
        onChange={(v) => u.set({ rpm: v })}
        fmt={(v) => `${f0(v)} rpm`}
      />
      <Slider
        id="sf-map"
        label="Manifold pressure"
        min={10}
        max={AMBIENT}
        step={0.1}
        value={u.map}
        onChange={(v) => u.set({ map: v })}
        fmt={(v) => `${v.toFixed(1)} inHg`}
      />
      <Slider
        id="sf-volts"
        label="Supply"
        min={0}
        max={SUPPLY.max}
        step={0.1}
        value={u.volts}
        onChange={(v) => u.set({ volts: v })}
        fmt={(v) => `${v.toFixed(1)} V${v < SUPPLY.min ? ": too low" : ""}`}
      />
      <div className="eng-checks">
        <Check id="sf-hose" label="MAP hose connected" checked={u.hose} onChange={(v) => u.set({ hose: v })} />
        <Check id="sf-fault" label="Internal fault" checked={u.fault} onChange={(v) => u.set({ fault: v })} />
      </div>
      {mode === "advance" && !u.hose && (
        <Caution title="Advance mode needs the MAP hose">
          SF1001 §2.14: advance mode requires a manifold pressure connection. With the port open the SIM reads ambient
          pressure, as if at full throttle.
        </Caution>
      )}
      {u.fault && (
        <Caution title="LED blinking 12 times a second">
          Stop and contact SureFly (SF1001 §3.3 g). The page shows the indication only; SureFly doesn't say what the
          spark does then.
        </Caution>
      )}
      {mode === "advance" && (
        <Small>
          Advance mode only on a normally aspirated engine with CHT monitoring, on 100LL; otherwise fixed (SF1001 §1.2).
        </Small>
      )}
    </>
  );
}

export function SureFlyPanel() {
  const stage = useUi((x) => x.stage),
    set = useUi((x) => x.set);
  return (
    <div className="panel-inner">
      <ComponentIntro source="SureFly SF1001 Rev B">
        <p className="lead">
          The SureFly SIM4P replaces a four-cylinder magneto with an electronic module: it fires from #1 top centre at
          the timing its dip switch selects, and in advance mode adds advance at part power from rpm and manifold
          pressure.
        </p>
      </ComponentIntro>
      <Seg<Stage>
        id="sf-stage"
        label="Bench"
        options={[
          ["run", "Run"],
          ["time", "Install and time"],
        ]}
        value={stage}
        onChange={(v) => set(v === "time" ? { stage: v, cranking: false } : { stage: v, timingPower: true })}
      />
      <DipSwitch />
      {stage === "time" ? <Timing /> : <Run />}
      <H3>SureFly SIM4P</H3>
      <Facts
        rows={[
          [
            "Replaces",
            "A four-cylinder impulse-coupled magneto; existing drive gear, plugs and a “Slick” style harness",
          ],
          ["Modes", `Advance (RPM and MAP, up to ${MAX_ADVANCE}° BTDC) or fixed (data-plate timing)`],
          ["Starting", "Spark retarded to TDC with full spark energy"],
          ["Supply", `${SUPPLY.min}–${SUPPLY.max} VDC, constant; 600 mA average at 2,700 rpm`],
          ["Spark", "45 mJ, wasted spark; plugs gapped .022–.035"],
          ["Sensors", "Hall-effect speed and position; MAP 5–45 inHg; 0–3,500 rpm"],
          ["Weight, life", "4.4 lb; 2,400 hours, no interval inspections"],
        ]}
      />
      <Small>
        SureFly SIM4P Installation Instructions SF1001 Rev B and SureFly's tech page; see
        engines/components/surefly/SOURCES.md.
      </Small>
      <H3>How the model works</H3>
      <Notes
        items={[
          <>
            The SIM fires each cylinder at its compression top centre less the timing, and its partner on exhaust at the
            same moment (a wasted spark: 1 with 2, 3 with 4 for the 1-3-2-4 order). Bright flashes are the working
            sparks, dim ones the wasted.
          </>,
          <>
            SureFly sets the advance map at the factory and doesn't publish it. The curve here is illustrative: no extra
            advance at {ADVANCE_SHAPE.mapStart} inHg and above, rising to {MAX_ADVANCE}° at {ADVANCE_SHAPE.mapFull} inHg
            and {ADVANCE_SHAPE.rpmFull.toLocaleString("en-US")} rpm, none below{" "}
            {ADVANCE_SHAPE.rpmStart.toLocaleString("en-US")} rpm. Only the {MAX_ADVANCE}° ceiling and its inputs are
            documented.
          </>,
          <>
            Assumed too: TDC firing below {START_RPM} rpm, the cranking speed, the LED's blink lengths, no spark below{" "}
            {SUPPLY.min} V, and the 3D unit's shapes and internals.
          </>,
        ]}
      />
    </div>
  );
}
