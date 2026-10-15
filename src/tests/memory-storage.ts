import type { StorageArea } from '../infrastructure/storage';

export class MemoryArea implements StorageArea {
  data: Record<string, unknown> = {};
  constructor(initial: Record<string, unknown> = {}) {
    this.data = structuredClone(initial);
  }
  async get(keys?: string | string[] | null): Promise<Record<string, unknown>> {
    if (keys == null) return structuredClone(this.data);
    const list = Array.isArray(keys) ? keys : [keys];
    const out: Record<string, unknown> = {};
    for (const k of list) if (k in this.data) out[k] = structuredClone(this.data[k]);
    return out;
  }
  async set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.data, structuredClone(items));
  }
  async remove(keys: string | string[]): Promise<void> {
    for (const k of Array.isArray(keys) ? keys : [keys]) delete this.data[k];
  }
}
