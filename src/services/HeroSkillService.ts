// src/services/HeroSkillService.ts
// Pure computation module (no React dependencies) implementing the parametric
// g-formula for hero impact estimation, ported from analysis/02_hero_skill_models.py

import { DBMatch, DBMatchPlayer, DBPlayer } from './DatabaseService';
import {
  HeroImpactResult,
  GradientPoint,
  GradientBadge,
  WinStyleBadge,
  VictoryProfileEntry,
  VictoryType,
  Team,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Part 1: Linear algebra helpers and IRLS logistic regression
// ─────────────────────────────────────────────────────────────────────────────

/** Numerically stable sigmoid — handles large positive AND negative inputs. */
function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  } else {
    const e = Math.exp(z);
    return e / (1 + e);
  }
}

/** Dot product of two 1-D vectors. */
function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Matrix × vector product.
 * X is (n × p), v is length-p — returns length-n vector.
 */
function matVec(X: number[][], v: number[]): number[] {
  return X.map(row => dot(row, v));
}

/**
 * Transpose of matrix X (n × p) → (p × n).
 */
function transpose(X: number[][]): number[][] {
  const n = X.length;
  const p = X[0].length;
  const T: number[][] = Array.from({ length: p }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < p; j++)
      T[j][i] = X[i][j];
  return T;
}

/**
 * Compute X^T W X where W is a diagonal weight matrix given as a vector.
 * Returns a (p × p) matrix.
 */
function xtWx(X: number[][], W: number[]): number[][] {
  const Xt = transpose(X);
  const p = Xt.length;
  const result: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let s = 0;
      for (let k = 0; k < W.length; k++) s += Xt[i][k] * W[k] * X[k][j];
      result[i][j] = s;
    }
  }
  return result;
}

/**
 * Solve A x = b using Gaussian elimination with partial pivoting.
 * Modifies A and b in place (passed as copies by the caller).
 */
function gaussianSolve(A: number[][], b: number[]): number[] {
  const n = A.length;
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > maxVal) {
        maxVal = Math.abs(A[row][col]);
        maxRow = row;
      }
    }
    // Swap rows
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    [b[col], b[maxRow]] = [b[maxRow], b[col]];

    if (Math.abs(A[col][col]) < 1e-14) continue; // Singular — skip

    // Eliminate
    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col];
      for (let k = col; k < n; k++) A[row][k] -= factor * A[col][k];
      b[row] -= factor * b[col];
    }
  }
  // Back-substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(A[i][i]) < 1e-14) { x[i] = 0; continue; }
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  return x;
}

export interface LogisticModel {
  coefficients: number[];
  converged: boolean;
}

/**
 * Fit binary logistic regression via Iteratively Reweighted Least Squares (IRLS)
 * with L2 regularisation — matches sklearn LogisticRegression(C=1/l2Lambda).
 *
 * X: (n × p) design matrix (include intercept column as X[:,0]=1)
 * y: length-n binary outcome
 */
export function fitLogisticRegression(
  X: number[][],
  y: number[],
  maxIter = 50,
  tol = 1e-6,
  l2Lambda = 1e-6,
): LogisticModel {
  const p = X[0].length;
  let beta = new Array(p).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // mu = sigmoid(X beta)
    const eta = matVec(X, beta);
    const mu = eta.map(sigmoid);

    // W = mu * (1 - mu)  (variance weights)
    const W = mu.map(m => {
      const v = m * (1 - m);
      return v < 1e-10 ? 1e-10 : v;
    });

    // z = eta + (y - mu) / W   (working response)
    const z = eta.map((e, i) => e + (y[i] - mu[i]) / W[i]);

    // Normal equations: (X^T W X + lambda I) delta = X^T W z
    // Build A = X^T W X + lambda I
    const XTWX = xtWx(X, W);
    for (let i = 0; i < p; i++) XTWX[i][i] += l2Lambda;

    // Build rhs = X^T (W * z)
    const Wz = W.map((w, i) => w * z[i]);
    const Xt = transpose(X);
    const rhs = Xt.map(row => dot(row, Wz));

    // Solve for new beta
    const Acopy = XTWX.map(row => [...row]);
    const bCopy = [...rhs];
    const newBeta = gaussianSolve(Acopy, bCopy);

    // Check convergence
    let maxDelta = 0;
    for (let i = 0; i < p; i++) {
      const d = Math.abs(newBeta[i] - beta[i]);
      if (d > maxDelta) maxDelta = d;
    }
    beta = newBeta;
    if (maxDelta < tol) {
      return { coefficients: beta, converged: true };
    }
  }
  return { coefficients: beta, converged: false };
}

