const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function awakeningPortrait(pet, state, catalog) {
  const progress = state?.byPet?.[pet?.id];
  const entry = catalog?.pets?.find((p) => p.petId === pet?.id);
  if (!progress?.awakenedAt || !entry || pet.owned === false) return pet;
  const base = { ...pet, awakeningDialogue: entry.dialogue, awakenedAt: progress.awakenedAt };
  const image = progress.form === 'initial' ? entry.initialImage : entry.awakenedImage;
  return image ? { ...base, image: image.original,
    imageVariants: { card: image.card, stage: image.stage }, fallbackImage: pet.image,
    fallbackImageVariants: pet.imageVariants } : base;
}
export function renderAwakeningDetail(pet, state) {
  const entry = state.awakeningCatalog?.pets.find((p) => p.petId === pet.id);
  if (!entry || !pet.owned) return '';
  const p = state.petAwakening?.byPet[pet.id];
  const ready = (pet.bondLevel || 1) >= 5 && state.bondJourney?.byPet[pet.id]?.chapters?.[5]?.claimedAt;
  const hint = p?.awakenedAt ? '已覺醒 · 可切換形態與重播演出' : p?.status === 'ready' ? '信物已取得 · 等待完成儀式'
    : p ? `日常完成 ${p.eventKeys.length}/3 · 古道同行 ${p.expeditionKey ? 1 : 0}/1${p.status === 'paused' ? ' · 已暫停' : ''}`
      : ready ? '牠想和你一起完成一個新的約定' : '親密度 Lv.5 並完成最後一章同行故事後開放';
  return `<section class="awakening-panel"><h3>羈絆覺醒${p?.awakenedAt ? ' · 已覺醒' : ''}</h3><p>${escape(hint)}</p><button type="button" class="btn btn--secondary" data-awake-open="${escape(pet.id)}">${p?.awakenedAt ? '查看覺醒與形態' : '查看守諾試煉'}</button></section>`;
}
export function renderAwakeningHome(state) {
  if (state.awakeningError) return '<section class="awakening-panel awakening-home"><p class="awakening-error">覺醒紀錄暫時無法載入，原始資料已保留。</p></section>';
  const s = state.petAwakening;
  const id = s?.activePetId || Object.keys(s?.byPet || {}).find((id) => s.byPet[id].status === 'ready')
    || Object.keys(s?.byPet || {}).find((id) => s.byPet[id].status === 'paused');
  const entry = state.awakeningCatalog?.pets.find((p) => p.petId === id);
  if (!entry) return '';
  const p = s.byPet[id];
  return `<section class="awakening-panel awakening-home"><h3>${escape(entry.name)} · ${escape(entry.trialTitle)}</h3><p>${p.status === 'ready' ? '信物已取得，準備與牠共赴此約。' : `日常完成 ${p.eventKeys.length}/3 · 古道同行 ${p.expeditionKey ? 1 : 0}/1${p.status === 'paused' ? ' · 已暫停' : ''}`}</p><button type="button" class="btn btn--secondary" data-awake-open="${escape(id)}">查看覺醒試煉</button></section>`;
}
export function renderAwakeningReader(pet, state, portrait) {
  const entry = state.awakeningCatalog?.pets.find((p) => p.petId === pet.id);
  if (!entry) return '<p>這位夥伴尚未開放覺醒。</p>';
  const p = state.petAwakening?.byPet[pet.id];
  const eligible = (pet.bondLevel || 1) >= 5 && state.bondJourney?.byPet[pet.id]?.chapters?.[5]?.claimedAt;
  const activeId = state.petAwakening?.activePetId;
  const another = activeId && activeId !== pet.id;
  const food = state.inventory?.items?.item_pine_trail_riceball || 0;
  const button = (action, label, disabled = false) => `<button class="btn btn--secondary" type="button" data-awake-action="${action}"${disabled ? ' disabled' : ''}>${label}</button>`;
  let body = '';
  if (p?.awakenedAt) {
    body = `<p class="awakening-mark">已覺醒 · ${escape(entry.title)}</p>${entry.story.map((text) => `<p>${escape(text)}</p>`).join('')}
      <h3>形態選擇</h3><p>目前：${p.form === 'initial' ? '初遇相' : '覺醒相'}。形態不影響稀有度、星級或派遣收益。</p>
      <div class="awakening-panel__actions">${button('initial', '初遇相', p.form === 'initial')}${button('awakened', '覺醒相', p.form === 'awakened')}${button('replay', '重播覺醒演出')}</div>
      <p>稱號「${escape(entry.title)}」已開放，可到稱號管理裝備。</p>`;
  } else {
    body = `<p>${escape(entry.invitation)}</p><p>親密度 Lv.5：${(pet.bondLevel || 1) >= 5 ? '已達成' : '尚未達成'}<br>Lv.5 同行故事：${state.bondJourney?.byPet[pet.id]?.chapters?.[5]?.claimedAt ? '已完成' : '尚未完成'}</p>`;
    if (p) body += `<h3>守諾試煉${p.status === 'paused' ? ' · 已暫停' : ''}</h3><p>日常完成 ${p.eventKeys.length}/3</p><progress value="${p.eventKeys.length}" max="3" aria-label="日常完成進度"></progress><p>雲棧古道同行 ${p.expeditionKey ? 1 : 0}/1</p><p>只計入接下後的新完成與參隊派遣領獎；暫停期間不計入。</p>`;
    else body += '<p>接下後，完成三筆任務／習慣，並與牠走一次雲棧古道、領取派遣獎勵。</p>';
    body += `<h3>覺醒儀式</h3><p>${escape(entry.tokenName)}：${p?.tokenGrantedAt ? '已取得 1 枚' : '完成試煉保證取得'}<br>松香行旅糰：需要 1 份，目前 ${food} 份</p><p>完成後開放雙形態、覺醒篇章、稱號「${escape(entry.title)}」與專屬陪伴回應。</p><div class="awakening-panel__actions">`;
    if (p?.status === 'ready') body += button('awaken', '與牠共赴此約', food < 1) + (food < 1 ? button('workshop', '前往工坊製作') : '');
    else if (p?.status === 'active') body += button('pause', '暫停試煉') + button('expedition', '前往雲棧古道');
    else if (another) body += '<p>另一位夥伴正在試煉；暫停後可切換，進度會保留。</p>' + button('pause-other', '暫停目前試煉');
    else body += button('start', p ? '恢復試煉' : '接下守諾試煉', !eligible);
    body += '</div>';
  }
  return `<section class="awakening-reader"><h2>${escape(pet.name)} · ${escape(entry.trialTitle)}</h2>${portrait}${body}<p data-awake-error class="awakening-error" role="alert"></p><div class="awakening-panel__actions">${button('close', '關閉')}</div></section>`;
}
