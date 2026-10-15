import { DEMON_QUESTION, needsDemonFinalTask, findDemonFinalTask, demonFinalTaskComplete } from './demonFinalTaskCore.js';
import { AWAKENING_PROFILES, getAwakeningProfile, getPoolAwakeningProfile } from './petAwakeningProfiles.js';
const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Presentation only: the draw catalog and persisted ownership remain canonical.
export function initialAwakeningPortrait(pet, catalog) {
  const entry = catalog?.pets?.find((p) => p.petId === pet?.id);
  if (!entry?.initialImage) return pet;
  return { ...pet, image: entry.initialImage.original,
    imageVariants: { card: entry.initialImage.card, stage: entry.initialImage.stage },
    fallbackImage: entry.initialImage.original };
}
export function awakeningPortrait(pet, state, catalog) {
  const progress = state?.byPet?.[pet?.id];
  const entry = catalog?.pets?.find((p) => p.petId === pet?.id);
  if (!entry) return pet;
  if (!progress?.awakenedAt || pet.owned === false) return initialAwakeningPortrait(pet, catalog);
  const base = { ...pet, awakeningDialogue: entry.dialogue, awakenedAt: progress.awakenedAt };
  const image = progress.form === 'initial' ? entry.initialImage : entry.awakenedImage;
  return image ? { ...base, image: image.original,
    imageVariants: { card: image.card, stage: image.stage }, fallbackImage: pet.image,
    fallbackImageVariants: pet.imageVariants } : base;
}
export function renderAwakeningGuide({ compact = false, poolId } = {}) {
  if (!poolId) return compact ? renderAwakeningGuide({ compact, poolId: 'swordwild_shanhe_v3' }) : AWAKENING_PROFILES.map(profile=>renderAwakeningGuide({poolId:profile.poolId})).join('');
  const profile = getPoolAwakeningProfile(poolId);
  if (!profile) return '';
  const { areaName, foodName } = profile;
  const title = compact ? `初遇只是開始 · ${profile.countLabel}` : `${profile.name} · 羈絆覺醒教學`;
  return `<h2>${title}</h2>${compact ? '' : `<p>${profile.countLabel}</p>`}<p>召喚結果呈現「初遇相」。在卡池點開可覺醒夥伴的卡片，即可翻面預覽全彩覺醒造型；培養羈絆、完成覺醒後，開放雙形態切換與專屬演出。</p>
    <ol><li><strong>培養羈絆</strong>：擁有角色，親密度達 Lv.5，並領取該角色 Lv.5 同行故事獎勵。</li>
    <li><strong>接下守諾試煉</strong>：到「圖鑑 → 角色詳情 → 羈絆覺醒」。接下後完成三筆任務／習慣，並讓牠參加一次接下後出發的${areaName}派遣，再領取派遣獎勵。</li>
    ${needsDemonFinalTask(profile.petIds[0]) ? '<li><strong>? ? ?</strong>：完成守諾試煉後，夥伴還有一個問題想問你。</li>' : ''}
    <li><strong>完成覺醒儀式</strong>：試煉保證取得專屬信物；使用信物一枚與${foodName}一份，開放初遇／覺醒雙形態、覺醒篇章、稱號與陪伴回應。</li></ol>
    ${compact ? '' : `<p>一次進行一隻試煉，可暫停、換角再恢復，進度保留；暫停期間不計入新事件。既有日常紀錄與先前出發的派遣不計入，原本同行約定可同時進行。材料不足時，完成的試煉會保留，可到工坊製作${foodName}。</p><p>覺醒後可在角色詳情切換形態、重播演出；稱號到稱號管理自行裝備。已覺醒夥伴會保留你的形態選擇。</p>`}
    <p>覺醒是可選的成長旅程，各稀有度成本相同；不扣親密度、星塵或碎片，也不改變稀有度、抽卡機率或派遣收益。</p>
    ${compact ? '<button type="button" class="btn btn--secondary" data-action="show-awakening-guide">查看完整覺醒教學</button>' : '<div class="awakening-panel__actions"><button type="button" class="btn btn--secondary" data-goto="collection">前往圖鑑</button><button type="button" class="btn btn--ghost" data-goto="workshop">前往工坊</button></div>'}`;
}
export function renderAwakeningDetail(pet, state) {
  const entry = state.awakeningCatalog?.pets.find((p) => p.petId === pet.id);
  if (!entry) return '';
  const p = state.petAwakening?.byPet[pet.id];
  const ready = (pet.bondLevel || 1) >= 5 && state.bondJourney?.byPet[pet.id]?.chapters?.[5]?.claimedAt;
  const profile = getAwakeningProfile(pet.id);
  const hint = p?.awakenedAt ? '已覺醒 · 可切換形態與重播演出' : p?.status === 'ready' ? needsDemonFinalTask(pet.id) && !demonFinalTaskComplete(state.tasks, pet.id) ? (findDemonFinalTask(state.tasks, pet.id) ? '最後一關 · 惡魔的趣味' : '最後一關 · ? ? ?') : '信物已取得 · 等待完成儀式'
    : p ? `日常完成 ${p.eventKeys.length}/3 · ${profile.journeyLabel} ${p.expeditionKey ? 1 : 0}/1${p.status === 'paused' ? ' · 已暫停' : ''}`
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
  const profile = getAwakeningProfile(id);
  return `<section class="awakening-panel awakening-home"><h3>${escape(entry.name)} · ${escape(entry.trialTitle)}</h3><p>${p.status === 'ready' ? needsDemonFinalTask(id) && !demonFinalTaskComplete(state.tasks, id) ? (findDemonFinalTask(state.tasks, id) ? '最後一關：完成惡魔的趣味，沒有完成期限。' : '最後一關 · ? ? ?：夥伴有一個問題想問你。') : '信物已取得，準備與牠共赴此約。' : `日常完成 ${p.eventKeys.length}/3 · ${profile.journeyLabel} ${p.expeditionKey ? 1 : 0}/1${p.status === 'paused' ? ' · 已暫停' : ''}`}</p><button type="button" class="btn btn--secondary" data-awake-detail="${escape(id)}">前往角色詳情繼續旅程</button></section>`;
}
export function awakeningWizardStep(pet, state) {
  if (state.awakeningError) return 'error';
  const p = state.petAwakening?.byPet?.[pet.id];
  if (!pet.owned) return 'owned';
  if (p?.awakenedAt) return 'done';
  if ((pet.bondLevel || 1) < 5) return 'bond';
  if (!state.bondJourney?.byPet?.[pet.id]?.chapters?.[5]?.claimedAt) return 'story';
  if (p?.status === 'paused') return state.petAwakening?.activePetId ? 'conflict' : 'paused';
  if (!p) return state.petAwakening?.activePetId ? 'conflict' : 'start';
  if (p.eventKeys.length < 3) return 'daily';
  if (!p.expeditionKey) return 'expedition';
  if (p.status !== 'ready' || !p.tokenGrantedAt || p.tokenConsumedAt) return 'error';
  if (needsDemonFinalTask(pet.id) && !demonFinalTaskComplete(state.tasks, pet.id)) return findDemonFinalTask(state.tasks, pet.id) ? 'demon-task' : 'demon-question';
  return (state.inventory?.items?.[getAwakeningProfile(pet.id)?.foodId] || 0) >= 1 ? 'ritual' : 'food';
}