/**
 * Apply a fitted logistic model to a new feature matrix.
 * Returns predicted probabilities P(Y=1).
 */
export function predictProbability(model: LogisticModel, X: number[][]): number[] {
  return matVec(X, model.coefficients).map(sigmoid);
}

// ─────────────────────────────────────────────────────────────────────────────
// Part 2: G-formula ATE computation
// ─────────────────────────────────────────────────────────────────────────────

export interface TeamObservation {
  matchId: string;
  heroIds: number[];
  teamMu: number;
  oppMu: number;
  won: boolean;
  victoryType?: VictoryType;
}

/**
 * Build two TeamObservations per match (one per team).
 * teamMu = average TrueSkill μ of team players (default 25 if not set).
 */
export function buildTeamObservations(
  matches: DBMatch[],
  matchPlayers: DBMatchPlayer[],
  players: DBPlayer[],
): TeamObservation[] {
  const playerById = new Map<string, DBPlayer>(players.map(p => [p.id, p]));

  const observations: TeamObservation[] = [];

  for (const match of matches) {
    const mps = matchPlayers.filter(mp => mp.matchId === match.id);
    if (mps.length === 0) continue;

    const teams: Team[] = [Team.Titans, Team.Atlanteans];
    const teamMus: Record<string, number> = {};

    for (const team of teams) {
      const teamMps = mps.filter(mp => mp.team === team);
      if (teamMps.length === 0) {
        teamMus[team] = 25;
        continue;
      }
      const mus = teamMps.map(mp => {
        const p = playerById.get(mp.playerId);
        return p?.mu ?? 25;
      });
      teamMus[team] = mus.reduce((a, b) => a + b, 0) / mus.length;
    }

    for (const team of teams) {
      const teamMps = mps.filter(mp => mp.team === team);
      if (teamMps.length === 0) continue;

      const oppTeam = team === Team.Titans ? Team.Atlanteans : Team.Titans;
      const heroIds = teamMps.map(mp => mp.heroId);
      const won = match.winningTeam === team;

      observations.push({
        matchId: match.id,
        heroIds,
        teamMu: teamMus[team],
        oppMu: teamMus[oppTeam],
        won,
        victoryType: match.victoryType,
      });
    }
  }

  return observations;
}

/**
 * Build the saturated design matrix row for one observation.
 * Features: [1, T, L1=teamMu, L2=oppMu, T*L1, T*L2]
 */
function buildRow(treatment: number, teamMu: number, oppMu: number): number[] {
  return [1, treatment, teamMu, oppMu, treatment * teamMu, treatment * oppMu];
}

/**
 * Compute Average Treatment Effect (ATE) for a given hero using the parametric
 * g-formula: logit(Y) = β₀ + β₁T + β₂L1 + β₃L2 + β₄T*L1 + β₅T*L2
 *
 * Returns null if there are fewer than 3 treated or 3 untreated observations.
 */
export function computeAteForHero(
  heroId: number,
  observations: TeamObservation[],
): number | null {
  const treated = observations.filter(o => o.heroIds.includes(heroId));
  const untreated = observations.filter(o => !o.heroIds.includes(heroId));

  if (treated.length < 3 || untreated.length < 3) return null;

  // Build design matrix and outcome vector
  const X: number[][] = observations.map(o =>
    buildRow(o.heroIds.includes(heroId) ? 1 : 0, o.teamMu, o.oppMu),
  );
  const y: number[] = observations.map(o => (o.won ? 1 : 0));

  const model = fitLogisticRegression(X, y);

  // Counterfactual prediction: set T=1 vs T=0 for all observations
  const X1 = observations.map(o => buildRow(1, o.teamMu, o.oppMu));
  const X0 = observations.map(o => buildRow(0, o.teamMu, o.oppMu));

  const p1 = predictProbability(model, X1);
  const p0 = predictProbability(model, X0);

  const ate = p1.reduce((sum, p, i) => sum + (p - p0[i]), 0) / observations.length;
  return ate;
}

// ─────────────────────────────────────────────────────────────────────────────
// Part 3: Bootstrap CIs and skill gradient
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bootstrap ATE confidence interval via match-level resampling.
 * Returns [ciLower, ciUpper] (2.5th / 97.5th percentiles) or null if
 * fewer than 10 valid bootstrap resamples.
 */
