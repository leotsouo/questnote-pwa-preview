import { escapeHtml } from './uiHelpers.js';
import { getTodayDateString } from './taskFilterService.js';
import { CHAPTER_REWARDS, HABIT_TARGETS, DAILY_COMPANION_REWARD,
  createBondJourney, chapterIsAvailable, getBondSummary } from './bondJourneyCore.js';
import { findBondStory } from './bondJourneyService.js';

const button = (label, action, attributes = '', secondary = false) =>
  `<button type="button" class="btn ${secondary ? 'btn--secondary' : 'btn--primary'}" data-bond-action="${action}" ${attributes}>${escapeHtml(label)}</button>`;
const paragraphs = (lines) => lines.map((line) => `<p>${escapeHtml(line).replace(/\n/g, '<br>')}</p>`).join('');
const name = (pet) => pet.nickname || pet.name || '夥伴';
const journeyOf = (state) => state.bondJourney || createBondJourney();

export function renderBondKeepsake(state) {
  const journey = journeyOf(state);
  const story = findBondStory(state.bondStories, journey.displayPetId);
  if (!story || !journey.byPet[journey.displayPetId]?.chapters[5]?.claimedAt) return '';
  const pet = state.enrichedCollection?.find((item) => item.id === journey.displayPetId);
  return `<div class="bond-keepsake-display"><span aria-hidden="true">✧</span><div><strong>${escapeHtml(story.keepsake.name)}</strong><small>來自 ${escapeHtml(name(pet || {}))} 的同行紀念</small></div></div>`;
}

export function renderBondHome(state) {
  const journey = journeyOf(state);
  const pet = state.enrichedCollection?.find((item) => item.id === journey.active?.petId) || state.companion;
  if (!pet) return '';
  const story = findBondStory(state.bondStories, pet.id);
  const summary = getBondSummary(journey, pet, story);
  return `<article class="bond-home card"><div class="bond-home__copy"><span class="bond-eyebrow">我們的同行</span><strong>${escapeHtml(name(pet))}</strong><p id="bond-home-progress" aria-live="polite">${escapeHtml(state.bondJourneyError || summary.hint)}</p></div>
    <button type="button" class="btn btn--secondary" data-bond-open="${escapeHtml(pet.id)}">${summary.active?.status === 'ready' ? '收下回應' : summary.active ? '查看約定' : '故事與約定'}</button>
    ${renderBondKeepsake(state)}</article>`;
}

export function renderBondDetail(pet, state) {
  const summary = getBondSummary(journeyOf(state), pet, findBondStory(state.bondStories, pet.id));
  return `<div class="bond-detail-entry"><p>${escapeHtml(summary.hint)}</p><p class="bond-note">親密度解鎖專屬故事與同行約定；完成約定獲得星塵，Lv.5 故事完成後還有紀念物和日常同行。</p>
    <button type="button" class="btn btn--primary btn--block" data-bond-open="${escapeHtml(pet.id)}">閱讀故事與同行約定</button></div>`;
}

