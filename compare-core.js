(function (root) {
  'use strict';
  const KEY = 'mhn-compare-v1', MAX = 5;
  const PICK = { A: 'attack', E: 'element', F: 'affinity' };

  function evalBuild(D, build, target) {
    const O = root.MHNOptimizer, M = root.MHNDamage;
    const w = D.weapons.find((x) => x.id === build.weapon);
    const mv = (D.moves.GREAT_SWORD || []).find((m) => m.id === target.move) || D.moves.GREAT_SWORD[0];
    const lvl = w.style ? Number(build.styleOn || 0) : 0;
    const picks = build.picks || [];
    const alloc = lvl ? { a: picks.filter((p) => p === 'attack').length, e: picks.filter((p) => p === 'element').length, f: picks.filter((p) => p === 'affinity').length } : { a: 0, e: 0, f: 0 };
    let levels = O.addLevels(D, {}, O.weaponSkills(w, lvl));
    const armor = O.SLOTS.map((s) => D.armor.find((a) => a.id === (build.armor || {})[s])).filter(Boolean);
    armor.forEach((a) => { levels = O.addLevels(D, levels, a.skills); });
    (build.drifts || []).filter(Boolean).forEach((id) => { const d = D.drifts.find((x) => x.id === id); if (d) levels = O.addLevels(D, levels, [[d.skill, d.level]]); });
    const ctx = { conditions: new Set(target.conds || []), move: { mv: mv.mv, phys: mv.phys, sp: !!mv.sp, charge: !!mv.charge, spPct: Number(target.spPct) || 100 },
      styleLevel: lvl, ferocityChance: Number(target.ferocityChance == null ? 100 : target.ferocityChance), stackMode: 'add' };
    const [pi, si] = String(target.part).split(':').map(Number);
    const state = D.monsters[target.monster].parts[pi].states[si];
    const { inp, active } = O.toInput(D, w, alloc, levels, ctx);
    const r = M.evaluate(D.config, target.monster, state, inp);
    return { w, lvl, picks, levels, active, inp, r, mv };
  }

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const store = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch (e) {} renderBar(); };
  const sig = (b) => [b.weapon, b.styleOn, (b.picks || []).join(''), ...Object.keys(b.armor || {}).sort().map((k) => b.armor[k]), (b.drifts || []).filter(Boolean).slice().sort().join(',')].join('|');
  function add(build, target) {
    const list = load();
    if (list.some((x) => sig(x) === sig(build))) return 'dup';
    if (list.length >= MAX) return 'full';
    list.push({ ...build, target, addedAt: Date.now() });
    store(list); return 'added';
  }
  const remove = (i) => { const l = load(); l.splice(i, 1); store(l); };
  const clear = () => store([]);
  const picksFromCode = (code) => (code ? code.split('').map((c) => PICK[c]) : ['attack', 'attack', 'attack']);

  function renderBar() {
    if (typeof document === 'undefined' || !document.body || /compare\.html/.test(location.pathname)) return;
    let bar = document.getElementById('cmpBar');
    if (!bar) {
      const css = document.createElement('style');
      css.textContent = '#cmpBar{position:fixed;right:16px;bottom:16px;z-index:20;background:var(--accent);color:#fff;border-radius:999px;padding:8px 14px;font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,.25);display:flex;gap:10px;align-items:center}#cmpBar a{color:#fff;font-weight:700}#cmpToast{position:fixed;right:16px;bottom:60px;z-index:20;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-size:12px}';
      document.head.appendChild(css);
      bar = document.createElement('div'); bar.id = 'cmpBar'; document.body.appendChild(bar);
    }
    const n = load().length;
    bar.hidden = n === 0;
    bar.innerHTML = `比較列 ${n}/${MAX}<a href="compare.html">前往比較 →</a>`;
  }
  function toast(msg) {
    let t = document.getElementById('cmpToast');
    if (!t) { t = document.createElement('div'); t.id = 'cmpToast'; document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 2200);
  }
  function addWithToast(build, target) {
    const r = add(build, target);
    toast(r === 'added' ? `已加入比較（${load().length}/${MAX}）` : r === 'dup' ? '這套已在比較列中' : `比較列已滿 ${MAX} 套，請先到比較頁移除`);
    return r;
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderBar); else renderBar();
    root.addEventListener && root.addEventListener('storage', (e) => { if (e.key === KEY) renderBar(); });
  }

  root.MHNCompare = { KEY, MAX, evalBuild, load, add, addWithToast, remove, clear, picksFromCode, renderBar };
})(typeof window !== 'undefined' ? window : globalThis);
