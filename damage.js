(function (root) {
  'use strict';
  const f = Math.fround;
  const trunc = (x) => Math.trunc(x);

  const ELEMENTS = ['none', 'fire', 'water', 'thunder', 'ice', 'dragon', 'poison', 'paralysis', 'sleep', 'blast'];
  const WEAPONS = ['GREAT_SWORD', 'SWORD_SHELD', 'DUAL_BLADES', 'LONG_SWORD', 'HAMMER', 'HUNTING_HORN', 'LANCE',
    'GUNLANCE', 'SWITCH_AXE', 'CHARGE_BLADE', 'INSECT_GLAIVE', 'BOW', 'HEAVY_BOWGUN', 'LIGHT_BOWGUN'];
  const PHYS = ['cut', 'blunt', 'ammo', 'blast'];

  function current(s) {
    return f(f(s.mul2) * f(f(f(s.raw) + f(s.raw * s.mul)) + f(s.add)));
  }

  function weaponCorrection(inp) {
    const w = inp.weapon;
    const applies = w === 'HUNTING_HORN' || (w === 'LONG_SWORD' && inp.affectBySpirit) ||
      (w === 'LANCE' && inp.phys === 'cut');
    if (!applies) return 1;
    return (trunc(inp.correctionWithWeapon) + 100) / 100;
  }

  function hitzone(cfg, monsterId, state, inp, elemIdx) {
    const dci = cfg.damageCalculationInfo;
    const pi = PHYS.indexOf(inp.phys);
    let physPct = pi === 3 ? dci.blastDamagePercentage : state.p[pi];
    let elemPct = elemIdx >= 1 && elemIdx <= 5 ? state.e[elemIdx - 1] : 0;
    if (elemIdx >= 6 && /ems/.test(monsterId)) elemPct = 100;
    if (inp.overridePhysicalPercentage > 0 && physPct > 0 && physPct < inp.overridePhysicalPercentage)
      physPct = inp.overridePhysicalPercentage;
    let weakPoint;
    if (pi === 3 || !state.pw) weakPoint = physPct >= dci.weakPointThreshold;
    else weakPoint = !!state.pw[pi];
    return { physPct, elemPct, weakPoint };
  }

  function stats(inp, crit) {
    const atk = { raw: inp.attack, mul: inp.attackMul / 100 + (crit === 'plus' ? inp.attackMulOnCrit / 100 : 0),
      mul2: 1 + inp.attackMul2 / 100, add: inp.attackAdd + (crit === 'plus' ? inp.attackAddOnCrit : 0) };
    const elemIdx = ELEMENTS.indexOf(inp.element);
    let eMul = inp.elementMul / 100;
    if (elemIdx >= 6) eMul += inp.ailmentMul / 100;
    if (elemIdx >= 1 && elemIdx <= 5) {
      if (crit === 'plus') eMul += inp.elementMulOnCrit / 100;
      if (crit === 'minus' || crit === 'ferocity') eMul += inp.elementMulOnMinusCrit / 100;
    }
    const ele = { raw: inp.elementValue, mul: eMul, mul2: 1 + inp.elementMul2 / 100, add: inp.elementAdd };
    return { ATK: trunc(current(atk)), ELE: elemIdx === 0 ? 0 : trunc(current(ele)), elemIdx };
  }

  function hit(cfg, monsterId, state, inp, crit) {
    const { ATK, ELE, elemIdx } = stats(inp, crit);
    const hz = hitzone(cfg, monsterId, state, inp, elemIdx);
    const corr = weaponCorrection(inp);
    const elemTerm = trunc((hz.elemPct * ELE) / 100);
    let raw = f(f(f(corr * inp.mv) * inp.attenuation) * (elemTerm + ATK));
    raw = f(f(f(raw / 100) * hz.physPct) / 100);
    if (inp.paralyzed) raw = f(raw * f(cfg.enemyDamageInfo.paralysisDamagePercentage / 100));
    let mulmul = 1;
    const dci = cfg.damageCalculationInfo;
    if (crit === 'plus') mulmul *= (dci.criticalPercentage + trunc(inp.critBoost)) / 100;
    if (crit === 'minus') mulmul *= dci.minusCriticalPercentage / 100;
    if (crit === 'ferocity') mulmul *= inp.ferocityBoost / 100;
    if (inp.outOfCritRange) mulmul *= dci.noCriticalRangeCorrection / 100;
    if (inp.spMove) mulmul *= inp.spAttackPercentage / 100;
    mulmul *= inp.extraMul;
    const addmul = 1 + inp.damageAddPct / 100;
    return { damage: Math.ceil(f(f(raw * addmul) * mulmul)), raw, ATK, ELE, elemTerm, corr, ...hz };
  }

  function evaluate(cfg, monsterId, state, inp) {
    const base = hit(cfg, monsterId, state, inp, 'none');
    let rate = trunc(inp.affinity) + (base.weakPoint ? trunc(inp.weaknessExploit) : 0);
    if (inp.phys === 'blast') rate = 0;
    const p = Math.min(Math.abs(rate), 100) / 100;
    const out = { base, rate, outcomes: [{ kind: 'none', prob: 1 - p, ...base }] };
    if (rate > 0) out.outcomes.push({ kind: 'plus', prob: p, ...hit(cfg, monsterId, state, inp, 'plus') });
    if (rate < 0) {
      const fp = Math.min(Math.max(inp.ferocityProbability, 0), 100) / 100;
      if (fp > 0) out.outcomes.push({ kind: 'ferocity', prob: p * fp, ...hit(cfg, monsterId, state, inp, 'ferocity') });
      out.outcomes.push({ kind: 'minus', prob: p * (1 - fp), ...hit(cfg, monsterId, state, inp, 'minus') });
    }
    out.expected = out.outcomes.reduce((s, o) => s + o.prob * o.damage, 0);
    return out;
  }

  function ailmentBuildup(data, inp) {
    const { ELE, elemIdx } = stats(inp, 'none');
    if (elemIdx < 6) return null;
    const pct = data.ailmentPct[inp.weapon] ?? data.ailmentPct._default;
    return { value: trunc((pct * ELE) / 100), chance: data.ailmentProbability, weaponPct: pct };
  }

  function styleBonus(data, w, level, picks) {
    const out = { attack: 0, element: 0, affinity: 0, levelAttack: 0, levelElement: 0 };
    const st = data.style; if (!w || !w.style || !st) return out;
    const pat = w.stylePattern && st.patterns ? st.patterns[w.stylePattern] : null;
    if (pat) for (let lv = 1; lv <= Math.min(level, 20); lv++) {
      const c = st.cycle[lv - 1]; if (!c) continue;
      const [stat, v] = pat[c - 1];
      if (stat === 'attack') out.levelAttack += v; else out.levelElement += v;
    }
    const cls = ['fire', 'water', 'thunder', 'ice', 'dragon'].includes(w.element) ? 'elemental'
      : ['poison', 'paralysis', 'sleep', 'blast'].includes(w.element) ? 'status' : 'raw';
    const vals = st.values[cls];
    (picks || []).forEach((p, i) => { if (st.levels[i] <= level && vals[p]) out[p] += vals[p]; });
    out.attack += out.levelAttack; out.element += out.levelElement;
    return out;
  }

  const api = { ELEMENTS, WEAPONS, PHYS, current, weaponCorrection, hitzone, hit, evaluate, ailmentBuildup, styleBonus };
  if (typeof module !== 'undefined') module.exports = api; else root.MHNDamage = api;
})(typeof window !== 'undefined' ? window : globalThis);
