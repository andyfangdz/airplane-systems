"use client";
/**
 * The replay's state. Where it is in the video and the airplane there are one mutable `replay`, read by the scene in
 * `useFrame` and by React through `useLiveSnapshot`; whether it plays and whether the video is loaded are in a zustand
 * store. Once the YouTube player is ready its clock is the replay's: the cockpit audio and the airplane stay in step
 * however the reader plays, pauses or seeks, in the page or in the player. Without it the replay runs silently on the
 * page's own clock.
 */
import { create } from "zustand";
import { clamp } from "@/lib/math";
import { refreshLiveSnapshot } from "@/lib/useLiveSnapshot";
import { DURATION, newFrame, sample, type Frame } from "@/fdr/c5-diego-garcia/model";
import { C5_DIEGO_GARCIA } from "@/fdr/c5-diego-garcia/spec";
import { createViewStore, useSimLoop } from "@/components/engine/sim";
import { PLAYING, type YTPlayer } from "./youtube";

export const spec = C5_DIEGO_GARCIA;

export interface Replay {
  /** Seconds into the video. */
  t: number;
  /** The airplane at `t`. */
  f: Frame;
}

/** The one replay, kept across remounts. */
export const replay: Replay = { t: 0, f: sample(0, newFrame()) };

/** `off`: not asked for; `loading`; `ready`: the player drives the replay; `error`: it didn't load or won't play here. */
export type VideoState = "off" | "loading" | "ready" | "error";

export const useReplay = create<{ playing: boolean; video: VideoState }>(() => ({ playing: false, video: "off" }));

/** `trail` draws the path, `path` the direction of flight, `cloud` the cloud base, `terrain` the island and `labels`
 * names the parts. `follow` turns the view with the airplane's heading; off, the view stays lined up with runway 31
 * and only moves with the airplane, which turns in it. */
export const useC5View = createViewStore({
  labels: true,
  trail: true,
  path: true,
  cloud: true,
  terrain: true,
  follow: true,
});

/** The Google Maps API key the 3D tiles need; without one the sea stands in for the island. */
export const TILES_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/** The island's 3D tiles: `loading` until the first arrives, `shown`, or `failed` when they won't load (offline, say);
 * `credit` names the data providers of the tiles in view. */
export const useTerrain = create<{ state: "loading" | "shown" | "failed"; credit: string }>(() => ({
  state: "loading",
  credit: "",
}));

let player: YTPlayer | null = null;
/**
 * The player has been played, so its clock is the replay's. Until then the replay keeps its own place: a player
 * that hasn't started reports no useful time, and seeking it would start it.
 */
let synced = false;

function moveTo(t: number) {
  replay.t = clamp(t, 0, DURATION);
  sample(replay.t, replay.f);
}

/** Go to `t` seconds into the video: the player too, when it's loaded. */
export function seek(t: number) {
  moveTo(t);
  if (player && synced) player.seekTo(replay.t, true);
  refreshLiveSnapshot(replay);
}

export function play() {
  if (replay.t >= DURATION - 0.05) seek(0);
  if (!player) return useReplay.setState({ playing: true });
  // the player's state change reports the playing, and from then its time is the replay's
  if (!synced) player.seekTo(replay.t, true);
  player.playVideo();
}

export function pause() {
  if (player) player.pauseVideo();
  else useReplay.setState({ playing: false });
}

export const togglePlay = () => (useReplay.getState().playing ? pause() : play());

export function videoLoading() {
  useReplay.setState({ video: "loading" });
}

/** The player is ready: it takes over from where the replay is, playing on if the replay was. */
export function attachPlayer(p: YTPlayer) {
  const playing = useReplay.getState().playing;
  player = p;
  synced = false;
  useReplay.setState({ video: "ready", playing: false });
  if (playing) play();
}

/** The player's state changed, from the page or its own controls (played there, it takes over the clock). */
export function playerState(state: number) {
  if (!player) return;
  if (state === PLAYING) synced = true;
  useReplay.setState({ playing: state === PLAYING });
}

/** The player failed or went: the page's clock takes over, stopped where the video was. */
export function detachPlayer(error = false) {
  player = null;
  synced = false;
  useReplay.setState({ playing: false, video: error ? "error" : "off" });
}

/** Each animation frame: the player's time, or the page's clock while it plays. */
export function advance(dt: number) {
  if (player) {
    if (!synced) return;
    const t = player.getCurrentTime();
    if (Number.isFinite(t) && t !== replay.t) moveTo(t);
    return;
  }
  if (!useReplay.getState().playing) return;
  moveTo(replay.t + dt);
  if (replay.t >= DURATION) useReplay.setState({ playing: false });
}

/** Run the replay on animation frames while the page is mounted. */
export const useReplayLoop = () => useSimLoop(advance);
