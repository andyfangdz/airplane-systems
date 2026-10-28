/**
 * The Diego Garcia replay's clock: the page's own while there's no video, and the YouTube player's once it has played,
 * so the cockpit audio and the airplane stay in step however the reader plays, pauses or seeks.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  advance,
  attachPlayer,
  detachPlayer,
  pause,
  play,
  playerState,
  replay,
  seek,
  togglePlay,
  useReplay,
} from "@/components/fdr/c5-diego-garcia/store";
import { PLAYING, type YTPlayer } from "@/components/fdr/c5-diego-garcia/youtube";
import { DURATION } from "@/fdr/c5-diego-garcia/model";

const PAUSED = 2;

/** The page shows the replay through low-rate samples; a refresh publishes it at once. */
const refreshed = vi.hoisted(() => vi.fn());
vi.mock("@/lib/useLiveSnapshot", async (actual) => ({
  ...(await actual<typeof import("@/lib/useLiveSnapshot")>()),
  refreshLiveSnapshot: refreshed,
}));

/** A player that does what it's told and remembers it; its time is whatever the test sets. */
function fakePlayer() {
  const calls: string[] = [];
  const p = {
    time: 0,
    state: -1,
    calls,
    playVideo: () => calls.push("play"),
    pauseVideo: () => calls.push("pause"),
    seekTo: (t: number) => {
      calls.push(`seek ${t}`);
      p.time = t;
    },
    getCurrentTime: () => p.time,
    getPlayerState: () => p.state,
    destroy: () => {},
  };
  return p satisfies YTPlayer;
}

beforeEach(() => {
  detachPlayer();
  useReplay.setState({ playing: false, video: "off" });
  seek(0);
});

describe("without the video", () => {
  test("the page's clock runs the replay while it plays", () => {
    seek(100);
    advance(1);
    expect(replay.t).toBe(100);
    play();
    advance(0.5);
    expect(replay.t).toBeCloseTo(100.5, 9);
    expect(replay.f.t).toBeCloseTo(100.5, 9);
    pause();
    advance(1);
    expect(replay.t).toBeCloseTo(100.5, 9);
  });

  test("it stops at the end and plays again from the start", () => {
    seek(DURATION - 0.2);
    togglePlay();
    advance(1);
    expect(replay.t).toBe(DURATION);
    expect(useReplay.getState().playing).toBe(false);
    togglePlay();
    expect(replay.t).toBe(0);
    expect(useReplay.getState().playing).toBe(true);
  });

  test("paused, the page shows where it stopped at once, not at its next sample", () => {
    play();
    advance(1.96);
    refreshed.mockClear();
    pause();
    expect(refreshed).toHaveBeenCalledWith(replay);
    expect(replay.t).toBeCloseTo(1.96, 9);
  });

  test("seeking moves the airplane", () => {
    seek(126);
    expect(replay.f.bank).toBeLessThan(-85);
    seek(-5);
    expect(replay.t).toBe(0);
  });
});

describe("with the video", () => {
  test("a loaded player keeps the replay's place until it plays, then drives it", () => {
    seek(60);
    const p = fakePlayer();
    attachPlayer(p);
    expect(useReplay.getState()).toMatchObject({ video: "ready", playing: false });
    // seeking an unstarted player would start it: the replay moves alone
    seek(70);
    expect(p.calls).toEqual([]);
    advance(1);
    expect(replay.t).toBe(70);
    // play: the player goes to the replay's place first
    play();
    expect(p.calls).toEqual(["seek 70", "play"]);
    playerState(PLAYING);
    expect(useReplay.getState().playing).toBe(true);
    p.time = 72.5;
    advance(0.016);
    expect(replay.t).toBe(72.5);
    // now seeking moves the player too
    seek(126);
    expect(p.time).toBe(126);
    pause();
    expect(p.calls.at(-1)).toBe("pause");
    playerState(PAUSED);
    expect(useReplay.getState().playing).toBe(false);
  });

  test("the replay was playing when the player became ready: the player takes over from there", () => {
    seek(30);
    play();
    advance(2);
    const p = fakePlayer();
    attachPlayer(p);
    expect(p.calls).toEqual(["seek 32", "play"]);
  });

  test("played from its own controls, the player's time is the replay's", () => {
    const p = fakePlayer();
    attachPlayer(p);
    p.time = 140;
    playerState(PLAYING);
    advance(0.016);
    expect(replay.t).toBe(140);
    expect(replay.f.alt).toBeLessThan(1500);
  });

  test("paused in the player, the replay stops where the video did and shows it at once", () => {
    const p = fakePlayer();
    attachPlayer(p);
    play();
    playerState(PLAYING);
    p.time = 60;
    advance(0.016);
    p.time = 60.2;
    refreshed.mockClear();
    playerState(PAUSED);
    expect(replay.t).toBe(60.2);
    expect(refreshed).toHaveBeenCalledWith(replay);
    expect(useReplay.getState().playing).toBe(false);
  });

  test("a failed player hands back to the page's clock, stopped where the video was", () => {
    const p = fakePlayer();
    attachPlayer(p);
    play();
    playerState(PLAYING);
    p.time = 50;
    advance(0.016);
    detachPlayer(true);
    expect(useReplay.getState()).toMatchObject({ video: "error", playing: false });
    expect(replay.t).toBe(50);
    play();
    advance(1);
    expect(replay.t).toBeCloseTo(51, 9);
  });
});
