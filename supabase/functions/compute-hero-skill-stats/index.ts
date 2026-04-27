// Supabase Edge Function: compute-hero-skill-stats
// Computes g-formula hero impact from global match data and writes results
// to the global_hero_skill_stats table. Triggered hourly by pg_cron or manually.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Linear algebra & logistic regression ────────────────────────────────────

function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function matVec(X: number[][], v: number[]): number[] {
  return X.map((row) => dot(row, v));
}

function transpose(X: number[][]): number[][] {
  const n = X.length;
  const p = X[0].length;
  const T: number[][] = Array.from({ length: p }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < p; j++) T[j][i] = X[i][j];
  return T;
}

function xtWx(X: number[][], W: number[]): number[][] {
  const Xt = transpose(X);
  const p = Xt.length;
  const result: number[][] = Array.from({ length: p }, () =>
    new Array(p).fill(0)
  );
  for (let i = 0; i < p; i++)
    for (let j = 0; j < p; j++) {
      let s = 0;
      for (let k = 0; k < W.length; k++) s += Xt[i][k] * W[k] * X[k][j];
      result[i][j] = s;
    }
  return result;
}

function gaussianSolve(A: number[][], b: number[]): number[] {
  const n = A.length;
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > maxVal) {
        maxVal = Math.abs(A[row][col]);
        maxRow = row;
      }
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    [b[col], b[maxRow]] = [b[maxRow], b[col]];
    if (Math.abs(A[col][col]) < 1e-14) continue;
    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col];
      for (let k = col; k < n; k++) A[row][k] -= factor * A[col][k];
      b[row] -= factor * b[col];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(A[i][i]) < 1e-14) {
      x[i] = 0;
      continue;
    }
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  return x;
}

interface LogisticModel {
  coefficients: number[];
}

function fitLogisticRegression(
  X: number[][],
  y: number[],
  maxIter = 50,
  tol = 1e-6,
  l2Lambda = 1e-6
): LogisticModel {
  const p = X[0].length;
  let beta = new Array(p).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    const eta = matVec(X, beta);
    const mu = eta.map(sigmoid);
    const W = mu.map((m) => {
      const v = m * (1 - m);
      return v < 1e-10 ? 1e-10 : v;
    });
    const z = eta.map((e, i) => e + (y[i] - mu[i]) / W[i]);
    const XTWX = xtWx(X, W);
    for (let i = 0; i < p; i++) XTWX[i][i] += l2Lambda;
    const Wz = W.map((w, i) => w * z[i]);
    const Xt = transpose(X);
    const rhs = Xt.map((row) => dot(row, Wz));
    const newBeta = gaussianSolve(
      XTWX.map((row) => [...row]),
      [...rhs]
    );
    let maxDelta = 0;
    for (let i = 0; i < p; i++) {
      const d = Math.abs(newBeta[i] - beta[i]);
      if (d > maxDelta) maxDelta = d;
    }
    beta = newBeta;
    if (maxDelta < tol) return { coefficients: beta };
  }
  return { coefficients: beta };
}

// ─── G-formula computation ───────────────────────────────────────────────────

interface TeamObservation {
  matchId: string;
  heroIds: number[];
  teamMu: number;
  oppMu: number;
  won: boolean;
  victoryType?: string;
}

function buildRow(
  treatment: number,
  teamMu: number,
  oppMu: number
): number[] {
  return [1, treatment, teamMu, oppMu, treatment * teamMu, treatment * oppMu];
}

