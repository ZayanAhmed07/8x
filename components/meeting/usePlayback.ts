"use client";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * One playback clock for the meeting page.
 * With a recording, the <video> or <audio> element is the source of truth.
 * Without one (sample meetings are transcript-only), a timer advances through the transcript.
 */
export function usePlayback(durationMs: number, video: RefObject<HTMLMediaElement | null>, hasVideo: boolean, initialMs = 0) {
  const [currentMs, setCurrentMs] = useState(initialMs);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const currentRef = useRef(initialMs);
  const stopAtRef = useRef<number | null>(null);

  const update = useCallback((ms: number) => {
    currentRef.current = ms;
    setCurrentMs(ms);
  }, []);

  const pause = useCallback(() => {
    stopAtRef.current = null;
    if (hasVideo) video.current?.pause();
    setPlaying(false);
  }, [hasVideo, video]);

  const play = useCallback(() => {
    if (currentRef.current >= durationMs - 250) update(0);
    if (hasVideo) void video.current?.play();
    setPlaying(true);
  }, [durationMs, hasVideo, update, video]);

  const seek = useCallback((ms: number) => {
    const clamped = Math.min(Math.max(0, ms), durationMs);
    if (hasVideo && video.current) video.current.currentTime = clamped / 1000;
    update(clamped);
  }, [durationMs, hasVideo, update, video]);

  /** Play a range and stop at its end, for clips and receipts. */
  const playRange = useCallback((startMs: number, endMs: number) => {
    seek(startMs);
    stopAtRef.current = endMs;
    if (hasVideo) void video.current?.play();
    setPlaying(true);
  }, [hasVideo, seek, video]);

  const setRate = useCallback((next: number) => {
    if (video.current) video.current.playbackRate = next;
    setRateState(next);
  }, [video]);

  // Transcript clock.
  useEffect(() => {
    if (hasVideo || !playing) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const next = Math.min(currentRef.current + (now - last) * rate, durationMs);
      last = now;
      update(next);
      if (next >= durationMs) setPlaying(false);
    }, 100);
    return () => window.clearInterval(id);
  }, [durationMs, hasVideo, playing, rate, update]);

  // Stop at the end of a clip.
  useEffect(() => {
    if (stopAtRef.current !== null && currentMs >= stopAtRef.current) pause();
  }, [currentMs, pause]);

  const videoProps = {
    onTimeUpdate: (event: React.SyntheticEvent<HTMLMediaElement>) => update(event.currentTarget.currentTime * 1000),
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false)
  };

  return { currentMs, playing, rate, play, pause, toggle: () => (playing ? pause() : play()), seek, playRange, setRate, videoProps };
}
