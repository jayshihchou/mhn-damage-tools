(function (root) {
  'use strict';
  const CSS = `
.pk-btn{width:100%;text-align:left;padding:5px 8px;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:4px;font:inherit;cursor:pointer;display:flex;gap:6px;align-items:center}
.pk-btn::after{content:'▾';margin-left:auto;color:var(--muted)}
.pk-btn.open::after{content:'▴'}
.pk-panel{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:8px;margin:4px 0 10px}
.pk-tabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}
.pk-tab{padding:2px 9px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--fg);cursor:pointer;font:inherit;font-size:12px}
.pk-tab.on{background:var(--accent);border-color:var(--accent);color:#fff}
.pk-search{width:100%;margin-bottom:6px}
.pk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px;max-height:300px;overflow:auto}
.pk-item{text-align:left;padding:5px 7px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);cursor:pointer;font:inherit;font-size:13px;line-height:1.3}
.pk-item small{display:block;color:var(--muted);font-size:11px}
.pk-item.sel{border-color:var(--accent);outline:1px solid var(--accent)}
.pk-item.top{grid-column:1/-1}
.pk-empty{color:var(--muted);font-size:12px;padding:6px}
.pk-filter{border:1px dashed var(--line);border-radius:6px;padding:6px;margin-bottom:6px}
.pk-filter>b{display:block;font-size:11px;color:var(--muted);font-weight:500;margin-bottom:4px}
.pk-sks{display:flex;flex-wrap:wrap;gap:4px;max-height:120px;overflow:auto}
.pk-sk{padding:1px 8px;border:1px solid var(--line);border-radius:4px;background:var(--bg);color:var(--fg);cursor:pointer;font:inherit;font-size:12px}
.pk-sk.on{border-color:var(--accent);color:var(--accent);font-weight:600}
.pk-chosen{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:6px;font-size:12px}
.pk-chip{padding:1px 8px;border-radius:999px;border:0;background:var(--accent);color:#fff;cursor:pointer;font:inherit;font-size:12px}
.pk-chip::after{content:' ✕'}
.pk-chip.clear{background:transparent;color:var(--muted);border:1px solid var(--line)}
.pk-chip.clear::after{content:''}
.pk-item small mark{background:none;color:var(--accent);font-weight:600}`;
  let styled = false;

  
  function attach(select, opts) {
    if (!styled) { const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); styled = true; }
    const host = select.closest('label') || select.parentElement;
    select.style.display = 'none';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'pk-btn';
    select.insertAdjacentElement('afterend', btn);
    const panel = document.createElement('div'); panel.className = 'pk-panel'; panel.hidden = true;
    host.insertAdjacentElement('afterend', panel);
    let tab = 'all', q = '', items = opts.items || [];
    const tabs = [{ key: 'all', label: '全部' }, ...(opts.tabs || [])];

    const current = () => items.find((i) => i.value === select.value);
    function sync() {
      const c = current();
      btn.textContent = c ? c.label + (c.sub ? `　${c.sub}` : '') : (opts.placeholder || '選擇…');
      if (!panel.hidden) render();
    }
    const F = opts.skillFilter;
    function renderFilter() {
      const st = F.state, sel = st.sel, g = F.groups.find((x) => x.key === st.group) || F.groups[0];
      const match = (i) => (i.skills || []).filter((id) => sel.has(id)).length;
      let vis = items.filter((i) => i.top || ((!sel.size || match(i) > 0) && (!q || (i.label + ' ' + (i.search || i.sub || '')).toLowerCase().includes(q))));
      if (sel.size) vis = vis.slice().sort((a, b) => match(b) - match(a));
      const hl = (i) => (i.skillText || []).map(([id, t]) => sel.has(id) ? `<mark>${t}</mark>` : t);
      panel.innerHTML =
        `<div class="pk-filter"><b>依技能篩選（可複選，符合越多排越前）</b>` +
        `<div class="pk-tabs">${F.groups.map((x) => `<button type="button" class="pk-tab ${x.key === g.key ? 'on' : ''}" data-grp="${x.key}">${x.label} ${x.ids.length}</button>`).join('')}</div>` +
        `<div class="pk-sks">${g.ids.map((id) => `<button type="button" class="pk-sk ${sel.has(id) ? 'on' : ''}" data-sk="${id}">${F.name(id)}</button>`).join('')}</div></div>` +
        `<input class="pk-search" placeholder="搜尋名稱或技能…" value="${q.replace(/"/g, '&quot;')}">` +
        (sel.size ? `<div class="pk-chosen">已選：${[...sel].map((id) => `<button type="button" class="pk-chip" data-unsel="${id}" title="取消">${F.name(id)}</button>`).join('')}<button type="button" class="pk-chip clear" data-unsel="*">全部清除</button></div>` : '') +
        `<div class="pk-grid">${vis.map((i) => `<button type="button" class="pk-item ${i.top ? 'top' : ''} ${i.value === select.value ? 'sel' : ''}" data-v="${i.value}">${i.label}<small>${i.pre ? i.pre + '｜' : ''}${hl(i).join('、') || '無技能'}</small></button>`).join('') || '<div class="pk-empty">沒有帶這些技能的裝備</div>'}</div>`;
      const s = panel.querySelector('.pk-search');
      s.addEventListener('input', () => { q = s.value.trim().toLowerCase(); const pos = s.selectionStart; render(); const n = panel.querySelector('.pk-search'); n.focus(); n.setSelectionRange(pos, pos); });
    }
    function render() {
      if (F) return renderFilter();
      const vis = items.filter((i) => i.top || ((tab === 'all' || (i.tags || []).includes(tab)) &&
        (!q || (i.label + ' ' + (i.sub || '') + ' ' + i.value).toLowerCase().includes(q))));
      const counts = Object.fromEntries(tabs.map((t) => [t.key, t.key === 'all' ? items.filter((i) => !i.top).length : items.filter((i) => (i.tags || []).includes(t.key)).length]));
      panel.innerHTML =
        `<div class="pk-tabs">${tabs.filter((t) => counts[t.key]).map((t) => `<button type="button" class="pk-tab ${t.key === tab ? 'on' : ''}" data-tab="${t.key}">${t.label} ${counts[t.key]}</button>`).join('')}</div>` +
        `<input class="pk-search" placeholder="搜尋名稱…" value="${q.replace(/"/g, '&quot;')}">` +
        `<div class="pk-grid">${vis.map((i) => `<button type="button" class="pk-item ${i.top ? 'top' : ''} ${i.value === select.value ? 'sel' : ''}" data-v="${i.value}">${i.label}${i.sub ? `<small>${i.sub}</small>` : ''}</button>`).join('') || '<div class="pk-empty">沒有符合的項目</div>'}</div>`;
      const s = panel.querySelector('.pk-search');
      s.addEventListener('input', () => { q = s.value.trim().toLowerCase(); const pos = s.selectionStart; render(); const n = panel.querySelector('.pk-search'); n.focus(); n.setSelectionRange(pos, pos); });
    }
    panel.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; render(); return; }
      if (F) {
        const gr = e.target.closest('[data-grp]'); if (gr) { F.state.group = gr.dataset.grp; render(); return; }
        const sk = e.target.closest('[data-sk]'); if (sk) { const id = sk.dataset.sk; if (F.state.sel.has(id)) F.state.sel.delete(id); else F.state.sel.add(id); render(); return; }
        const un = e.target.closest('[data-unsel]'); if (un) { if (un.dataset.unsel === '*') F.state.sel.clear(); else F.state.sel.delete(un.dataset.unsel); render(); return; }
      }
      const it = e.target.closest('[data-v]'); if (!it) return;
      select.value = it.dataset.v;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      panel.hidden = true; btn.classList.remove('open'); sync();
    });
    btn.addEventListener('click', (e) => { e.preventDefault(); panel.hidden = !panel.hidden; btn.classList.toggle('open', !panel.hidden); if (!panel.hidden) render(); });
    select.addEventListener('change', sync);
    sync();
    return { sync, setItems(next) { items = next; sync(); } };
  }

  const ELEM_ZH = { fire: '火', water: '水', thunder: '雷', ice: '冰', dragon: '龍', poison: '毒', paralysis: '麻痺', sleep: '睡眠', blast: '爆破', none: '無' };
  const ELEM_TABS = ['fire', 'water', 'thunder', 'ice', 'dragon', 'poison', 'paralysis', 'sleep', 'blast'];

  function monsterName(D, id) {
    const m = D.monsters[id];
    if (m.zh) return m.zh + (m.conf === 'high' ? '' : m.conf === 'low' ? '？？' : '？');
    if (/^m_/.test(id)) return '活動目標';
    if (/ems/.test(id)) return '小型魔物';
    return id;
  }
  function monsterItems(D, ids) {
    const items = ids.map((id) => {
      const weak = Object.entries(D.monsters[id].weak).filter(([, v]) => v === 1).map(([k]) => k);
      const name = monsterName(D, id);
      return { value: id, label: name, sub: (weak.length ? '弱 ' + weak.map((k) => ELEM_ZH[k]).join('') : '無弱點屬性') + (D.monsters[id].zh ? '' : `｜${id}`),
        tags: weak.length ? weak : ['other'] };
    });
    const tabs = [...ELEM_TABS.map((k) => ({ key: k, label: '弱' + ELEM_ZH[k] })), { key: 'other', label: '其他' }];
    return { items, tabs };
  }
  function weaponItems(D, top) {
    const items = [...(top || []).map((t) => ({ ...t, top: true })),
      ...D.weapons.map((w) => ({ value: w.id, label: w.zh || w.name, sub: `${ELEM_ZH[w.element]} ${w.elementValue || ''}｜攻 ${w.attack}${w.affinity ? `｜會心 ${w.affinity}%` : ''}${w.style ? '｜可風格強化' : ''}`, tags: [w.element] }))];
    const tabs = [...ELEM_TABS, 'none'].map((k) => ({ key: k, label: ELEM_ZH[k] }));
    return { items, tabs };
  }

  function armorItems(D, slot) {
    const zh = (id) => (D.skills[id] && D.skills[id].zh) || (D.skillNames || {})[id] || id;
    const items = D.armor.filter((a) => a.slot === slot).map((a) => ({ value: a.id, label: a.zh || a.name,
      sub: `漂流 ${a.driftSlots}｜` + a.skills.map(([id, l]) => `${zh(id)} ${l}`).join('、'), pre: `漂流 ${a.driftSlots}`,
      skills: a.skills.map(([id]) => id), skillText: a.skills.map(([id, l]) => [id, `${zh(id)} ${l}`]),
      search: a.skills.map(([id]) => zh(id)).join(' ') }));
    return { items };
  }
  function skillGroups(D, ids) {
    const top = (id) => { const s = D.skills[id]; return s ? (s.levels[String(s.max)] || {}) : null; };
    const req = (e) => [...(e.requires || []), ...(e.conflicts || [])].filter((c) => c !== 'monster.weakPoint');
    const has = (e, re) => req(e).some((c) => re.test(c));
    const G = [
      ['atk', '攻擊力', (e) => e.attackUp || e.attackMultiplierPct || e.attackEfficacyMultiplier || e.attackUpPerWeaponAffinityPct],
      ['crit', '會心', (e) => e.affinityDelta > 0 || e.positiveCritMultiplier || e.attackUpPerWeaponAffinityPct || (e.elementMultiplierPct && e.onlyPositiveCrit)],
      ['fero', '凶會心／負會心', (e) => e.brutalCritMultiplier || e.affinityDelta < 0],
      ['elem', '屬性', (e) => e.elementAttackUp || e.elementMultiplierPct],
      ['dmg', '傷害加成', (e) => e.damageMultiplier],
      ['sp', 'SP 技能', (e) => e.onlySp || has(e, /^sp|afterSpecialSkill/)],
      ['evade', '迴避／防禦', (e) => has(e, /perfectEvade|perfectGuard|forwardDodge|noEvade/)],
      ['hp', '體力／獵人狀態', (e) => has(e, /^hp\.|tookDamage|revived|player\.|recovered/)],
      ['status', '魔物異常', (e) => e.requiresWeaponStatus || e.requiresStatusWeapon || has(e, /monster\.(poisoned|paralyzed|sleeping)|statusBuildup|wakeUp/)],
      ['adv', '境界（需前置 Lv5）', (e) => e.requiresSkillLevel],
      ['always', '常駐（無條件）', (e) => !req(e).length && !e.onlySp && !e.requiresSkillLevel],
      ['cond', '條件發動', (e) => req(e).length],
    ];
    const zh = (id) => (D.skills[id] && D.skills[id].zh) || (D.skillNames || {})[id] || id;
    const sortIds = (a) => a.sort((x, y) => zh(x).localeCompare(zh(y), 'zh-Hant'));
    const out = [{ key: 'all', label: '全部', ids: sortIds([...ids]) }];
    for (const [key, label, f] of G) { const g = ids.filter((id) => { const e = top(id); return e && Object.keys(e).length && f(e); }); if (g.length) out.push({ key, label, ids: sortIds(g) }); }
    const other = ids.filter((id) => !top(id) || !Object.keys(top(id)).length);
    if (other.length) out.push({ key: 'other', label: '其他（不影響傷害）', ids: sortIds(other) });
    return out;
  }

  root.MHNPicker = { attach, monsterItems, weaponItems, monsterName, armorItems, skillGroups };
})(window);
