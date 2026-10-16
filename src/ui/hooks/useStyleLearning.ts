import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emptyStats, exportLearning, StyleLearner } from '../../application/style-learning';
import type { LearnedStats } from '../../application/style-learning';
import type { UsagePolicy } from '../../application/usage-counters';
import type { AppStorage } from '../../infrastructure/storage';
import type { GenerationResult } from '../../domain/types';

/**
 * Aprendizado local de preferência de redação (só contagens inteiras, opt-in, zerável). Desligado quando a política
 * da organização proíbe contadores locais. Guarda também as redações mostradas na última geração e qual geração já
 * foi contada como "mantida", para não contar a mesma cópia duas vezes.
 */
export function useStyleLearning(store: AppStorage, userOptIn: boolean, usagePolicy: UsagePolicy) {
  const enabled = userOptIn && usagePolicy !== 'off';
  const locked = usagePolicy === 'off';
  const learner = useMemo(
    () => new StyleLearner({ load: () => store.loadLearning(), save: (s) => store.saveLearning(s) }),
    [store],
  );
  useEffect(() => learner.setEnabled(enabled), [learner, enabled]);

  const [stats, setStats] = useState<LearnedStats>(emptyStats);
  const shownChoices = useRef<GenerationResult['choices']>(undefined);
  const acceptedAt = useRef(0);

  const remember = useCallback(
    (events: Parameters<StyleLearner['record']>[0]): void => {
      void learner.record(events).then(() => learner.snapshot()).then(setStats);
    },
    [learner],
  );
  const rememberFixes = useCallback(
    (fixes: Parameters<StyleLearner['recordFixes']>[0]): void => {
      void learner.recordFixes(fixes).then(() => learner.snapshot()).then(setStats);
    },
    [learner],
  );
  const reset = useCallback(async (): Promise<void> => {
    await learner.snapshot();
    await store.resetLearning();
    setStats(emptyStats());
  }, [learner, store]);

  /** Redações da geração anterior, para saber o que mudou quando o analista pede outra variação. */
  const previousShown = useCallback((): GenerationResult['choices'] => shownChoices.current, []);
  const setShown = useCallback((choices: GenerationResult['choices']): void => {
    shownChoices.current = choices;
  }, []);
  /** Conta a geração como "mantida" uma única vez, mesmo que o texto seja copiado várias vezes. */
  const acceptOnce = useCallback(
    (generationId: number, events: () => Parameters<StyleLearner['record']>[0]): void => {
      if (acceptedAt.current === generationId) return;
      acceptedAt.current = generationId;
      remember(events());
    },
    [remember],
  );

  const exportFile = useCallback(async (): Promise<void> => {
    const blob = new Blob([exportLearning(await learner.snapshot())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aprendizado-de-redacao.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [learner]);

  const total = Object.values(stats.counts).reduce((a, b) => a + b, 0);
  return { enabled, locked, stats, setStats, total, previousShown, setShown, acceptOnce, remember, rememberFixes, reset, exportFile };
}