export function bootstrapAte(
  heroId: number,
  observations: TeamObservation[],
  nResamples = 200,
): [number, number] | null {
  // Pre-build matchId → row indices map
  const matchToRows = new Map<string, number[]>();
  observations.forEach((o, i) => {
    const arr = matchToRows.get(o.matchId) ?? [];
    arr.push(i);
    matchToRows.set(o.matchId, arr);
  });
  const matchIds = Array.from(matchToRows.keys());

  const ateValues: number[] = [];

  for (let b = 0; b < nResamples; b++) {
    // Resample matches with replacement
    const sampledRows: number[] = [];
    for (let i = 0; i < matchIds.length; i++) {
      const mId = matchIds[Math.floor(Math.random() * matchIds.length)];
      const rows = matchToRows.get(mId)!;
      for (const r of rows) sampledRows.push(r);
    }
    const sample = sampledRows.map(r => observations[r]);
    const ate = computeAteForHero(heroId, sample);
    if (ate !== null) ateValues.push(ate);
  }

  if (ateValues.length < 10) return null;

  ateValues.sort((a, b) => a - b);
  const lo = ateValues[Math.floor(ateValues.length * 0.025)];
  const hi = ateValues[Math.floor(ateValues.length * 0.975)];
  return [lo, hi];
}

/**
 * Compute the skill gradient: ATE evaluated at 9 percentile points (10th–90th)
 * of the teamMu distribution, holding oppMu at its mean.
 *
 * Uses a quick 50-resample bootstrap for CI band width at each point.
 */
