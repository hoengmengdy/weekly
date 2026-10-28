import {useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent} from 'react';
import type {PlayerRef} from '@remotion/player';
import {FPS, getStepAtFrame, narration} from './narration';
import audioMetadata from './audio-metadata.json';

// The Player owns the only media clock. No speechSynthesis or independent audio
// timer is started by frame events, so seeking and pausing cannot stack voices.
export const useNarrationControls = () => {
  const playerRef = useRef<PlayerRef>(null);
  const manualRef = useRef<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [automatic, setAutomatic] = useState(true);
  const [manualStepId, setManualStepId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [checking, setChecking] = useState<string[]>(narration.map((step) => step.stepId));
  const [playbackRate, setPlaybackRate] = useState(1);

  const setManual = useCallback((id: string | null) => {
    manualRef.current = id;
    setManualStepId(id);
  }, []);
  const onAudioError = useCallback((id: string) => {
    setUnavailable((ids) => ids.includes(id) ? ids : [...ids, id]);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Cache the static assets once. A missing MP3 must not bring down the video
    // or fall back to a browser's English voice.
    for (const step of narration) {
      fetch(step.audioUrl, {signal: controller.signal}).then(async (response) => {
        if (!response.ok || response.headers.get('content-type')?.includes('text/html')
          || (await response.arrayBuffer()).byteLength === 0) throw new Error('Missing Khmer audio');
      }).catch(() => {
        if (!controller.signal.aborted) onAudioError(step.stepId);
      }).finally(() => {
        if (!controller.signal.aborted) setChecking((ids) => ids.filter((id) => id !== step.stepId));
      });
    }
    return () => controller.abort();
  }, [onAudioError]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const update = ({detail: {frame: next}}: {detail: {frame: number}}) => {
      setFrame(next);
      // Clear an isolated request when the user seeks into another chapter.
      // No play() call here: repeated frame/time events never restart narration.
      if (manualRef.current && getStepAtFrame(next).stepId !== manualRef.current) setManual(null);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {setPlaying(false); setManual(null);};
    const onWaiting = () => setLoading(true);
    const onResume = () => setLoading(false);
    const onError = ({detail}: {detail: {error: Error}}) => {
      setLoading(false); setPlaying(false); setError(detail.error.message);
    };
    const updateSound = () => setSoundEnabledState(!player.isMuted() && player.getVolume() > 0);
    const updateRate = ({detail}: {detail: {playbackRate: number}}) => setPlaybackRate(detail.playbackRate);
    player.addEventListener('frameupdate', update);
    player.addEventListener('seeked', update);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnded);
    player.addEventListener('waiting', onWaiting);
    player.addEventListener('resume', onResume);
    player.addEventListener('error', onError);
    player.addEventListener('mutechange', updateSound);
    player.addEventListener('volumechange', updateSound);
    player.addEventListener('ratechange', updateRate);
    return () => {
      player.removeEventListener('frameupdate', update);
      player.removeEventListener('seeked', update);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnded);
      player.removeEventListener('waiting', onWaiting);
      player.removeEventListener('resume', onResume);
      player.removeEventListener('error', onError);
      player.removeEventListener('mutechange', updateSound);
      player.removeEventListener('volumechange', updateSound);
      player.removeEventListener('ratechange', updateRate);
    };
  }, [setManual]);

  const setSoundEnabled = (enabled: boolean) => {
    const player = playerRef.current;
    if (enabled) {
      player?.unmute();
      if (player?.getVolume() === 0) player.setVolume(1);
    } else player?.mute();
    setSoundEnabledState(enabled);
  };
  const play = (event?: SyntheticEvent) => {
    try {playerRef.current?.play(event); setError(null);}
    catch {setError('សូមចុចប៊ូតុងចាក់វីដេអូ ដើម្បីអនុញ្ញាតឱ្យ browser ចាក់សំឡេង។');}
  };
  const navigate = (id: string, event?: SyntheticEvent, listen = false) => {
    const step = narration.find((item) => item.stepId === id);
    const player = playerRef.current;
    if (!step || !player) return;
    player.pause();
    setManual(null);
    player.seekTo(step.startTime * FPS);
    // Set after seekTo, which emits a synchronous seek event.
    if (listen) {setManual(id); setSoundEnabled(true);}
    setFrame(step.startTime * FPS);
    play(event);
  };
  const toggleAutomatic = (enabled: boolean) => {
    setAutomatic(enabled);
    setManual(null);
    if (enabled) setSoundEnabled(true);
  };
  const currentStep = getStepAtFrame(frame);
  const audioDuration = (audioMetadata as Record<string, {duration: number}>)[currentStep.stepId]?.duration ?? 0;
  const isolatedStep = !automatic && manualStepId
    ? narration.find((step) => step.stepId === manualStepId) : undefined;
  const narrationOptions = useMemo(() => ({automatic, manualStepId, unavailable, onError: onAudioError}),
    [automatic, manualStepId, unavailable, onAudioError]);
  return {
    playerRef, frame, currentStep, automatic, soundEnabled, playing, loading, error,
    unavailable, checking, playbackRate, setPlaybackRate, setSoundEnabled,
    narrationOptions, toggleAutomatic, play, navigate,
    outFrame: isolatedStep ? isolatedStep.endTime * FPS - 1 : undefined,
    audible: soundEnabled && (automatic || manualStepId === currentStep.stepId)
      && !unavailable.includes(currentStep.stepId),
    speaking: frame / FPS - currentStep.startTime < audioDuration && !loading,
  };
};
