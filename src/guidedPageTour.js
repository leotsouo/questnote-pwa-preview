/** Resumable page lessons. Navigation never performs a paid or destructive action. */
import { dbGet, dbUpdateRecord, STORES } from './db.js';

export const PAGE_TOUR_KEY = 'guidedPageTourV1';
export const PAGE_LESSONS = Object.freeze([
  ['tasks', '任務：今日、全部與智慧視圖', '「今日」看今天安排的事；「全部」找其他日期的任務；「智慧」依條件整理。新增自己的任務時，可以展開分類、日期與子任務，讓大目標分成小步驟。', '#task-view-tabs'],
  ['tasks', '夥伴：日常互動與故事', '點首頁的夥伴可看詳情，也可以撫摸、餵食。親密度累積後，從「故事與約定」查看已解鎖的故事與同行目標。餵食前先確認物品。', '#bond-journey-home'],
  ['tasks', '每日祝福與信箱', '首頁的「每日祝福」可查看今天的簽到與祝福。信箱會顯示公告及可領取的禮物；先閱讀內容，再決定領取。教學不會代你簽到或領取。', '#btn-global-mailbox'],
  ['collection', '圖鑑：找到你的夥伴', '這裡收錄所有夥伴。「已相遇」能幫你找到自己擁有的夥伴；未相遇的卡片也可以先看看。', '[data-filter="owned"]'],
  ['collection', '陪伴、相遇與親密度', '點已相遇的夥伴，可查看詳情與「設為陪伴」。重逢得到的相遇碎片用來指定邀請新夥伴；任務、摸摸與送禮累積親密度。先閱讀條件，再決定要不要操作。', '#collection-companion'],
  ['gacha', '召喚：先認識這次的相遇', '看看目前卡池的夥伴、卡池詳情與機率。切換卡池可以認識其他系列，不必立即召喚。', '[data-identity-action="probability"]'],
  ['gacha', '星塵與召喚費用', '完成自己的任務會累積星塵。召喚前先確認餘額與單次、十連的費用；按下召喚會花費星塵。教學不要求召喚。', '.summon-wallet'],
  ['expedition', '探險：先看能量與目的地', '完成任務獲得冒險能量。每個地區有不同時間、能量需求與收穫；先閱讀地區資訊，再選適合的目的地。', '#expedition-energy'],
  ['expedition', '派遣、等待與領取', '在地區選擇隊伍，查看夥伴專長與出發條件。確認後才派遣；時間到，回到這裡領取收穫、閱讀報告。現在可以只看，不必出發。', '#expedition-areas'],
  ['workshop', '工坊：材料變成禮物', '在製作分頁看配方、已有材料與製作數量。材料不足時先去探險收集；確認製作才扣除材料。', '#workshop-tabs'],
  ['workshop', '把心意送給夥伴', '切到送禮分頁，選擇已有的禮物與已相遇的夥伴，查看喜好與效果後再確認。送禮會消耗物品，也會增加親密度。', '#workshop-tabs'],
  ['habits', '習慣：適合每天重複的小事', '任務是要完成的一件事；習慣適合每天練習。點「新增習慣」，設定一個小目標；可以先看表單，再取消。', '#btn-add-habit'],
  ['habits', '今天做到了，就打卡', '回到習慣列表，為今天做到的習慣打卡。統計會逐漸累積；不用一次建立很多個，也不用為了教學新增。', '#habit-stats'],
  ['achievements', '成就：看見慢慢累積的進步', '自己的任務、收集與冒險會累積成就進度。到這裡查看條件、完成的成就與稱號；練習任務不會計入正式成就。', null],
  ['handbook', '冒險手冊：不知道下一步時來看看', '手冊整理目前目標與進度。閱讀各項條件，再選想做的方向；有可領取的獎勵時，再按領取。', null],
  ['settings', '設定：讓畫面適合自己', '調整主題、字體大小與減少動態效果。每個人閱讀速度不同，可以停在這一步慢慢調整，再繼續。', null],
  ['settings', '提醒與備份：照自己的節奏', '提醒可以依需要開啟，瀏覽器會另外詢問通知權限。換裝置前先匯出備份；匯入前閱讀預覽，確認內容再還原。', null],
  ['feedback', '問題回報：先預覽，再送出', '選擇類型，描述發生的問題與重現步驟，再預覽回報內容。只有按「送出回報」才交給開發者；請勿填入密碼或私人任務內容。現在只需認識入口。', '#feedback-type'],
  ['share', '分享：把 QuestNote 介紹給朋友', '這裡可以取得正式版連結，依自己方便的方式分享給朋友。教學不會自動傳送訊息；測試版的本機網址只適合這台電腦使用。', null],
  ['more', '更多：之後從這裡繼續', '習慣、工坊、成就、手冊與設定都能從「更多」找到。「使用教學」可重看基本操作與各頁教學。接下來，新增一件自己的小事吧。', null],
].map(([view, title, body, target]) => Object.freeze({ view, title, body, target })));

export function transitionPageTour(raw, action, expectedCursor) {
  const state = { key: PAGE_TOUR_KEY, version: 1, cursor: 0, status: 'idle', ...raw };
  state.cursor = Math.max(0, Math.min(PAGE_LESSONS.length - 1, Number.isInteger(state.cursor) ? state.cursor : 0));
  if (action === 'start') return { ...state, status: 'active', cursor: state.status === 'paused' ? state.cursor : 0 };
  if (state.status !== 'active' || (expectedCursor !== undefined && expectedCursor !== state.cursor)) return state;
  if (action === 'pause') return { ...state, status: 'paused' };
  if (action === 'next') return state.cursor === PAGE_LESSONS.length - 1
    ? { ...state, status: 'completed' } : { ...state, cursor: state.cursor + 1 };
  if (action === 'back') return { ...state, cursor: Math.max(0, state.cursor - 1) };
  return state;
}

export const readPageTour = () => dbGet(STORES.META, PAGE_TOUR_KEY);
export const savePageTour = (action, expectedCursor) => dbUpdateRecord(STORES.META, PAGE_TOUR_KEY,
  (raw) => transitionPageTour(raw, action, expectedCursor));
