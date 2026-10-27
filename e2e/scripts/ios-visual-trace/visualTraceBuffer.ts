export type VisualTraceIdentity = {
  sourceSHA: string;
  pid: number;
  simulatorUDID: string;
};

export function createVisualTraceBuffer(environment: {
  wallTimeMs(): number;
  monotonicMs(): number;
  schedule(callback: () => void): void;
  emit(record: object): void;
}) {
  let identity: VisualTraceIdentity | undefined;
  let sequence = 0;
  let pending: object[] = [];
  let scheduled = false;
  let overflow = false;

  function record(phase: string, details: object = {}) {
    if (!identity) return;
    const entry = {
      ...details,
      version: 1,
      phase,
      ...identity,
      sequence: ++sequence,
      wallTimeMs: environment.wallTimeMs(),
      monotonicMs: environment.monotonicMs(),
    };
    if (pending.length < 1024) pending.push(entry);
    else if (!overflow) {
      overflow = true;
      pending.push({ ...entry, phase: "buffer.overflow" });
    }
    if (!scheduled) {
      scheduled = true;
      environment.schedule(() => {
        const batch = pending;
        pending = [];
        scheduled = false;
        overflow = false;
        for (const item of batch) environment.emit(item);
      });
    }
  }

  return {
    enabled: () => identity !== undefined,
    configure(requested: boolean, next: VisualTraceIdentity) {
      if (!requested || identity) return;
      identity = { ...next };
      record("installed", { buffered: true });
    },
    record,
  };
}
