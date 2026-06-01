const baseUrl = process.env.PHASE07_BASE_URL ?? 'http://127.0.0.1:4000';
const iterationCount = Number(process.env.PHASE07_ITERATIONS ?? 5);
const maxHealthMs = Number(process.env.PHASE07_HEALTH_THRESHOLD_MS ?? 250);
const maxSessionMs = Number(process.env.PHASE07_SESSION_THRESHOLD_MS ?? 400);

async function measure(path) {
  const durations = [];

  for (let index = 0; index < iterationCount; index += 1) {
    const start = performance.now();
    const response = await fetch(`${baseUrl}${path}`);
    const end = performance.now();

    if (!response.ok) {
      throw new Error(`Expected ${path} to return 2xx, received ${response.status}.`);
    }

    durations.push(Number((end - start).toFixed(2)));
  }

  return durations;
}

function summarize(durations) {
  const sorted = [...durations].sort((left, right) => left - right);
  const average = sorted.reduce((total, value) => total + value, 0) / sorted.length;
  const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);

  return {
    minMs: sorted[0],
    avgMs: Number(average.toFixed(2)),
    p95Ms: sorted[p95Index],
    maxMs: sorted[sorted.length - 1],
  };
}

const healthSummary = summarize(await measure('/api/health'));
const sessionSummary = summarize(await measure('/api/auth/session'));

const report = {
  baseUrl,
  iterationCount,
  benchmarks: {
    health: healthSummary,
    session: sessionSummary,
  },
};

if (healthSummary.p95Ms > maxHealthMs) {
  throw new Error(`Health benchmark failed: p95 ${healthSummary.p95Ms}ms exceeded ${maxHealthMs}ms.`);
}

if (sessionSummary.p95Ms > maxSessionMs) {
  throw new Error(`Session benchmark failed: p95 ${sessionSummary.p95Ms}ms exceeded ${maxSessionMs}ms.`);
}

console.log(JSON.stringify(report, null, 2));