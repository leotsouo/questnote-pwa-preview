/** Shared, escaped presentation. No database, draw, wallet or network side effects. */
export const invitationEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const e = invitationEscape;
export const fragmentMark = () => '<svg class="encounter-fragment-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 25C5 16 10 7 20 5M12 27C24 26 29 17 25 9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="21" cy="6" r="3" fill="currentColor"/></svg>';
const portrait = (pet, size = 'stage') => {
  const url = (path) => new URL('../' + path, import.meta.url).href;
  const source = pet.imageVariants?.[size] || pet.image;
  const fallback = size !== 'card' ? pet.imageVariants?.card : null;
  const onError = "if(this.dataset.fallbackSrc&&this.src!==this.dataset.fallbackSrc){this.src=this.dataset.fallbackSrc;return;}this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{className:'invitation-art-fallback',textContent:'畫作尚未儲存於此裝置，連線後可查看。',role:'img',ariaLabel:this.dataset.petName+'，畫作尚未載入'}))";
  return `<img src="${e(url(source))}" ${fallback ? `data-fallback-src="${e(url(fallback))}"` : ''} data-pet-name="${e(pet.name)}" onerror="${e(onError)}" alt="" decoding="async" ${size === 'card' ? 'loading="lazy"' : 'fetchpriority="high"'}>`;
};
export const invitationCost = (pet) => pet?.rarity === 'UR' ? 200 : pet?.rarity === 'SSR' ? 100 : null;
const identity = (pet) => `<div class="invitation-identity"><h2 class="pet-name">${e(pet.name)}</h2><p class="pet-title">${e(pet.title)}</p><span class="rarity">${e(pet.rarity)}</span></div>`;
export function encounterProgress(balance, target = balance < 100 ? 100 : 200) {
  return balance >= target ? `已足夠指定邀請一位 ${target === 100 ? 'SSR' : 'UR'} 夥伴。` : `再累積 ${target - balance} 枚，就能邀請一位 ${target === 100 ? 'SSR' : 'UR'} 夥伴。`;
}
export function fragmentBalance(balance, { target, compact = false } = {}) {
  return `<div class="encounter-balance ${compact ? 'is-compact' : ''}">${fragmentMark()}<div><span>相遇碎片</span><strong>${balance.toLocaleString('zh-TW')}</strong></div>${compact ? '' : `<p>${encounterProgress(balance, target)}</p>`}</div>`;
}
export function invitationEntry(balance) {
  return `<aside class="invitation-entry"><div>${fragmentMark()}<p><strong>讓下一次相遇，由你決定。</strong><span>相遇碎片 ${balance.toLocaleString('zh-TW')} · ${encounterProgress(balance)}</span></p></div><button data-identity-action="invitation">指定邀請 <span aria-hidden="true">↗</span></button></aside>`;
}
export function reencounterMoment(pet, gain, balance) {
  const greeting = pet.dialogues?.normal?.find((line) => typeof line === 'string' && line.trim());
  return `<section class="reencounter-moment"><p class="eyebrow">再次相遇，留下新的光痕</p>${greeting ? `<blockquote>「${e(greeting)}」</blockquote>` : '<p>熟悉的身影，再一次來到你的旅途中。</p>'}<p class="fragment-received">${fragmentMark()}<strong>+${gain}</strong><span>相遇碎片</span></p><p class="reencounter-note">每次重逢，都讓新的相遇更靠近。</p>${fragmentBalance(balance)}</section>`;
}
export function migrationSummary(receipt, names = new Map()) {
  return `<section class="migration-summary"><div class="invitation-path" aria-hidden="true">${fragmentMark()}</div><p class="eyebrow">旅程，繼續向前</p><h2 class="pet-name">相遇，有了新的意義。</h2><p>過去累積的角色碎片與升星投入，已完整轉為相遇碎片。你記得的夥伴，仍與你同行。</p><p class="migration-total">${fragmentMark()}<strong>${receipt.total.toLocaleString('zh-TW')}</strong><span>相遇碎片</span></p><p class="subtle">收藏、親密度、故事與已取得的探險能力均已保留。</p><details><summary>查看旅程明細</summary><ul>${receipt.items.map((item) => `<li><span>${e(names.get(item.petId) || item.petId)}</span><span>剩餘 ${item.leftover} ＋ 投入 ${item.refund} ＝ ${item.total}</span></li>`).join('')}</ul></details><button class="primary" data-invitation-action="dismiss-migration">繼續旅程</button></section>`;
}
export function intimacySummary(level, specialty, legacyFloor = 1) {
  const stages = ['初識，旅程才剛開始', '熟悉，開始讀懂彼此', '信任，願意一起前行', '默契，同行的步伐更近', '深厚羈絆，故事仍在繼續'];
  return `<section class="intimacy-summary"><p class="eyebrow">相處，讓夥伴成長</p><h3>${stages[Math.max(0, Math.min(4, level - 1))]}</h3><p>親密度 Lv.${level} · ${e(specialty.label)}專長 Lv.${specialty.level}</p><p class="subtle">日常陪伴、任務與共同旅程，逐步培養探險專長。</p>${legacyFloor > level ? '<p class="subtle">過去旅程累積的專長已保留，親密度成長仍會繼續。</p>' : ''}</section>`;
}
export function renderInvitationScreen(model) {
  const { route = 'gallery', balance = 0, selected, error = '', rows = [], rarity = 'all', series = 'all', query = '' } = model;
  if (route === 'migration') return migrationSummary(model.receipt, model.names) + (error ? `<p role="alert">${e(error)}</p>` : '');
  if (route === 'gallery') {
    const groups = [...new Map(rows.map((row) => [row.seriesId, row.seriesName])).entries()];
    const visible = rows.filter((row) => (rarity === 'all' || row.pet.rarity === rarity) && (series === 'all' || row.seriesId === series) && `${row.pet.name} ${row.pet.title || ''}`.toLowerCase().includes(query.toLowerCase()));
    return `<section class="invitation-gallery"><p class="eyebrow">SPECIFIED INVITATION</p><h2 class="pet-name">你想與誰同行？</h2><p class="invitation-intro">讓一路累積的重逢，成為一份送給牠的邀請。</p>${fragmentBalance(balance)}<div class="invitation-filters" aria-label="邀請稀有度">${[['all', '全部'], ['SSR', 'SSR · 100'], ['UR', 'UR · 200']].map(([key, label]) => `<button data-invitation-filter="${key}" aria-pressed="${rarity === key}">${label}</button>`).join('')}</div><details class="invitation-gallery-tools"><summary>按名字或世界尋找</summary><label class="invitation-search">尋找想同行的夥伴<input data-invitation-query type="search" value="${e(query)}" placeholder="名字或稱號"></label><label class="invitation-series-label">相遇的世界<select data-invitation-series><option value="all">全部正式系列</option>${groups.map(([key, name]) => `<option value="${e(key)}" ${series === key ? 'selected' : ''}>${e(name)}</option>`).join('')}</select></label></details><div class="invitation-gallery-list">${visible.map((row, index) => `<article class="invitation-gallery-row"><button data-invitation-pet="${e(row.pet.id)}" aria-label="認識 ${e(row.pet.name)}，${e(row.pet.title)}，${row.pet.rarity}，${row.owned ? '已相遇' : row.available ? '可指定邀請' : e(row.reason)}"><span class="invitation-gallery-art">${portrait(row.pet, 'card')}</span><span class="invitation-gallery-copy"><span class="eyebrow">${e(row.seriesName)}</span><span class="pet-name">${e(row.pet.name)}</span><span class="pet-title">${e(row.pet.title)}</span><span class="identity-cue"><span class="rarity">${row.pet.rarity}</span><span>${row.owned ? '已相遇' : row.available ? '等待你的邀請' : '故事尚未開啟'}</span></span></span><span class="invitation-row-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span></button></article>`).join('') || '<p role="status">這一頁暫時沒有符合條件的夥伴，試試其他名字或系列。</p>'}</div><p class="invitation-footnote">SSR／UR 指定邀請 · 跨卡池共用相遇碎片<br>角色故事與開放條件仍隨原本旅程揭開。</p></section>`;
  }
  if (!selected) return '<p role="alert">這位夥伴的資料尚未載入，請返回重新選擇。</p>';
  const { pet, owned = false, available = true, reason = '' } = selected;
  const cost = invitationCost(pet);
  const intro = (pet.description || pet.lore || '').split(/(?<=[。！？])/).slice(0, 2).join('');
  if (route === 'detail' || route === 'confirm') {
    return `<section class="invitation-character"><button class="text-button" data-invitation-action="${route === 'confirm' ? 'detail' : 'gallery'}">← ${route === 'confirm' ? '返回夥伴預覽' : '返回指定邀請'}</button><div class="invitation-portrait">${portrait(pet)}</div>${identity(pet)}<p class="invitation-character-intro">${e(intro)}</p>${route === 'confirm' ? `<div class="invitation-confirm-copy"><h3>讓這次相遇，成為同行。</h3><p>消耗 ${cost} 枚相遇碎片，邀請${e(pet.name)}加入你的旅程。</p><p class="subtle">邀請後剩餘 ${Math.max(0, balance - cost)} 枚。</p></div>` : `<p class="invitation-availability">${owned ? '已相遇 · 這位夥伴已在你的旅途中' : !available ? e(reason) : '尚未相遇 · 可指定邀請'}</p><div class="invitation-cost">${fragmentMark()}<p><strong>${cost}</strong> 相遇碎片<span>目前持有 ${balance}</span></p></div>`}${error ? `<p class="invitation-error" role="alert">${e(error)}</p>` : ''}${!owned && available && balance < cost ? `<p class="invitation-error" role="status">再累積 ${cost - balance} 枚相遇碎片，就能邀請牠。每次重逢都會留下進度。</p>` : ''}<div class="invitation-primary-action"><button class="primary" data-invitation-action="${route === 'confirm' ? 'commit' : 'confirm'}" ${owned || !available || balance < cost || model.busy ? 'disabled' : ''}>${model.busy ? '正在送出邀請…' : owned ? '已相遇' : !available ? '等待故事開啟' : balance < cost ? '相遇碎片尚不足' : route === 'confirm' ? '送出邀請' : '邀請這位夥伴'}</button></div></section>`;
  }
  if (route === 'ceremony') return `<p role="status">${e(pet.name)}已接受邀請，正在準備角色登場演出。</p>`;
  return `<section class="invitation-arrival" data-motion="${model.reduceMotion ? 'reduced' : 'full'}"><p class="eyebrow">一份邀請，一段新的同行</p><div class="invitation-arrival-art"><div class="invitation-path" aria-hidden="true">${fragmentMark()}</div>${portrait(pet)}</div>${identity(pet)}<p class="invitation-welcome">牠接受了你的邀請。</p><p class="subtle">${e(pet.name)}已加入收藏。故事，從相處開始。</p><div class="invitation-primary-action"><button class="primary" data-invitation-action="companion" ${model.busy || model.companionSet ? 'disabled' : ''}>${model.companionSet ? '正在與你同行' : '設為同行夥伴'}</button><button data-invitation-action="close">繼續旅程</button><button class="text-button" data-invitation-action="replay">重看角色登場</button></div><p class="invitation-footnote">本次邀請 ${cost} 枚 · 剩餘 ${balance} 枚相遇碎片</p>${error ? `<p role="alert">${e(error)}</p>` : ''}</section>`;
}