export function computeSkillGradient(
  heroId: number,
  observations: TeamObservation[],
): GradientPoint[] {
  if (observations.length === 0) return [];

  const teamMus = observations.map(o => o.teamMu).sort((a, b) => a - b);
  const meanOppMu = observations.reduce((s, o) => s + o.oppMu, 0) / observations.length;

  const percentiles = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  const thresholds = percentiles.map(p => {
    const idx = Math.min(
      Math.floor((p / 100) * teamMus.length),
      teamMus.length - 1,
    );
    return teamMus[idx];
  });

  // Fit the model once on the full data
  const X: number[][] = observations.map(o =>
    buildRow(o.heroIds.includes(heroId) ? 1 : 0, o.teamMu, o.oppMu),
  );
  const y: number[] = observations.map(o => (o.won ? 1 : 0));
  const model = fitLogisticRegression(X, y);

  // Quick 50-resample bootstrap for CI widths
  const N_QUICK = 50;
  const bootstrapAtes: number[][] = thresholds.map(() => []);

  // Precompute matchId → row indices for bootstrap
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
      const rows = matchToRows.get(mId)!;
      for (const r of rows) sampledRows.push(r);
    }
    const sample = sampledRows.map(r => observations[r]);
    if (sample.length === 0) continue;

    const Xs: number[][] = sample.map(o =>
      buildRow(o.heroIds.includes(heroId) ? 1 : 0, o.teamMu, o.oppMu),
    );
    const ys: number[] = sample.map(o => (o.won ? 1 : 0));
    const bModel = fitLogisticRegression(Xs, ys);

    thresholds.forEach((threshold, ti) => {
      const row1 = buildRow(1, threshold, meanOppMu);
      const row0 = buildRow(0, threshold, meanOppMu);
      const p1 = sigmoid(dot(bModel.coefficients, row1));
      const p0 = sigmoid(dot(bModel.coefficients, row0));
      bootstrapAtes[ti].push(p1 - p0);
    });
  }

  return thresholds.map((threshold, ti) => {
    const row1 = buildRow(1, threshold, meanOppMu);
    const row0 = buildRow(0, threshold, meanOppMu);
    const p1 = sigmoid(dot(model.coefficients, row1));
    const p0 = sigmoid(dot(model.coefficients, row0));
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

/**
 * Assign a gradient badge by checking whether the gradient trend is statistically
 * distinguishable from flat. Requires the CIs at the endpoints to not overlap
 * AND the absolute delta to exceed 5pp.
 */
export function assignGradientBadge(gradient: GradientPoint[]): GradientBadge {
  if (gradient.length < 3) return 'balanced';

  // Use a linear regression across all gradient points to get a robust slope,
  // rather than relying on just the noisy endpoints.
  const n = gradient.length;
  let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
  for (const pt of gradient) {
    sumX += pt.percentile;
    sumY += pt.ate;
    sumXX += pt.percentile * pt.percentile;
    sumXY += pt.percentile * pt.ate;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  // Total fitted delta across the gradient range (10th to 90th percentile = 80pp span)
  const fittedDelta = slope * 80;

  if (Math.abs(fittedDelta) < 0.05) return 'balanced';
  if (fittedDelta > 0) return 'rewards-skill';
  return 'beginner-friendly';
}

// ─────────────────────────────────────────────────────────────────────────────
// Part 4: Victory type impact and main entry point
// ─────────────────────────────────────────────────────────────────────────────

const VICTORY_TYPES: VictoryType[] = ['throne', 'wave', 'kills'];

/**
 * Compare the hero's victory-type distribution (among wins where the hero was
 * present) against the baseline (all wins with a recorded victoryType).
 *
 * Badge mapping: throne→'pusher', wave→'control', kills→'assassin'
 * — awarded when the largest positive delta exceeds 0.03.
 */
export function computeVictoryProfile(
  heroId: number,
  observations: TeamObservation[],
): { profile: VictoryProfileEntry[]; badge: WinStyleBadge | null } {
  const wins = observations.filter(o => o.won && o.victoryType !== undefined);
  const heroWins = wins.filter(o => o.heroIds.includes(heroId));

  const profile: VictoryProfileEntry[] = VICTORY_TYPES.map(type => {
    const baselineRate = wins.length > 0
      ? wins.filter(o => o.victoryType === type).length / wins.length
      : 0;
    const heroRate = heroWins.length > 0
      ? heroWins.filter(o => o.victoryType === type).length / heroWins.length
      : 0;
    return { type, heroRate, baselineRate, impact: heroRate - baselineRate };
  });

  // Assign badge if largest delta > 0.03
  const BADGE_MAP: Record<VictoryType, WinStyleBadge> = {
    throne: 'pusher',
    wave: 'control',
    kills: 'assassin',
  };

  let badge: WinStyleBadge | null = null;
  let maxDelta = 0.03; // threshold
  for (const entry of profile) {
    if (entry.impact > maxDelta) {
      maxDelta = entry.impact;
      badge = BADGE_MAP[entry.type];
    }
  }

  return { profile, badge };
}

/**
 * Main entry point.
 *
 * Builds observations, iterates all hero IDs found in data, computes:
 *   - ATE + bootstrap CIs
 *   - Skill gradient
 *   - Victory profile
 *
 * Heroes with fewer than 10 games are marked `sufficient: false`.
 */
function computeOneHero(
  heroId: number,
  heroName: string,
  observations: TeamObservation[],
): HeroImpactResult {
  const gamesWithHero = observations.filter(o => o.heroIds.includes(heroId)).length;
  const sufficient = gamesWithHero >= 10;
  const ate = computeAteForHero(heroId, observations) ?? 0;
  const ci = sufficient ? bootstrapAte(heroId, observations) : null;
  const gradient = sufficient ? computeSkillGradient(heroId, observations) : [];
  const { profile: victoryProfile, badge: winStyleBadge } = computeVictoryProfile(heroId, observations);

  return {
    heroId,
    heroName,
    ate,
    ciLower: ci ? ci[0] : ate,
    ciUpper: ci ? ci[1] : ate,
    gamesWithHero,
    gradient,
    gradientBadge: assignGradientBadge(gradient),
    victoryProfile,
    winStyleBadge,
    sufficient,
  };
}

function collectHeroMeta(matchPlayers: DBMatchPlayer[]): Map<number, string> {
  const heroMeta = new Map<number, string>();
  for (const mp of matchPlayers) {
    if (!heroMeta.has(mp.heroId)) {
      heroMeta.set(mp.heroId, mp.heroName);
    }
  }
  return heroMeta;
}

export function computeHeroImpact(
  matches: DBMatch[],
  matchPlayers: DBMatchPlayer[],
  players: DBPlayer[],
): HeroImpactResult[] {
  const observations = buildTeamObservations(matches, matchPlayers, players);
  const heroMeta = collectHeroMeta(matchPlayers);
  const results: HeroImpactResult[] = [];
  for (const [heroId, heroName] of heroMeta.entries()) {
    results.push(computeOneHero(heroId, heroName, observations));
  }
  return results;
}

/** Async variant that yields to the main thread between heroes. */
export async function computeHeroImpactAsync(
  matches: DBMatch[],
  matchPlayers: DBMatchPlayer[],
  players: DBPlayer[],
): Promise<HeroImpactResult[]> {
  const observations = buildTeamObservations(matches, matchPlayers, players);
  const heroMeta = collectHeroMeta(matchPlayers);
  const results: HeroImpactResult[] = [];
  let count = 0;
  for (const [heroId, heroName] of heroMeta.entries()) {
    results.push(computeOneHero(heroId, heroName, observations));
    count++;
    if (count % 3 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }
  return results;
}
