"use client";
import { refreshLiveSnapshot, useLiveSnapshot } from "@/lib/useLiveSnapshot";
import { useView } from "@/lib/view";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Slider, Small } from "@/components/ui/controls";
import { BRS_CAM, BRS_END, RELEASE_T } from "../brs";
import { live } from "../model";
import { CAT } from "../parts";
import { resetBrs, startBrs, useC182 } from "../store";
import { SYS } from "../systems";

const IM = "BRS-182 Installation Manual 9005-IM Rev C (12/2/2004)";

/** The optional BRS-182 whole-airplane parachute (STC SA01999CH): the option, the deployment and the installation notes. */
export function Brs() {
  const snapshot = useLiveSnapshot(live, 100);
  const update = useC182((x) => x.update),
    flyTo = useView((x) => x.flyTo);
  const { installed, deployed } = useC182((x) => x.s.brs);
  const home = () => {
    const [p, t] = SYS.find((d) => d.id === "brs")!.cam;
    flyTo(p, t);
  };
  return (
    <>
      <p className="lead">
        Optional equipment, not part of the POH: Ballistic Recovery Systems&apos; BRS-182 parachute, installed under STC
        SA01999CH. A solid-propellant rocket pulls a 2,400 sq. ft. round canopy out of a canister in the baggage
        compartment, through the rear window; a four-point Kevlar harness carries the airplane, which comes down at
        about ten degrees nose down.
      </p>
      <Ctl>
        <Check
          id="brsInstalled"
          label="BRS-182 parachute installed (STC)"
          checked={installed}
          onChange={(v) => {
            if (!v && deployed) resetBrs();
            update((d) => {
              d.brs.installed = v;
            });
            refreshLiveSnapshot(live);
          }}
        />
      </Ctl>
      {!installed && (
        <Small>
          Not installed on this configuration (the default). Whether a particular airplane has it is in its own
          equipment list and supplements. Tick the option to add the canister, rocket, harness and activation handle to
          the model and try a deployment.
        </Small>
      )}
      {installed && (
        <>
          <H3>Deployment sequence</H3>
          <Ctl>
            <BtnRow>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  startBrs();
                  refreshLiveSnapshot(live);
                }}
              >
                Pull the handle
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (!deployed) startBrs();
                  else live.brsPlaying = !live.brsPlaying;
                  refreshLiveSnapshot(live);
                }}
              >
                Pause / play
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  resetBrs();
                  refreshLiveSnapshot(live);
                  home();
                }}
              >
                Reset
              </button>
            </BtnRow>
            <Slider
              id="brsT"
              label="Timeline"
              min={0}
              max={BRS_END}
              step={0.05}
              value={Math.max(0, snapshot.brsT)}
              onChange={(v) => {
                if (!deployed) {
                  update((d) => {
                    d.brs.deployed = true;
                  });
                  flyTo(...BRS_CAM);
                }
                live.brsT = v;
                live.brsPlaying = false;
                refreshLiveSnapshot(live);
              }}
              fmt={(v) => "T+" + v.toFixed(1) + " s"}
            />
          </Ctl>
          <Facts
            rows={[
              ["Handle", "Cover off, then pull out with at least 40 lb; the first few inches take up cable slack"],
              ["Rocket", "Penetrates the rear window and extracts the parachute away from the airplane"],
              ["Front straps", "Peeled away from the top skin"],
              ["Rear straps", "Extracted from inside the airplane; the short section limits pitch"],
              ["Line cutter", `8 s fuse from extraction, then the short section releases (shown at T+${RELEASE_T} s)`],
              ["Touchdown attitude", "Approximately 10° nose down"],
            ]}
          />
          <Small>
            {IM}, pp. 1-3 – 1-5. The manual gives the order of events, the eight-second fuse and the touchdown attitude;
            the other times, the nose-low angle on the short rear section and the inflation rate are illustrative. No
            BRS-182 descent rate was found, so none is shown.
          </Small>
        </>
      )}
      <H3>Installation</H3>
      <Notes
        items={[
          "Canister: aluminum, standing upright in the baggage compartment (IM Fig. 1), with a vacuum-formed ABS plastic cover that breaks away on activation. Inside: the pressure-packed canopy in its deployment bag, the rocket lanyards and the rear attachment harness (IM p. 1-1).",
          "Rocket: a BRS-900 solid-propellant motor aft of the canister under a fiberglass shield (an installer's photographs show it standing upright), fired by a mechanical percussion igniter that needs no electrical power and is unarmed normally (IM pp. 1-1, 1-5 – 1-7).",
          "Harness: four woven Kevlar straps. The two front straps run through a slot in the rear window and across the top skin, under a fiberglass fairing, to the front wing attachment points; the two rear straps, stowed in the baggage area, attach to a custom rear attachment assembly on the aft cabin structure, drawn as a crossbar between a plate on each side wall (IM p. 1-2, Fig. 3).",
          "Rear harness: the shorter section is held by a ring-and-link release cut by the line cutter; the longer section is folded and stitched so the stitching peels to absorb shock (IM pp. 1-3 – 1-4).",
          "Activation: the handle is in a protective fiberglass box on the floor between and slightly forward of the pilot and copilot, joined to the igniter by a stainless-steel cable in a Teflon-lined housing under the carpet (IM p. 1-5).",
          "Canopy: 2,400 sq. ft. round, non-steerable, with an annular slider that reefs it to limit inflation loads; all textiles Kevlar or nylon (IM pp. 1-1, 1-10).",
        ]}
      />
      <Small>
        Model positions follow the manual&apos;s drawings and an installer&apos;s photographs; nothing is dimensioned,
        so sizes, the canister&apos;s place in the baggage area, the rocket and rear attachment positions and the strap
        and cable routes are approximate.
      </Small>
      <H3>Applicability</H3>
      <Facts
        rows={[
          ["STC", "SA01999CH, Ballistic Recovery Systems, Inc. (South St. Paul, MN)"],
          ["Models", "182G – 182T, T182 and T182T: the 182T is listed (FAA AD 2008-02-18)"],
          ["G1000", "The AD's model list names no avionics; 2007 G1000 182T sale listings include the BRS-182"],
          ["AD 2008-02-18", "Replace the pick-up collar support and its two screws (BRS SB 07-02), within 25 h"],
        ]}
      />
      <H3>Not modelled: the AFM supplement</H3>
      <Notes
        items={[
          "The BRS-182 AFM/POH supplement could not be found, so its limitations, deployment procedure (engine, fuel, electrical, seat and door steps), minimum altitude, placard wording and preflight items are not given here. Use the supplement in the airplane.",
          "AOPA (2017) quotes BRS: a maximum deployment speed of 133 knots with no other flight-envelope restriction, 85 lb added to a 182, a 10-year repack and line cutters replaced every five years. These are secondary and not from the supplement; an installer quotes about 70 lb added, and Aircraft Spruce lists a six-year repack for BRS canisters generally.",
        ]}
      />
      <PartsList cat={CAT} sys="brs" />
      <Caution title="Warning">
        “The BRS-182 Parachute Canister must not be opened by anyone other than authorized factory personnel” ({IM}, p.
        1-8). The rocket exits through the rear window.
      </Caution>
    </>
  );
}
