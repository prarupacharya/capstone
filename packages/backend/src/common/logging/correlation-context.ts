import { AsyncLocalStorage } from "node:async_hooks";

const correlationStorage = new AsyncLocalStorage<string>();
export const systemCorrelationId = "system";

export function runWithCorrelationId<T>(correlationId: string, callback: () => T) {
  return correlationStorage.run(correlationId, callback);
}

export function getCorrelationId(fallback?: string) {
  return correlationStorage.getStore()?.trim() || fallback?.trim() || systemCorrelationId;
}