export function renderAwakeningReader(pet, state, portrait = '') {
  const entry = state.awakeningCatalog?.pets.find((p) => p.petId === pet.id);
  if (!entry) return '<p>這位夥伴尚未開放覺醒。</p>';
  const p = state.petAwakening?.byPet?.[pet.id];
  const step = awakeningWizardStep(pet, state);
  const profile = getAwakeningProfile(pet.id);
  const { areaName, foodName, journeyLabel } = profile;
  const food = state.inventory?.items?.[profile.foodId] || 0;
  const button = (action, label, primary = false) => `<button class="btn ${primary ? 'btn--primary' : 'btn--secondary'}" type="button" data-awake-action="${action}">${label}</button>`;
  const steps = {
    owned: ['先和這位夥伴相遇，好嗎？', '收藏之後，這段守諾旅程才屬於你們。', '目前尚未收藏。', 'summon', `前往${profile.name}召喚`],
    bond: ['先讓你們更熟悉彼此，好嗎？', '等牠願意把最後一段同行故事交給你。', `親密度 Lv.${pet.bondLevel || 1} / Lv.5`, 'bond', '前往親密度養成'],
    story: ['聽聽牠最後一段同行故事，好嗎？', '讀完故事並領取 Lv.5 獎勵，才能接下新的約定。', '親密度已達 Lv.5；最後一章尚未領獎。', 'story', '開啟同行故事'],
    start: ['願意和牠接下這個約定嗎？', entry.invitation, `接下後完成三筆新任務／習慣，及一次牠參隊的新${areaName}派遣領獎；兩項可並行。`, 'start', '接下守諾試煉'],
    conflict: ['要把目前的約定先暫停嗎？', '一次只陪一位夥伴完成試煉。另一位的既有進度會保留。', '暫停另一位後，接下或恢復這位夥伴的約定。', 'switch', '暫停另一位，繼續此約'],
    paused: ['要繼續你們的約定嗎？', '上次留下的腳步還在，從這裡繼續就好。', `日常 ${p?.eventKeys.length || 0}/3 · ${journeyLabel} ${p?.expeditionKey ? 1 : 0}/1。暫停期間不計入。`, 'start', '恢復試煉'],
    daily: ['今天，先一起完成一件小事？', '每一筆新完成，都讓你們更靠近這個約定。', `接下後的新任務／習慣 ${p?.eventKeys.length || 0}/3；還差 ${3 - (p?.eventKeys.length || 0)} 筆。`, 'daily', '前往今日任務／習慣'],
    expedition: [`一起走一趟${areaName}，好嗎？`, '讓牠加入隊伍，帶著你們的約定出發。', '必須接下後出發；牠當隊長或隊員皆可，領取派遣獎勵才算完成。', 'expedition', `前往${areaName}`],
    'demon-question': ['? ? ?', DEMON_QUESTION, '', 'answer', '回答這個可怕的傢伙'],
    'demon-task': ['惡魔的趣味 · 等待你完成', '夥伴記住了你的回答，並將它設為今日任務。這個約定不能編輯、刪除或移出今日，只能完成；沒有截止日，完成後才能最終覺醒。', findDemonFinalTask(state.tasks, pet.id)?.content.split('\n').slice(1).join('\n') || '', 'daily', '前往完成惡魔的趣味'],
    food: [`準備一份${foodName}，好嗎？`, '信物已經在你手中，儀式還差最後一份心意。', `${entry.tokenName} 1 枚已保留 · ${foodName}需要 1 份，目前 ${food} 份。`, 'workshop', '前往工坊製作'],
    ritual: ['準備與牠共赴此約了嗎？', '你們走過的每一步，都已成為彼此的承諾。', `全部條件已核對。儀式會使用「${entry.tokenName} 1 枚＋${foodName} 1 份」。`, 'awaken', `完成覺醒 · 使用信物與${foodName}`],
    error: ['重新核對你們的旅程，好嗎？', '覺醒紀錄暫時無法核對，原始資料已保留。', '請重試，確認完成紀錄後再繼續。', 'retry', '重新讀取進度'],
  };
  let body = '';
  if (step === 'done') {
    body = `<p class="awakening-mark">✓ 已覺醒 · ${escape(entry.title)}</p><h2 id="awakening-question" tabindex="-1">牠以新的姿態，繼續與你同行。</h2>${entry.story.map((text) => `<p>${escape(text)}</p>`).join('')}
      <p>目前：${p.form === 'initial' ? '初遇相' : '覺醒相'}。形態不影響稀有度或派遣收益。</p>
      <div class="awakening-panel__actions">${button(p.form === 'initial' ? 'awakened' : 'initial', p.form === 'initial' ? '切換覺醒相' : '切換初遇相', true)}${button('replay', '重播覺醒演出')}</div>
      <p>稱號「${escape(entry.title)}」已開放，可到稱號管理裝備。</p>`;
  } else {
    const [question, words, fact, action, label] = steps[step];
    body = `${step === 'demon-task' ? '<p class="awakening-mark">哈、哈、哈……</p>' : ''}<h2 id="awakening-question" tabindex="-1">${escape(question)}</h2><p class="awakening-wizard__message">${escape(words)}</p>${fact ? `<p>${escape(fact)}</p>` : ''}${step === 'demon-question' ? '<label for="demon-final-answer">你的回答（必填）</label><textarea id="demon-final-answer" rows="5" maxlength="2000" required placeholder="寫下那件一直想完成、對自己有幫助的事"></textarea>' : ''}${step === 'daily' ? `<progress value="${p.eventKeys.length}" max="3" aria-label="日常完成進度"></progress>` : ''}<div class="awakening-panel__actions">${button(action, label, true)}</div>`;
    if (step === 'daily' && !p.expeditionKey) body += `<div class="awakening-panel__actions">${button('expedition', `也可以先去${journeyLabel}`)}</div>`;
  }
  const conditions = [
    [pet.owned, '已收藏這位夥伴'], [(pet.bondLevel || 1) >= 5, '親密度 Lv.5'],
    [state.bondJourney?.byPet?.[pet.id]?.chapters?.[5]?.claimedAt, '已領取 Lv.5 同行故事獎勵'],
    [p, `已接下試煉${p?.status === 'paused' ? '（已暫停）' : ''}`], [p?.eventKeys.length === 3, `日常完成 ${p?.eventKeys.length || 0}/3`],
    [p?.expeditionKey, `${areaName}同行 ${p?.expeditionKey ? 1 : 0}/1`], [p?.tokenGrantedAt, `${entry.tokenName}：${p?.tokenConsumedAt ? '已使用' : p?.tokenGrantedAt ? '已取得 1 枚' : '完成試煉保證取得'}`],
    [food >= 1 || p?.awakenedAt, `${foodName}：${p?.awakenedAt ? '儀式已使用 1 份' : `需要 1 份，目前 ${food} 份`}`],
  ];
  if (needsDemonFinalTask(pet.id)) conditions.push([p?.awakenedAt || demonFinalTaskComplete(state.tasks, pet.id), findDemonFinalTask(state.tasks, pet.id) || p?.awakenedAt ? '已回答並完成惡魔的趣味（無期限）' : '? ? ?']);
  return `<section class="awakening-reader awakening-wizard" data-awakening-pet="${escape(pet.id)}" data-awakening-step="${step}"><header><p class="awakening-wizard__eyebrow">${profile.eyebrow} · 羈絆覺醒</p><h3>${escape(pet.name)} · ${escape(entry.trialTitle)}</h3></header><div class="awakening-wizard__layout"><div class="awakening-wizard__portrait">${portrait}</div><div class="awakening-wizard__stage" aria-labelledby="awakening-question">${body}<p data-awake-error class="awakening-error" role="alert"></p></div></div>${step === 'error' ? '' : `<details class="awakening-wizard__conditions"><summary>查看全部條件與目前進度</summary><ul>${conditions.map(([ok, text]) => `<li>${ok ? '✓' : '○'} ${escape(text)}</li>`).join('')}</ul><p>只計入接下／恢復後的新完成；派遣必須接下後出發、參隊並領獎。暫停不清空進度。完成後開放雙形態、覺醒篇章、稱號與專屬陪伴回應。</p></details>`}<div class="awakening-panel__actions">${button('close', '稍後繼續 · 返回角色詳情')}${p?.status === 'active' ? button('pause', '暫停試煉') : ''}</div><p class="awakening-wizard__note">離開會保留進度，試煉仍繼續計入；只有暫停停止計入。覺醒是可選養成，不扣親密度、星塵或碎片。</p></section>`;
}