export function renderBondOverview(pet, state, portrait = '') {
  const journey = journeyOf(state);
  const story = findBondStory(state.bondStories, pet.id);
  if (!story) return `<div class="bond-reader"><h2 class="modal-title">夥伴故事</h2><p>這位夥伴的故事暫時無法載入，請稍後重試。</p>${button('重新載入', 'retry')}${button('關閉', 'close', '', true)}</div>`;
  const summary = getBondSummary(journey, pet, story);
  const active = summary.active;
  const other = journey.active && !active;
  const hasKeepsake = Boolean(journey.byPet[pet.id]?.chapters[5]?.claimedAt);
  const claimedToday = journey.dailyClaimDates.includes(getTodayDateString());
  return `<div class="bond-reader" data-bond-screen="overview"><div class="bond-reader__header">${portrait}<div><span class="bond-eyebrow">${escapeHtml(name(pet))} · 親密度 Lv.${pet.bondLevel || 1}</span><h2 class="modal-title">故事與同行約定</h2></div></div>
    <p class="bond-note">聽牠的心事，再從自己的任務或習慣選一件一起做。回應沒有對錯，約定沒有期限。</p>
    ${state.bondJourneyError ? `<p role="alert">${escapeHtml(state.bondJourneyError)}</p>${button('重新載入', 'retry')}` : ''}
    ${active ? renderAgreement(active, state) : ''}
    ${other ? `<div class="bond-agreement"><p>目前有另一份同行約定。完成並領取，或暫停後結束，就能開始新的約定。</p>${button('管理目前約定', 'open-active', '', true)}</div>` : ''}
    <ol class="bond-chapters">${story.chapters.map((chapter) => {
      const progress = journey.byPet[pet.id]?.chapters[chapter.level];
      const available = chapterIsAvailable(journey, pet, chapter.level);
      const label = progress?.claimedAt ? '回看故事' : progress ? '繼續這一章' : available ? '閱讀故事' : '尚未解鎖';
      const lockedReason = (pet.bondLevel || 1) < chapter.level ? `親密度 Lv.${chapter.level} 解鎖` : '完成前一章約定後開放';
      return `<li class="bond-chapter ${progress?.claimedAt ? 'is-complete' : ''}"><div><small>Lv.${chapter.level} · 第 ${chapter.level - 1} 章</small><strong>${escapeHtml(chapter.title)}</strong><p>${progress?.claimedAt ? '已留下同行回憶' : available ? `完成約定：星塵 +${CHAPTER_REWARDS[chapter.level]}` : lockedReason}</p></div>
        ${button(label, 'chapter', `data-level="${chapter.level}" ${available ? '' : 'disabled'}`, true)}</li>`;
    }).join('')}</ol>
    ${hasKeepsake ? `<section class="bond-keepsake"><span class="bond-eyebrow">你的專屬紀念物</span><h3>${escapeHtml(story.keepsake.name)}</h3><p>${escapeHtml(story.keepsake.description)}</p>
      ${button(journey.displayPetId === pet.id ? '收起展示' : '展示在陪伴頁與營地', 'display', '', true)}</section>
      <section class="bond-agreement"><h3>日常同行</h3><p>完成任務或習慣 1 次，星塵 +${DAILY_COMPANION_REWARD}。所有夥伴合計每天可領一次。</p>
      ${claimedToday ? '<p class="bond-note">今天已領取，明天再一起走一小段。</p>' : !journey.active ? button('選擇日常目標', 'select', 'data-level="0"') : ''}</section>` : ''}
    ${button('關閉', 'close', '', true)}</div>`;
}

export function renderAgreement(active, state) {
  const exists = active.sourceType === 'task' ? state.tasks?.some((task) => task.id === active.sourceId)
    : state.habits?.some((habit) => habit.id === active.sourceId && habit.isActive && !habit.archivedAt);
  const reward = active.chapter ? CHAPTER_REWARDS[active.chapter] : DAILY_COMPANION_REWARD;
  return `<section class="bond-agreement" aria-label="目前同行約定"><div class="bond-agreement__heading"><h3>${active.chapter ? '同行約定' : '日常同行'}</h3><span>${active.status === 'ready' ? '已完成' : active.status === 'paused' ? '已暫停' : '進行中'}</span></div>
    <strong>${escapeHtml(active.sourceTitle)}</strong><p aria-live="polite">${active.progress}/${active.target} ${active.sourceType === 'habit' ? '個不同日期的打卡' : '次完成'} · 星塵 +${reward}</p>
    <progress max="${active.target}" value="${active.progress}" aria-label="同行進度"></progress>
    ${!exists && active.status !== 'ready' ? '<p class="bond-note">原目標已刪除或封存。可以更換目標，故事會保留。</p>' : ''}
    <div class="bond-actions">${active.status === 'ready' ? button('收下回應與獎勵', 'claim') : `${exists ? button('前往目標', 'go-source') : ''}
      ${button(active.status === 'paused' ? '繼續約定' : '暫停約定', active.status === 'paused' ? 'resume' : 'pause', '', true)}
      ${button('更換目標', 'replace', '', true)}${active.status === 'paused' ? button('結束約定', 'end', '', true) : ''}`}</div></section>`;
}