function computeAteForHero(
  heroId: number,
  observations: TeamObservation[]
): number | null {
  const treated = observations.filter((o) => o.heroIds.includes(heroId));
  const untreated = observations.filter((o) => !o.heroIds.includes(heroId));
  if (treated.length < 3 || untreated.length < 3) return null;

  const X = observations.map((o) =>
    buildRow(o.heroIds.includes(heroId) ? 1 : 0, o.teamMu, o.oppMu)
  );
  const y = observations.map((o) => (o.won ? 1 : 0));
  const model = fitLogisticRegression(X, y);

  const X1 = observations.map((o) => buildRow(1, o.teamMu, o.oppMu));
  const X0 = observations.map((o) => buildRow(0, o.teamMu, o.oppMu));
  const p1 = matVec(X1, model.coefficients).map(sigmoid);
  const p0 = matVec(X0, model.coefficients).map(sigmoid);
  return p1.reduce((sum, p, i) => sum + (p - p0[i]), 0) / observations.length;
}

function bootstrapAte(
  heroId: number,
  observations: TeamObservation[],
  nResamples = 50
): [number, number] | null {
  const matchToRows = new Map<string, number[]>();
  observations.forEach((o, i) => {
    const arr = matchToRows.get(o.matchId) ?? [];
    arr.push(i);
    matchToRows.set(o.matchId, arr);
  });
  const matchIds = Array.from(matchToRows.keys());
  const ateValues: number[] = [];

  for (let b = 0; b < nResamples; b++) {
    const sampledRows: number[] = [];
    for (let i = 0; i < matchIds.length; i++) {
      const mId = matchIds[Math.floor(Math.random() * matchIds.length)];
      for (const r of matchToRows.get(mId)!) sampledRows.push(r);
    }
    const ate = computeAteForHero(
      heroId,
      sampledRows.map((r) => observations[r])
    );
    if (ate !== null) ateValues.push(ate);
  }
  if (ateValues.length < 10) return null;
  ateValues.sort((a, b) => a - b);
  return [
    ateValues[Math.floor(ateValues.length * 0.025)],
    ateValues[Math.floor(ateValues.length * 0.975)],
  ];
}

interface GradientPoint {
  percentile: number;
  ate: number;
  ciLower: number;
  ciUpper: number;
}

function computeSkillGradient(
  heroId: number,
  observations: TeamObservation[]
): GradientPoint[] {
  if (observations.length === 0) return [];
  const teamMus = observations.map((o) => o.teamMu).sort((a, b) => a - b);
  const meanOppMu =
    observations.reduce((s, o) => s + o.oppMu, 0) / observations.length;

  const percentiles = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  const thresholds = percentiles.map((p) => {
    const idx = Math.min(
      Math.floor((p / 100) * teamMus.length),
      teamMus.length - 1
    );
    return teamMus[idx];
  });

  const X = observations.map((o) =>
    buildRow(o.heroIds.includes(heroId) ? 1 : 0, o.teamMu, o.oppMu)
  );
  const y = observations.map((o) => (o.won ? 1 : 0));
  const model = fitLogisticRegression(X, y);

  const N_QUICK = 20;
  const bootstrapAtes: number[][] = thresholds.map(() => []);
  const matchToRows = new Map<string, number[]>();
  observations.forEach((o, i) => {
    const arr = matchToRows.get(o.matchId) ?? [];
    arr.push(i);
    matchToRows.set(o.matchId, arr);
  });
  const matchIds = Array.from(matchToRows.keys());

  for (let b = 0; b < N_QUICK; b++) {
    const sampledRows: number[] = [];
    for (let i = 0; i < matchIds.length; i++) {
      const mId = matchIds[Math.floor(Math.random() * matchIds.length)];
      for (const r of matchToRows.get(mId)!) sampledRows.push(r);
    }
    const sample = sampledRows.map((r) => observations[r]);
    if (sample.length === 0) continue;
    const Xs = sample.map((o) =>
      buildRow(o.heroIds.includes(heroId) ? 1 : 0, o.teamMu, o.oppMu)
    );
    const ys = sample.map((o) => (o.won ? 1 : 0));
    const bModel = fitLogisticRegression(Xs, ys);
    thresholds.forEach((threshold, ti) => {
      const p1 = sigmoid(
        dot(bModel.coefficients, buildRow(1, threshold, meanOppMu))
      );
      const p0 = sigmoid(
        dot(bModel.coefficients, buildRow(0, threshold, meanOppMu))
      );
      bootstrapAtes[ti].push(p1 - p0);
    });
  }

  return thresholds.map((threshold, ti) => {
    const p1 = sigmoid(
      dot(model.coefficients, buildRow(1, threshold, meanOppMu))
    );
    const p0 = sigmoid(
      dot(model.coefficients, buildRow(0, threshold, meanOppMu))
    );
    const ate = p1 - p0;
    const bAtes = bootstrapAtes[ti].sort((a, b) => a - b);
    let ciLower = ate;
    let ciUpper = ate;
    if (bAtes.length >= 10) {
      ciLower = bAtes[Math.floor(bAtes.length * 0.025)];
      ciUpper = bAtes[Math.floor(bAtes.length * 0.975)];
    }
    return { percentile: percentiles[ti], ate, ciLower, ciUpper };
  });
}

