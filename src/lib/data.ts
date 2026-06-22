export interface Sample {
  /** Unix timestamp in milliseconds. */
  t: number;
  /** Concurrent viewers, or null when the stream was offline / count hidden. */
  v: number | null;
}

/** Fetch and parse the committed CSV of `unix_seconds,viewers` rows. */
export async function loadSamples(url: string): Promise<Sample[]> {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n");
  const out: Sample[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [ts, raw] = line.split(",");
    const secs = parseInt(ts, 10);
    if (Number.isNaN(secs)) continue;
    let v: number | null = null;
    if (raw !== undefined && raw !== "") {
      const n = parseInt(raw, 10);
      v = Number.isNaN(n) ? null : n;
    }
    out.push({ t: secs * 1000, v });
  }
  return out;
}

export function filterByRange(
  samples: Sample[],
  from?: Date,
  to?: Date
): Sample[] {
  const lo = from ? from.getTime() : -Infinity;
  const hi = to ? to.getTime() : Infinity;
  return samples.filter((s) => s.t >= lo && s.t <= hi);
}

/** Even-stride downsample so the chart stays fast on large ranges. */
export function downsample(samples: Sample[], max: number): Sample[] {
  if (samples.length <= max) return samples;
  const stride = Math.ceil(samples.length / max);
  const out: Sample[] = [];
  for (let i = 0; i < samples.length; i += stride) out.push(samples[i]);
  const last = samples[samples.length - 1];
  if (out[out.length - 1]?.t !== last.t) out.push(last);
  return out;
}

export interface Stats {
  current: number | null;
  peak: number | null;
  low: number | null;
  avg: number | null;
}

export function computeStats(samples: Sample[]): Stats {
  const valid = samples
    .map((s) => s.v)
    .filter((v): v is number => v !== null);
  if (valid.length === 0) {
    return { current: null, peak: null, low: null, avg: null };
  }
  let current: number | null = null;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (samples[i].v !== null) {
      current = samples[i].v;
      break;
    }
  }
  return {
    current,
    peak: Math.max(...valid),
    low: Math.min(...valid),
    avg: Math.round(valid.reduce((a, b) => a + b, 0) / valid.length),
  };
}

/** Most recent sample with a real value, across the entire dataset. */
export function latestKnown(samples: Sample[]): Sample | null {
  for (let i = samples.length - 1; i >= 0; i--) {
    if (samples[i].v !== null) return samples[i];
  }
  return null;
}
