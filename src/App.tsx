import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Badge,
  Card,
  DateRangePicker,
  DateRangePickerItem,
  Grid,
  Metric,
  Text,
  Title,
  type DateRangePickerValue,
} from "@tremor/react";
import { format, startOfYear, subDays, subHours } from "date-fns";
import {
  computeStats,
  downsample,
  filterByRange,
  latestKnown,
  loadSamples,
  type Sample,
} from "./lib/data";

const DATA_URL = `${import.meta.env.BASE_URL}data/viewers.csv`;
const VIDEO_URL = "https://www.youtube.com/watch?v=MH0_mPt-VXE";
const MAX_POINTS = 600;
const REFRESH_MS = 120_000;

const numberFmt = (n: number) => n.toLocaleString("en-US");
const metricFmt = (n: number | null) => (n === null ? "—" : numberFmt(n));

function labelFor(t: number, spanDays: number): string {
  const d = new Date(t);
  if (spanDays <= 2) return format(d, "HH:mm");
  if (spanDays <= 31) return format(d, "MMM d HH:mm");
  return format(d, "MMM d");
}

export default function App() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRangePickerValue>(() => ({
    from: subHours(new Date(), 24),
    to: new Date(),
    selectValue: "24h",
  }));

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await loadSamples(DATA_URL);
        if (!cancelled) {
          setSamples(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const filtered = useMemo(
    () => filterByRange(samples, range.from, range.to),
    [samples, range.from, range.to]
  );
  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const liveNow = useMemo(() => latestKnown(samples), [samples]);

  const chartData = useMemo(() => {
    const spanMs =
      (range.to?.getTime() ?? Date.now()) -
      (range.from?.getTime() ?? filtered[0]?.t ?? Date.now());
    const spanDays = spanMs / 86_400_000;
    return downsample(filtered, MAX_POINTS).map((s) => ({
      time: labelFor(s.t, spanDays),
      Viewers: s.v,
    }));
  }, [filtered, range.from, range.to]);

  const lastUpdated =
    samples.length > 0 ? new Date(samples[samples.length - 1].t) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-tremor-content-strong dark:text-dark-tremor-content-strong">
      <header className="border-b border-slate-800 px-6 py-5">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Badge color="red">● LIVE</Badge>
            <div>
              <Title className="text-slate-50">MSY New Orleans LIVE 24/7</Title>
              <Text className="text-slate-400">
                Concurrent YouTube viewers ·{" "}
                <a
                  href={VIDEO_URL}
                  target="_blank"
                  rel="noopener"
                  className="text-blue-400 hover:underline"
                >
                  watch the stream
                </a>
              </Text>
            </div>
          </div>
          <Text className="text-slate-500">
            {lastUpdated
              ? `${numberFmt(samples.length)} samples · updated ${lastUpdated.toLocaleString()}`
              : "No data yet"}
          </Text>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {error && (
          <Card className="mb-6 border-red-900 bg-red-950/40">
            <Text className="text-red-300">Failed to load data: {error}</Text>
          </Card>
        )}

        <div className="mb-6 flex items-center justify-between gap-3">
          <Text className="text-slate-400">Time window</Text>
          <DateRangePicker
            value={range}
            onValueChange={setRange}
            enableYearNavigation
            className="max-w-md"
            selectPlaceholder="Presets"
          >
            <DateRangePickerItem value="6h" from={subHours(new Date(), 6)} to={new Date()}>
              Last 6 hours
            </DateRangePickerItem>
            <DateRangePickerItem value="24h" from={subHours(new Date(), 24)} to={new Date()}>
              Last 24 hours
            </DateRangePickerItem>
            <DateRangePickerItem value="7d" from={subDays(new Date(), 7)} to={new Date()}>
              Last 7 days
            </DateRangePickerItem>
            <DateRangePickerItem value="30d" from={subDays(new Date(), 30)} to={new Date()}>
              Last 30 days
            </DateRangePickerItem>
            <DateRangePickerItem value="ytd" from={startOfYear(new Date())} to={new Date()}>
              Year to date
            </DateRangePickerItem>
          </DateRangePicker>
        </div>

        <Grid numItemsSm={2} numItemsLg={4} className="mb-6 gap-6">
          <Card decoration="top" decorationColor="blue">
            <Text>Current (live)</Text>
            <Metric className="text-blue-400">{metricFmt(liveNow?.v ?? null)}</Metric>
            {liveNow && (
              <Text className="text-slate-500">
                as of {new Date(liveNow.t).toLocaleTimeString()}
              </Text>
            )}
          </Card>
          <Card>
            <Text>Peak (range)</Text>
            <Metric>{metricFmt(stats.peak)}</Metric>
          </Card>
          <Card>
            <Text>Low (range)</Text>
            <Metric>{metricFmt(stats.low)}</Metric>
          </Card>
          <Card>
            <Text>Average (range)</Text>
            <Metric>{metricFmt(stats.avg)}</Metric>
          </Card>
        </Grid>

        <Card>
          <Title>Viewers over time</Title>
          <Text className="text-slate-400">
            {filtered.length > 0
              ? `${numberFmt(filtered.length)} samples in range`
              : loading
                ? "Loading…"
                : "No samples in this range yet"}
          </Text>
          <AreaChart
            className="mt-4 h-96"
            data={chartData}
            index="time"
            categories={["Viewers"]}
            colors={["blue"]}
            valueFormatter={numberFmt}
            connectNulls={false}
            showLegend={false}
            yAxisWidth={56}
            curveType="monotone"
            noDataText="No data to display for this range."
          />
        </Card>

        <Text className="mt-6 text-center text-slate-600">
          Data committed to this repo by GitHub Actions every ~5 minutes.
        </Text>
      </main>
    </div>
  );
}