function assignGradientBadge(
  gradient: GradientPoint[]
): string {
  if (gradient.length < 2) return "balanced";
  const first = gradient[0];
  const last = gradient[gradient.length - 1];
  const delta = last.ate - first.ate;
  const ciOverlap =
    last.ciLower <= first.ciUpper && first.ciLower <= last.ciUpper;
  if (ciOverlap || Math.abs(delta) < 0.05) return "balanced";
  if (delta > 0) return "rewards-skill";
  return "beginner-friendly";
}

const VICTORY_TYPES = ["throne", "wave", "kills"] as const;
const BADGE_MAP: Record<string, string> = {
  throne: "pusher",
  wave: "control",
  kills: "assassin",
};

function computeVictoryProfile(
  heroId: number,
  observations: TeamObservation[]
): { profile: { type: string; heroRate: number; baselineRate: number; impact: number }[]; badge: string | null } {
  const wins = observations.filter(
    (o) => o.won && o.victoryType !== undefined
  );
  const heroWins = wins.filter((o) => o.heroIds.includes(heroId));
  const profile = VICTORY_TYPES.map((type) => {
    const baselineRate =
      wins.length > 0
        ? wins.filter((o) => o.victoryType === type).length / wins.length
        : 0;
    const heroRate =
      heroWins.length > 0
        ? heroWins.filter((o) => o.victoryType === type).length /
          heroWins.length
        : 0;
    return { type, heroRate, baselineRate, impact: heroRate - baselineRate };
  });
  let badge: string | null = null;
  let maxDelta = 0.03;
  for (const entry of profile) {
    if (entry.impact > maxDelta) {
      maxDelta = entry.impact;
      badge = BADGE_MAP[entry.type];
    }
  }
  return { profile, badge };
}

// ─── Data fetching & main handler ────────────────────────────────────────────

interface MatchRow {
  match_id: string;
  winning_team: string;
  hero_id: number;
  hero_name: string;
  team: string;
  player_mu: number;
}

function buildObservations(rows: MatchRow[]): {
  observations: TeamObservation[];
  heroMeta: Map<number, string>;
} {
  // Group rows by match_id + team
  const matchTeamMap = new Map<
    string,
    { heroIds: number[]; mus: number[]; winningTeam: string; team: string; matchId: string }
  >();

  for (const row of rows) {
    const key = `${row.match_id}::${row.team}`;
    let entry = matchTeamMap.get(key);
    if (!entry) {
      entry = {
        heroIds: [],
        mus: [],
        winningTeam: row.winning_team,
        team: row.team,
        matchId: row.match_id,
      };
      matchTeamMap.set(key, entry);
    }
    entry.heroIds.push(row.hero_id);
    entry.mus.push(row.player_mu);
  }

  // Build team mu lookup per match
  const matchTeamMu = new Map<string, number>();
  for (const [key, entry] of matchTeamMap) {
    const avgMu =
      entry.mus.reduce((a, b) => a + b, 0) / entry.mus.length;
    matchTeamMu.set(key, avgMu);
  }

  const observations: TeamObservation[] = [];
  const heroMeta = new Map<number, string>();

  for (const row of rows) {
    if (!heroMeta.has(row.hero_id)) heroMeta.set(row.hero_id, row.hero_name);
  }

  for (const [_key, entry] of matchTeamMap) {
    const oppTeam =
      entry.team === "titans" ? "atlanteans" : "titans";
    const teamMuKey = `${entry.matchId}::${entry.team}`;
    const oppMuKey = `${entry.matchId}::${oppTeam}`;
    const teamMu = matchTeamMu.get(teamMuKey) ?? 25;
    const oppMu = matchTeamMu.get(oppMuKey) ?? 25;

    observations.push({
      matchId: entry.matchId,
      heroIds: entry.heroIds,
      teamMu,
      oppMu,
      won: entry.team === entry.winningTeam,
    });
  }

  return { observations, heroMeta };
}

