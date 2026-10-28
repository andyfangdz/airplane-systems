"use client";
/**
 * The YouTube IFrame Player API, loaded only when the reader asks for the video (nothing is fetched from YouTube
 * before): the few calls the replay uses, typed here rather than through a package.
 */

/** YT.PlayerState. */
export const PLAYING = 1;

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const API = "https://www.youtube.com/iframe_api";
/** The player's own pages come from YouTube's privacy-enhanced host. */
export const HOST = "https://www.youtube-nocookie.com";

let loading: Promise<YTNamespace> | null = null;

/** The API, loading its script once; rejects if it hasn't come in 20 s (blocked, or offline). */
export function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loading ??= new Promise<YTNamespace>((resolve, reject) => {
    const before = window.onYouTubeIframeAPIReady;
    const timer = setTimeout(() => {
      loading = null;
      reject(new Error("The YouTube player didn't load"));
    }, 20_000);
    window.onYouTubeIframeAPIReady = () => {
      before?.();
      clearTimeout(timer);
      if (window.YT?.Player) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = API;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      loading = null;
      script.remove();
      reject(new Error("The YouTube player didn't load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}
