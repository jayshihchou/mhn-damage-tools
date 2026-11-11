self.window = self;
const V = (self.location.search.match(/v=(\w+)/) || [])[1] || '0';
importScripts('data.js?v=' + V, 'damage.js?v=' + V, 'optimizer.js?v=' + V);
self.onmessage = (ev) => {
  const { ctx, opts } = ev.data;
  ctx.conditions = new Set(ctx.conditions);
  const t0 = Date.now();
  try {
    const out = self.MHNOptimizer.search(self.MHN_DATA, ctx, {
      ...opts, onProgress: (i, n) => self.postMessage({ type: 'progress', i, n }),
    });
    const results = out.results.map((r) => ({
      weaponId: r.weapon.id, style: r.style, armor: Object.fromEntries(Object.entries(r.armor).map(([k, v]) => [k, v.id])),
      drifts: r.drifts.map((d) => d.id), levels: r.levels, activeSkills: r.activeSkills, input: r.input,
      outcomes: r.result.outcomes.map((o) => ({ kind: o.kind, prob: o.prob, damage: o.damage })),
      expected: r.result.expected, rate: r.result.rate, base: { physPct: r.result.base.physPct, elemPct: r.result.base.elemPct, weakPoint: r.result.base.weakPoint, ATK: r.result.base.ATK, ELE: r.result.base.ELE },
      score: r.score, profile: r.profile,
    }));
    self.postMessage({ type: 'done', results, evals: out.evals, profiles: out.profiles, ms: Date.now() - t0 });
  } catch (e) {
    self.postMessage({ type: 'error', message: String(e && e.stack || e) });
  }
};