Deno.serve(async (req) => {
  // Only allow POST (or GET for manual trigger)
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify authorization
  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    console.log("Fetching match data...");
    const { data: rows, error: fetchError } = await supabase
      .rpc("get_hero_skill_match_data");

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ message: "No match data available", heroes: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${rows.length} match-player rows...`);
    const { observations, heroMeta } = buildObservations(rows as MatchRow[]);
    console.log(
      `Built ${observations.length} team observations for ${heroMeta.size} heroes`
    );

    const results: {
      hero_id: number;
      hero_name: string;
      ate: number;
      ci_lower: number;
      ci_upper: number;
      games_with_hero: number;
      gradient: GradientPoint[];
      gradient_badge: string;
      victory_profile: { type: string; hero_rate: number; baseline_rate: number; impact: number }[];
      win_style_badge: string | null;
      sufficient: boolean;
      computed_at: string;
    }[] = [];

    const now = new Date().toISOString();

    for (const [heroId, heroName] of heroMeta.entries()) {
      const gamesWithHero = observations.filter((o) =>
        o.heroIds.includes(heroId)
      ).length;
      if (gamesWithHero < 3) continue;
      const sufficient = gamesWithHero >= 10;
      const ate = computeAteForHero(heroId, observations) ?? 0;
      const ci = sufficient ? bootstrapAte(heroId, observations) : null;
      const ciLower = ci ? ci[0] : ate;
      const ciUpper = ci ? ci[1] : ate;
      const gradient = sufficient
        ? computeSkillGradient(heroId, observations)
        : [];
      const gradientBadge = assignGradientBadge(gradient);
      const { profile, badge: winStyleBadge } = computeVictoryProfile(
        heroId,
        observations
      );

      results.push({
        hero_id: heroId,
        hero_name: heroName,
        ate,
        ci_lower: ciLower,
        ci_upper: ciUpper,
        games_with_hero: gamesWithHero,
        gradient: gradient.map((g) => ({
          percentile: g.percentile,
          ate: g.ate,
          ci_lower: g.ciLower,
          ci_upper: g.ciUpper,
        })),
        gradient_badge: gradientBadge,
        victory_profile: profile.map((p) => ({
          type: p.type,
          hero_rate: p.heroRate,
          baseline_rate: p.baselineRate,
          impact: p.impact,
        })),
        win_style_badge: winStyleBadge,
        sufficient,
        computed_at: now,
      });

      console.log(
        `  ${heroName}: ATE=${(ate * 100).toFixed(1)}% [${(ciLower * 100).toFixed(1)}, ${(ciUpper * 100).toFixed(1)}] (${gamesWithHero} games)`
      );
    }

    // Upsert results into the table
    console.log(`Upserting ${results.length} hero skill stats...`);
    const { error: upsertError } = await supabase
      .from("global_hero_skill_stats")
      .upsert(results, { onConflict: "hero_id" });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: upsertError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Done!");
    return new Response(
      JSON.stringify({
        message: "Hero skill stats computed successfully",
        heroes: results.length,
        observations: observations.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
