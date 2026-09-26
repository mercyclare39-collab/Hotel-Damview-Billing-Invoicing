import { useState, useEffect, useCallback } from 'react';
import {
  propagationVarianceService,
  DocumentVarianceInfo,
} from '../services/propagationVarianceService';
import { BillingDocument } from '../types';

export function usePropagationVariances() {
  const [variances, setVariances] = useState<Record<string, DocumentVarianceInfo>>({});
  const [autoResolveEnabled, setAutoResolveEnabledState] = useState<boolean>(() =>
    propagationVarianceService.isAutoResolveEnabled()
  );

  useEffect(() => {
    const unsubscribe = propagationVarianceService.subscribe((v) => {
      setVariances({ ...v });
    });
    return () => unsubscribe();
  }, []);

  const hasVariance = useCallback(
    (documentNumber?: string): boolean => {
      if (!documentNumber) return false;
      return propagationVarianceService.hasVariance(documentNumber);
    },
    []
  );

  const getVariance = useCallback(
    (documentNumber?: string): DocumentVarianceInfo | null => {
      if (!documentNumber) return null;
      return propagationVarianceService.getVariance(documentNumber);
    },
    []
  );

  const autoResolveDocument = useCallback(
    async (doc: BillingDocument, remoteDoc?: BillingDocument | null) => {
      return await propagationVarianceService.executeAutoResolve(doc, remoteDoc);
    },
    []
  );

  const autoResolveAll = useCallback(async (documents: BillingDocument[]) => {
    return await propagationVarianceService.autoResolveAll(documents);
  }, []);

  const setAutoResolve = useCallback((enabled: boolean) => {
    propagationVarianceService.setAutoResolveEnabled(enabled);
    setAutoResolveEnabledState(enabled);
  }, []);

  const activeVariancesCount = Object.keys(variances).length;

  return {
    variances,
    activeVariancesCount,
    hasVariance,
    getVariance,
    autoResolveDocument,
    autoResolveAll,
    autoResolveEnabled,
    setAutoResolve,
  };
}
