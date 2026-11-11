(function (root) {
  'use strict';
  const M = typeof module !== 'undefined' ? require('./damage.js') : root.MHNDamage;
  const SLOTS = ['head', 'chest', 'arms', 'waist', 'legs'];
  const STATUS = ['poison', 'paralysis', 'sleep', 'blast'];
  const DIRECT = ['fire', 'water', 'thunder', 'ice', 'dragon'];
  const BASE = {
    weapon: 'GREAT_SWORD', attenuation: 1, spMove: false, spAttackPercentage: 100, affectBySpirit: false,
    correctionWithWeapon: 0, attackMul: 0, attackMul2: 0, attackAdd: 0, elementMul: 0, elementMul2: 0, elementAdd: 0,
    weaknessExploit: 0, critBoost: 0, damageAddPct: 0, extraMul: 1, attackMulOnCrit: 0, attackAddOnCrit: 0,
    elementMulOnCrit: 0, elementMulOnMinusCrit: 0, ailmentMul: 0, overridePhysicalPercentage: 0,
    ferocityProbability: 0, ferocityBoost: 100, paralyzed: false, outOfCritRange: false,
  };
  const METRICS = ['expected', 'crit', 'ferocity', 'none'];

  const styleClass = (w) => DIRECT.includes(w.element) ? 'elemental' : STATUS.includes(w.element) ? 'status' : 'raw';
  function styleAllocations(D, w) {
    if (!w.style || !D.style) return [{ a: 0, e: 0, f: 0 }];
    const v = D.style.values[styleClass(w)], out = [];
    for (let a = 0; a <= 3; a++) for (let f = 0; f <= 3 - a; f++) {
      const e = 3 - a - f;
      if (e > 0 && !v.element) continue;
      out.push({ a, e, f });
    }
    return out;
  }
  const styleCode = (x) => 'A'.repeat(x.a) + 'E'.repeat(x.e) + 'F'.repeat(x.f);

  function weaponSkills(w, styleLevel) {
    const extra = w.style ? (w.styleSkills || []).filter(([, , min]) => styleLevel >= min).map(([s, l]) => [s, l]) : [];
    return [...(w.skills || []), ...extra];
  }

  function addLevels(D, base, grants) {
    const n = { ...base };
    for (const [id, lv] of grants) {
      const s = D.skills[id]; if (!s) continue;
      n[id] = Math.min(s.max, (n[id] || 0) + lv);
    }
    return n;
  }
  const levelSig = (lv) => Object.keys(lv).sort().map((k) => k + ':' + lv[k]).join('|');

  function active(eff, w, ctx, levels) {
    if (!eff || !Object.keys(eff).length) return false;
    const cond = ctx.conditions;
    const charge = ctx.move.charge != null ? !!ctx.move.charge : cond.has('chargedAttack');
    const has = (c) => {
      if (c === 'monster.weakPoint') return true;
      if (c === 'chargedAttack') return charge;
      if (c === 'perfectChargeRelease') return charge && cond.has(c);
      if (c === 'wakeUpHit' || c === 'monster.sleeping') return cond.has('monster.sleeping') || cond.has('wakeUpHit');
      return cond.has(c);
    };
    if ((eff.requires || []).some((c) => !has(c))) return false;
    if ((eff.conflicts || []).some((c) => cond.has(c))) return false;
    if (eff.onlySp && !ctx.move.sp) return false;
    if (eff.onlyNonSp && ctx.move.sp) return false;
    if (eff.appliesToElement && eff.appliesToElement !== w.element) return false;
    if (eff.requiresWeaponStatus && eff.requiresWeaponStatus !== w.element) return false;
    if (eff.requiresStatusWeapon && !STATUS.includes(w.element)) return false;
    if (eff.requiresSkillLevel && (levels[eff.requiresSkillLevel.skillId] || 0) < eff.requiresSkillLevel.minLevel) return false;
    return true;
  }

  function toInput(D, w, alloc, levels, ctx) {
    const picks = [...Array(alloc.a).fill('attack'), ...Array(alloc.e).fill('element'), ...Array(alloc.f).fill('affinity')];
    const sb = M.styleBonus(D, w, ctx.styleLevel == null ? 20 : ctx.styleLevel, picks);
    const inp = { ...BASE, weapon: w.type, attack: w.attack + sb.attack, element: w.element,
      elementValue: w.elementValue + sb.element, affinity: w.affinity + sb.affinity,
      mv: ctx.move.mv, phys: ctx.move.phys, spMove: ctx.move.sp, spAttackPercentage: ctx.move.spPct,
      paralyzed: ctx.conditions.has('monster.paralyzed') };
    const weaponAffinity = w.affinity + sb.affinity;
    const active_ = [];
    let mulmul = 1;
    for (const [id, lv] of Object.entries(levels)) {
      const s = D.skills[id]; if (!s || !lv) continue;
      const eff = s.levels[String(Math.min(lv, s.max))];
      if (!active(eff, w, ctx, levels)) continue;
      active_.push([id, lv]);
      if (eff.attackMultiplierPct) inp.attackMul += eff.attackMultiplierPct;
      if (eff.attackUp) inp.attackAdd += eff.attackUp;
      if (eff.attackUpPerWeaponAffinityPct) inp.attackAdd += eff.attackUpPerWeaponAffinityPct * Math.max(0, weaponAffinity);
      if (eff.attackEfficacyMultiplier) inp.attackMul2 += (eff.attackEfficacyMultiplier - 1) * 100;
      if (eff.elementAttackUp) inp.elementAdd += eff.elementAttackUp;
      if (eff.elementMultiplierPct) { if (eff.onlyPositiveCrit) inp.elementMulOnCrit += eff.elementMultiplierPct; else inp.elementMul += eff.elementMultiplierPct; }
      if (eff.affinityDelta) {
        if (id === 'weakness-exploit') inp.weaknessExploit += Math.round(eff.affinityDelta * 100);
        else inp.affinity += Math.round(eff.affinityDelta * 100);
      }
      if (eff.positiveCritMultiplier) inp.critBoost = Math.max(inp.critBoost, Math.round(eff.positiveCritMultiplier * 100) - 125);
      if (eff.brutalCritMultiplier) { inp.ferocityBoost = Math.max(inp.ferocityBoost, Math.round(eff.brutalCritMultiplier * 100)); inp.ferocityProbability = ctx.ferocityChance; }
      if (eff.damageMultiplier) {
        if (ctx.stackMode === 'mul') mulmul *= eff.damageMultiplier;
        else inp.damageAddPct += (eff.damageMultiplier - 1) * 100;
      }
    }
    inp.extraMul = mulmul;
    return { inp, active: active_ };
  }

  function metricOf(r, metric) {
    if (metric === 'expected') return r.expected;
    if (metric === 'none') return r.base.damage;
    const kind = metric === 'crit' ? 'plus' : 'ferocity';
    const o = r.outcomes.find((x) => x.kind === kind);
    return o ? o.damage : -Infinity;
  }

  function relevantSkills(D, w, ctx) {
    const out = new Set();
    for (const [id, s] of Object.entries(D.skills)) {
      const top = s.levels[String(s.max)];
      const fake = { [id]: s.max };
      if (top && top.requiresSkillLevel) fake[top.requiresSkillLevel.skillId] = 99;
      if (active(top, w, ctx, fake)) { out.add(id); if (top.requiresSkillLevel) out.add(top.requiresSkillLevel.skillId); }
    }
    return out;
  }

  function prunedArmor(D, rel) {
    const by = {};
    for (const slot of SLOTS) {
      const proj = D.armor.filter((a) => a.slot === slot).map((a) => ({ a, lv: addLevels(D, {}, a.skills.filter(([id]) => rel.has(id))) }));
      const uniq = new Map();
      for (const x of proj) { const k = x.a.driftSlots + '#' + levelSig(x.lv); if (!uniq.has(k)) uniq.set(k, x); }
      const u = [...uniq.values()];
      by[slot] = u.filter((x, i) => !u.some((y, j) => {
        if (i === j || y.a.driftSlots < x.a.driftSlots) return false;
        let strict = y.a.driftSlots > x.a.driftSlots;
        for (const id of new Set([...Object.keys(x.lv), ...Object.keys(y.lv)])) {
          const xv = x.lv[id] || 0, yv = y.lv[id] || 0;
          if (yv < xv) return false;
          if (yv > xv) strict = true;
        }
        return strict;
      })).map((x) => x.a);
    }
    return by;
  }

  function metricAvailability(D) {
    const has = (pred) => Object.values(D.skills).some((s) => Object.values(s.levels).some(pred));
    const affinitySrc = D.weapons.some((w) => w.affinity > 0) || (D.style && Object.values(D.style.values).some((v) => v.affinity > 0)) || has((e) => e && e.affinityDelta > 0);
    const ferocity = has((e) => e && e.brutalCritMultiplier) && [...D.armor.flatMap((a) => a.skills), ...D.drifts.map((d) => [d.skill, d.level]), ...D.weapons.flatMap((w) => weaponSkills(w, 20))]
      .some(([id]) => Object.values((D.skills[id] || { levels: {} }).levels).some((e) => e && e.brutalCritMultiplier));
    return { expected: true, none: true, crit: affinitySrc, ferocity };
  }

  const EXCLUSIVE = [['hp.full', 'hp.low'], ['perfectEvade', 'noEvade10s'], ['forwardDodge', 'noEvade10s'], ['monster.paralyzed', 'monster.sleeping'], ['spGaugeFull', 'spGaugeNotFull']];
  function legalProfiles(conds) {
    let out = [new Set(conds)];
    for (const g of EXCLUSIVE) {
      const next = [];
      for (const p of out) {
        const present = g.filter((c) => p.has(c));
        if (present.length <= 1) { next.push(p); continue; }
        for (const keep of present) { const q = new Set(p); present.filter((c) => c !== keep).forEach((c) => q.delete(c)); next.push(q); }
      }
      out = next;
    }
    return out;
  }

  function search(D, ctx, opts = {}) {
    const profiles = legalProfiles(ctx.conditions);
    if (profiles.length > 1) {
      let all = [], evals = 0;
      profiles.forEach((p, i) => {
        const r = searchOne(D, { ...ctx, conditions: p }, { ...opts, onProgress: opts.onProgress && ((a, n) => opts.onProgress(i * n + a, profiles.length * n)) });
        evals += r.evals; all.push(...r.results.map((x) => ({ ...x, profile: [...p] })));
      });
      const seen = new Set();
      all = all.sort((a, b) => b.score - a.score).filter((x) => !seen.has(x.key) && seen.add(x.key));
      return { results: all.slice(0, opts.topK || 10), evals, profiles: profiles.length };
    }
    const r = searchOne(D, ctx, opts);
    return { ...r, results: r.results.map((x) => ({ ...x, profile: [...ctx.conditions] })), profiles: 1 };
  }

  function searchOne(D, ctx, opts = {}) {
    const beamWidth = opts.beamWidth || 40, topK = opts.topK || 10;
    const state = ctx.state, mid = ctx.monsterId;
    const results = [];
    const push = (r) => {
      const key = r.weapon.id + '|' + r.style + '|' + SLOTS.map((s) => r.armor[s].id).join(',') + '|' + r.drifts.map((d) => d.id).sort().join(',');
      if (results.some((x) => x.key === key)) return;
      results.push({ ...r, key });
      results.sort((a, b) => b.score - a.score);
      if (results.length > topK * 3) results.length = topK * 3;
    };
    const weapons = D.weapons.filter((w) => !ctx.weaponIds || ctx.weaponIds.includes(w.id))
      .map((w) => ctx.weaponOverride && ctx.weaponIds && ctx.weaponIds.length === 1
        ? { ...w, ...ctx.weaponOverride, style: false } : w);
    let evals = 0;
    for (const w of weapons) {
      const rel = relevantSkills(D, w, ctx);
      const allocs = ctx.styleFixed && w.style ? [ctx.styleFixed] : styleAllocations(D, w);
      const drifts = D.drifts.filter((d) => rel.has(d.skill));
      const armor = prunedArmor(D, rel);
      const cache = new Map();
      const best = (levels) => {
        const k = levelSig(levels);
        if (cache.has(k)) return cache.get(k);
        let b = { score: -Infinity, alloc: allocs[0] };
        for (const al of allocs) {
          const { inp } = toInput(D, w, al, levels, ctx);
          const r = M.evaluate(D.config, mid, state, inp); evals++;
          const s = metricOf(r, ctx.metric);
          if (s > b.score) b = { score: s, alloc: al };
        }
        cache.set(k, b);
        return b;
      };
      const rank = (lv) => { const b = best(lv); return b.score === -Infinity ? -1e12 + bestExpected(lv) : b.score; };
      const expCache = new Map();
      const bestExpected = (lv) => {
        const k = levelSig(lv); if (expCache.has(k)) return expCache.get(k);
        let v = -Infinity;
        for (const al of allocs) { const { inp } = toInput(D, w, al, lv, ctx); v = Math.max(v, M.evaluate(D.config, mid, state, inp).expected); evals++; }
        expCache.set(k, v); return v;
      };
      let beam = [{ armor: {}, levels: addLevels(D, {}, weaponSkills(w, ctx.styleLevel == null ? 20 : ctx.styleLevel)), slots: 0, drifts: [] }];
      for (const slot of SLOTS) {
        const next = [];
        for (const st of beam) for (const p of armor[slot])
          next.push({ armor: { ...st.armor, [slot]: p }, levels: addLevels(D, st.levels, p.skills), slots: st.slots + p.driftSlots, drifts: st.drifts });
        next.forEach((x) => { x.rank = rank(x.levels); });
        next.sort((a, b) => b.rank - a.rank);
        const seen = new Set(); beam = [];
        for (const x of next) { const k = x.slots + '#' + levelSig(x.levels); if (seen.has(k)) continue; seen.add(k); beam.push(x); if (beam.length >= beamWidth) break; }
      }
      const maxSlots = Math.max(0, ...beam.map((x) => x.slots));
      for (let step = 0; step < maxSlots; step++) {
        const next = [];
        for (const st of beam) {
          if (step >= st.slots) { next.push(st); continue; }
          for (const d of drifts) next.push({ ...st, levels: addLevels(D, st.levels, [[d.skill, d.level]]), drifts: [...st.drifts, d] });
          if (!drifts.length) next.push(st);
        }
        next.forEach((x) => { x.rank = rank(x.levels); });
        next.sort((a, b) => b.rank - a.rank);
        const seen = new Set(); beam = [];
        for (const x of next) { const k = x.slots + '#' + x.drifts.length + '#' + levelSig(x.levels); if (seen.has(k)) continue; seen.add(k); beam.push(x); if (beam.length >= beamWidth) break; }
      }
      for (const st of beam.slice(0, opts.perWeapon || 6)) {
        const b = best(st.levels);
        if (b.score === -Infinity) continue;
        const { inp, active: act } = toInput(D, w, b.alloc, st.levels, ctx);
        const r = M.evaluate(D.config, mid, state, inp);
        push({ weapon: w, style: w.style ? styleCode(b.alloc) : '', alloc: b.alloc, armor: st.armor, drifts: st.drifts,
          levels: st.levels, activeSkills: act, input: inp, result: r, score: b.score });
      }
      if (opts.onProgress) opts.onProgress(weapons.indexOf(w) + 1, weapons.length);
    }
    return { results: results.slice(0, topK), evals };
  }

  const api = { SLOTS, METRICS, EXCLUSIVE, legalProfiles, search, toInput, metricAvailability, styleAllocations, styleCode, addLevels, weaponSkills };
  if (typeof module !== 'undefined') module.exports = api; else root.MHNOptimizer = api;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