/** The controller only invokes injected committed actions. Replays are presentation-only. */
export function createInvitationController(host, actions) {
  let model = {}; let opener = null; let generation = 0; let arrivalRun = 0; let suspendedCloseEvents = 0;
  const redraw = (focus = true) => { host.setAttribute('aria-label', model.route === 'migration' ? '相遇，有了新的意義' : '指定邀請'); host.innerHTML = `<div class="invitation-dialog-header"><span>指定邀請</span><button data-invitation-action="close" aria-label="關閉指定邀請" ${model.busy ? 'disabled' : ''}>關閉</button></div><div class="invitation-content">${renderInvitationScreen(model)}</div><div class="sr-only" role="status" aria-live="polite">${model.announcement || ''}</div>`; if (focus) host.querySelector('button')?.focus(); };
  const finishArrival = () => { model.route = 'result'; model.announcement = `${model.selected.pet.name}接受了你的邀請，已加入收藏。`; redraw(); };
  const arrival = async () => {
    const current = generation; const run = ++arrivalRun;
    model.announcement = ''; model.error = '';
    if (model.reduceMotion) { finishArrival(); return; }
    model.route = 'ceremony'; redraw();
    // The existing pool reveal lives on body. Suspend the native dialog so its
    // top layer cannot cover the character animation or make its skip inert.
    const previousHidden = host.hidden;
    const suspended = Boolean(host.open && host.close);
    host.hidden = true;
    if (suspended) { suspendedCloseEvents++; host.close(); }
    try { await actions.playArrival?.({ selected:model.selected, reduceMotion:model.reduceMotion }); }
    catch { if (current === generation && run === arrivalRun) model.error = '夥伴已加入收藏；登場演出暫時無法播放，可稍後重看。'; }
    finally {
      if (current === generation && run === arrivalRun) {
        host.hidden = previousHidden;
        finishArrival();
        if (suspended && !host.open) host.showModal();
        host.querySelector('[data-invitation-action="companion"]:not(:disabled)')?.focus();
      }
    }
  };
  const close = async () => { if (model.busy || model.route === 'ceremony') return; if (model.route === 'migration') { model.busy = true; try { await actions.dismissMigration?.(); } catch (error) { model.busy = false; model.error = error.message; redraw(); return; } model.busy = false; } generation++; if (host.open) host.close(); else actions.close?.(); if (opener?.isConnected) opener.focus(); };
  host.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  host.addEventListener('close', () => { if (suspendedCloseEvents) { suspendedCloseEvents--; return; } generation++; if (opener?.isConnected) opener.focus(); });
  host.addEventListener('click', async (event) => {
    const button = event.target.closest('button'); if (!button || model.busy || model.route === 'ceremony') return;
    if (button.dataset.invitationPet) { model.selected = model.rows.find((row) => row.pet.id === button.dataset.invitationPet); model.route = 'detail'; model.error = ''; redraw(); return; }
    if (button.dataset.invitationFilter) { model.rarity = button.dataset.invitationFilter; redraw(false); host.querySelector(`[data-invitation-filter="${model.rarity}"]`)?.focus(); return; }
    const action = button.dataset.invitationAction;
    if (['gallery', 'detail', 'confirm'].includes(action)) { model.route = action; model.error = ''; redraw(); }
    if (action === 'close') close();
    if (action === 'replay') await arrival();
    if (action === 'dismiss-migration') await close();
    if (action === 'commit') {
      const current = generation; model.busy = true; model.error = ''; redraw();
      try { const result = await actions.invite(model.selected.pet.id); if (current !== generation) return; model.balance = result.balance; model.selected.owned = true; model.busy = false; }
      catch (error) { if (current !== generation) return; model.busy = false; model.error = ['QuotaExceededError','AbortError','UnknownError','InvalidStateError','DataCloneError'].includes(error.name) ? '裝置暫時無法儲存這份邀請，尚未扣除相遇碎片。請檢查可用空間後再試。' : error.message || '邀請尚未送出，請稍後再試。'; model.route = 'detail'; actions.refreshModel?.(model); redraw(); return; }
      await arrival();
    }
    if (action === 'companion') {
      model.busy = true; redraw();
      try { await actions.setCompanion(model.selected.pet.id); model.companionSet = true; model.announcement = `${model.selected.pet.name}正在與你同行。`; }
      catch (error) { model.error = error.message || '尚未切換同行夥伴，請稍後再試。'; }
      finally { model.busy = false; redraw(); }
    }
  });
  host.addEventListener('input', (event) => { if (!event.target.hasAttribute('data-invitation-query')) return; const input = event.target; model.query = input.value; const start = input.selectionStart; redraw(false); const replacement = host.querySelector('[data-invitation-query]'); replacement.focus(); try { replacement.setSelectionRange(start, start); } catch {} });
  host.addEventListener('change', (event) => { if (event.target.hasAttribute('data-invitation-series')) { model.series = event.target.value; redraw(false); host.querySelector('[data-invitation-series]')?.focus(); } });
  return { open(next) { generation++; opener = document.activeElement; model = { rarity: 'all', series: 'all', query: '', ...next }; host.hidden = false; redraw(false); if (host.showModal && !host.open) host.showModal(); host.querySelector('button')?.focus(); if (model.route === 'ceremony') void arrival(); }, close };
}
