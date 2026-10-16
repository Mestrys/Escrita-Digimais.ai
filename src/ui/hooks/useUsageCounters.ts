import { useCallback, useEffect, useMemo, useState } from 'react';
import { effectiveUsageMode, exportCounters, UsageRecorder } from '../../application/usage-counters';
import type { UsagePolicy } from '../../application/usage-counters';
import type { AppStorage } from '../../infrastructure/storage';

/**
 * Contadores de uso opcionais (só números, sem conteúdo): gravação serializada, total mostrado nas configurações,
 * exportação e zeragem. Respeita a política da organização (desligado, opcional ou ligado).
 */
export function useUsageCounters(store: AppStorage, policy: UsagePolicy, userOptIn: boolean) {
  const recorder = useMemo(
    () => new UsageRecorder({ load: () => store.loadCounters(), save: (c) => store.saveCounters(c) }),
    [store],
  );
  const mode = effectiveUsageMode(policy, userOptIn);
  useEffect(() => recorder.setEnabled(mode.enabled), [recorder, mode.enabled]);
  const [total, setTotal] = useState(0);

  const refreshTotal = useCallback(async (): Promise<void> => {
    const snap = await recorder.snapshot();
    setTotal(Object.values(snap.counts).reduce((a, b) => a + b, 0));
  }, [recorder]);

  const exportFile = useCallback(async (): Promise<void> => {
    const blob = new Blob([exportCounters(await recorder.snapshot())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contadores-de-uso.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [recorder]);

  const reset = useCallback(async (): Promise<void> => {
    await recorder.snapshot();
    await store.resetCounters();
    setTotal(0);
  }, [recorder, store]);

  return { recorder, mode, total, refreshTotal, exportFile, reset };
}
