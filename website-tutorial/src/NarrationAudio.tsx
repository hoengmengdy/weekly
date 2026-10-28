import {createContext, useContext, useCallback, useMemo} from 'react';
import {Audio} from '@remotion/media';
import {staticFile, useVideoConfig} from 'remotion';
import {narration} from './narration';

export type NarrationOptions = {
  automatic: boolean;
  manualStepId: string | null;
  unavailable: string[];
  onError?: (stepId: string) => void;
};
export const defaultNarrationOptions: NarrationOptions = {
  automatic: true, manualStepId: null, unavailable: [],
};
export const NarrationContext = createContext(defaultNarrationOptions);

export const NarrationAudio = ({stepId}: {stepId: string}) => {
  const {fps} = useVideoConfig();
  const options = useContext(NarrationContext);
  const reportError = options.onError;
  const handleError = useCallback(() => {
    reportError?.(stepId);
    return 'fallback' as const;
  }, [reportError, stepId]);
  const fallbackProps = useMemo(() => ({
    preservePitch: true,
    onError: reportError ? () => reportError(stepId) : undefined,
  }), [reportError, stepId]);
  const step = narration.find((item) => item.stepId === stepId);
  if (!step) throw new Error(`Narration data is missing for ${stepId}`);
  if (options.unavailable.includes(stepId)
    || (!options.automatic && options.manualStepId !== stepId)) return null;
  return <Audio
    name="Khmer narration"
    src={staticFile(step.audioUrl)}
    premountFor={fps}
    preservePitch
    onError={reportError ? handleError : undefined}
    fallbackHtml5AudioProps={fallbackProps}
  />;
};