export function renderBondChapter(pet, state, level, previewChoice = null) {
  const journey = journeyOf(state);
  const chapter = findBondStory(state.bondStories, pet.id)?.chapters.find((item) => item.level === level);
  if (!chapter || !chapterIsAvailable(journey, pet, level)) return '<p>這一章尚未解鎖。</p>';
  const saved = journey.byPet[pet.id]?.chapters[level];
  const choice = chapter.choices.find((item) => item.id === (previewChoice || saved?.choiceId));
  const active = journey.active?.petId === pet.id && journey.active?.chapter === level ? journey.active : null;
  return `<div class="bond-reader" data-bond-screen="chapter"><span class="bond-eyebrow">${escapeHtml(name(pet))} · 第 ${level - 1}/4 章</span><h2 class="modal-title">${escapeHtml(chapter.title)}</h2>
    <div class="bond-story-text">${paragraphs(chapter.paragraphs)}</div><p class="bond-note">你想怎麼回應牠？兩種回應都能繼續同一段故事。</p>
    <div class="bond-choices">${chapter.choices.map((item) => `<button type="button" class="btn btn--secondary" data-bond-action="choice" data-level="${level}" data-choice="${item.id}" aria-pressed="${choice?.id === item.id}">${escapeHtml(item.label)}</button>`).join('')}</div>
    ${choice ? `<div class="bond-reply" role="status">${paragraphs([choice.reply])}</div>` : ''}
    ${saved?.claimedAt ? `<section class="bond-ending"><h3>約定之後</h3>${paragraphs([chapter.ending])}<p class="bond-note">回看不會改變初次回應，也不會重複領獎。</p></section>`
      : saved ? `${active ? renderAgreement(active, state) : `<section class="bond-agreement"><h3>牠的同行邀請</h3>${paragraphs([chapter.invitation])}<p>選一項未完成任務（1 次），或習慣打卡（${HABIT_TARGETS[level]} 個不同日期）。完成後星塵 +${CHAPTER_REWARDS[level]}，並解鎖故事後續。</p>${journey.active ? '<p class="bond-note">請先管理目前約定，再開始這一章。</p>' + button('管理目前約定', 'open-active', '', true) : button('選擇同行目標', 'select', `data-level="${level}"`)}</section>`}` : ''}
    ${button('返回章節列表', 'overview', '', true)}</div>`;
}

export function renderBondSelector(pet, state, chapter, type, replacing = false) {
  const journey = journeyOf(state);
  const items = type === 'task' ? (state.tasks || []).filter((task) => !task.completed && !journey.usedEventKeys.includes(`task:${task.id}`))
    : (state.habits || []).filter((habit) => habit.isActive && !habit.archivedAt);
  const target = type === 'task' ? 1 : HABIT_TARGETS[chapter];
  return `<div class="bond-reader" data-bond-screen="selector"><span class="bond-eyebrow">與 ${escapeHtml(name(pet))} 同行</span><h2 class="modal-title">${replacing ? '更換同行目標' : '選擇同行目標'}</h2>
    <p>只計入${replacing ? '更換' : '接受'}之後的新完成。沒有期限，也不需要連續打卡。</p>
    ${replacing ? '<p class="bond-note">約定已暫停。更換後進度從 0 開始；已計入的完成紀錄不會再次使用。</p>' : ''}
    <label class="bond-field" for="bond-source-type">目標種類<select class="form-input" id="bond-source-type"><option value="task" ${type === 'task' ? 'selected' : ''}>完成一項任務</option><option value="habit" ${type === 'habit' ? 'selected' : ''}>累積習慣打卡</option></select></label>
    ${items.length ? `<label class="bond-field" for="bond-source-id">選擇目標<select class="form-input" id="bond-source-id"><option value="">請選擇</option>${items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title || item.name)}</option>`).join('')}</select></label>
      <p class="bond-note">需要 ${target} ${type === 'habit' ? '個不同日期的打卡' : '次完成'}；獎勵星塵 +${chapter ? CHAPTER_REWARDS[chapter] : DAILY_COMPANION_REWARD}。</p>${button('接受約定', 'start', 'id="bond-start" disabled')}`
      : `<p>目前沒有可選的${type === 'task' ? '未完成任務' : '有效習慣'}。</p>${button(type === 'task' ? '前往任務頁' : '前往習慣頁', 'go-create')}`}
    ${button('返回約定', 'overview', '', true)}</div>`;
}
