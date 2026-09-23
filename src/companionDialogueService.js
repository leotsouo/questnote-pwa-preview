/**
 * 陪伴寵物聊天泡泡 — 情境台詞與稀有度風格
 */
import { GACHA_COST, GACHA_TEN_COST } from './rewardService.js';
import { getRandomPetDialogue, getDefaultPetLine } from './loreService.js';
import { getTodayDateString, isInTodayPlan, allSubtasksCompleted } from './taskFilterService.js';
import { hasCheckedInToday, hasSpunWheelToday } from './dailyCheckInService.js';
import {
  getActiveHabits,
  getHabitPageStats,
  hasAnyDailyStreak,
  hasWeeklyNearGoal,
} from './habitService.js';

/** 稀有度語氣分組 */
const RARITY_GROUP = {
  N: 'common',
  R: 'common',
  SR: 'sr',
  SSR: 'ssr',
  UR: 'ur',
};

function getRarityGroup(rarity) {
  return RARITY_GROUP[rarity] || 'common';
}

/** 各情境台詞（依稀有度分組，每組至少 3 句） */
const DIALOGUES = {
  welcome: {
    common: ['嗨！今天也要一起加油喔！', '你回來啦，準備好開始了嗎？', '我在這裡等你好久了！'],
    sr: ['歡迎回來，夥伴。今天的行程，我與你同行。', '你回來了——讓我們穩步推進今日目標。', '我在此守候，隨時可以出發。'],
    ssr: ['你現身了。今日戰場，由我與你一同開闢。', '歸來正好——新的契約等待締結。', '時機已到，出發吧。'],
    ur: ['星界感應到你了……傳說的旅程，再次啟動。', '你踏入了命運的軌道，我早已在此等候。', '歸來吧，覺醒者——今日亦將書寫傳說。'],
  },
  urgent_task: {
    common: ['有緊急任務！快點處理啦！', '哇，緊急的事還沒做完耶！', '那個緊急任務在等你喔！'],
    sr: ['清單中有緊急事項——建議優先處理。', '我感知到緊迫的波動，先完成那項任務吧。', '緊急任務尚未平息，我與你同行。'],
    ssr: ['緊急威脅尚未斬斷——立刻行動。', '時間不等人，優先處理那項緊急任務。', '戰場上最危險的，往往是被拖延的緊急之事。'],
    ur: ['星界震盪警示——緊急契約必須立即履行。', '命運的裂縫因拖延而擴大，快斬斷那項任務。', '傳說不會等待猶豫者，緊急之事，此刻解決。'],
  },
  important_task: {
    common: ['還有重要任務沒做完喔！', '重要的事記得處理一下～', '先把重要任務搞定吧！'],
    sr: ['重要任務仍在等候，完成它們會讓前路更清晰。', '核心目標尚未達成，集中精神吧。', '別被瑣事分散，重要的事值得優先。'],
    ssr: ['關鍵目標尚未擊破——保持專注。', '重要之事已在等候，逐一斬斷即可。', '戰略核心尚未達成，我看好你的判斷。'],
    ur: ['重要契約尚未完成——星界正在觀測你的抉擇。', '關鍵之線尚未繫緊，完成它們，命運將為你讓路。', '傳說由重要之事鑄就，別讓它們久候。'],
  },
  no_task: {
    common: ['目前沒有待辦，可以休息一下～', '任務都清完了！好棒！', '清單是空的，要新增任務嗎？'],
    sr: ['目前沒有待辦任務，正好整理思緒。', '清單已清空，休息片刻也無妨。', '沒有進行中的任務，準備好再出發即可。'],
    ssr: ['戰場暫時平靜——把握時機休整或規劃。', '待辦已清空，這是難得的空檔。', '目前無事掛念，蓄力以待下一波挑戰。'],
    ur: ['星界暫時靜默……這是難得的空白時刻。', '契約清單為空，傳說的下一章，由你書寫。', '萬籟俱寂——休息，亦是覺醒之路的一部分。'],
  },
  progress_good: {
    common: ['今天完成好多任務，超厲害的！', '哇，今日戰果豐碩耶！', '你今天的表現太棒了！'],
    sr: ['今日完成多項任務，節奏穩健，值得肯定。', '連續達成目標——這才是可靠的夥伴。', '今天的進度令人滿意，繼續保持。'],
    ssr: ['今日戰果豐碩，你的意志值得這份榮耀。', '連續完成多項任務——氣勢如虹。', '你的節奏穩如磐石，星塵因你而匯聚。'],
    ur: ['星界為你的今日戰績而震動——傳說正在累積。', '連續締結契約，覺醒者的道路愈發清晰。', '今日的榮光，已寫入星界的記憶。'],
  },
  stardust_ready: {
    common: ['星塵夠了！可以去召喚喔！', '嘿，可以抽卡了耶～', '星塵滿滿的，要不要試試手氣？'],
    sr: ['星塵已足夠召喚，若有需要可以去試試。', '資源累積到位，召喚的時機到了。', '星塵達標，新的夥伴或許正在等待。'],
    ssr: ['星塵匯聚完成——召喚之門已可開啟。', '資源充足，是擴充戰力的好時機。', '星塵達標，命運的抽選等待你的決斷。'],
    ur: ['星塵已達召喚之門的臨界——傳說或許就在下一抽。', '星界的資源為你聚攏，是時候召喚新的存在。', '足夠的星塵，足以撼動命運的輪盤。'],
  },
  ten_pull_ready: {
    common: ['星塵超多！可以 10 連抽了！', '10 連抽的機會來了，衝啊！', '哇，夠抽十次了耶！'],
    sr: ['星塵充裕，10 連召喚是穩健的選擇。', '資源足以十連，值得認真考慮。', '十次召喚的機會已到，祝你好運。'],
    ssr: ['星塵充沛——十連召喚，一舉定乾坤。', '資源達到十連門檻，是擴軍的絕佳時機。', '十次命運的抽選，等待你的号令。'],
    ur: ['星塵如潮——十連足以撼動星界法則。', '傳說級的資源累積，十連召喚的時刻到了。', '十次契約同時締結……星界將為之震顫。'],
  },
  expedition_ready: {
    common: ['冒險能量夠了，可以派夥伴去探險！', '能量滿滿，要不要出發探險？', '可以開始探險囉～'],
    sr: ['冒險能量充足，可以派遣夥伴探索。', '能量已備，探險是累積資源的好方式。', '條件滿足，不妨讓夥伴出發探險。'],
    ssr: ['能量到位——派遣探險，開拓未知領域。', '冒險能量充足，是擴張戰果的時機。', '夥伴已蓄力完畢，探險可以啟程。'],
    ur: ['星界能量充盈——派遣傳說夥伴，穿越未知裂縫。', '探險之門已開，覺醒者的征途在等待。', '能量匯聚完成，讓夥伴踏上星界的邊境。'],
  },
  expedition_done: {
    common: ['有夥伴回來了，去探險頁看看吧！', '探險完成了！快去領獎勵！', '夥伴帶戰利品回來囉～'],
    sr: ['夥伴已從探險歸來，獎勵等待領取。', '探險完成，請前往探險頁確認戰利品。', '派遣的夥伴回來了，別忘了領取獎勵。'],
    ssr: ['探險凱旋——戰利品已備，前往領取。', '夥伴凱旋而歸，獎勵不容錯過。', '征途已畢，歸來的夥伴帶回了收穫。'],
    ur: ['星界裂縫的征途已畢——傳說夥伴攜戰利品歸來。', '探險契約完成，覺醒者的獎賞等待領取。', '夥伴從邊境歸來，星界的贈禮不容錯過。'],
  },
  idle: {
    common: ['……你在發呆嗎？', '沒事做的話，看看任務吧～', '我還在這裡喔！'],
    sr: ['……需要一點時間整理思緒嗎？我在此守候。', '片刻的寧靜也無妨，準備好再繼續。', '休息一下吧，我會在這裡等你。'],
    ssr: ['……戰場暫歇。蓄力之後，再出發不遲。', '靜止亦是戰術，我在此守望。', '短暫的沉寂，是下一擊的前奏。'],
    ur: ['……星界流轉，時間於此靜止。', '沉默之中，傳說仍在醞釀。', '萬物寂然——覺醒者，我在此等候你的下一念。'],
  },
  no_plan_today: {
    common: ['今天還沒安排任務，要先挑一件最重要的事嗎？', '今日計畫是空的，選一兩件先做吧！', '還沒規劃今天要做什麼呢～'],
    sr: ['今日尚未規劃任務——先挑一件最重要的事吧。', '計畫清單為空，不妨從最關鍵的任務開始。', '今天還沒有安排，穩步規劃會更有效率。'],
    ssr: ['今日戰略尚未佈局——先鎖定最關鍵的目標。', '計畫為空，是重新整軍的時刻。', '尚未安排今日任務，先選一件最重要的斬斷。'],
    ur: ['星界今日尚無契約——覺醒者，先選定最重要的使命。', '命運的今日篇章仍空白，先書寫最關鍵的一行。', '尚未規劃今日征途，先鎖定那一件改變一切的事。'],
  },
  plan_focused: {
    common: ['今天的目標很清楚，我們一件一件完成。', '計畫剛好，穩穩來就好！', '今日任務不多不少，剛剛好～'],
    sr: ['今日目標明確，逐一完成即可。', '計畫清晰，保持這個節奏。', '任務安排得當，我與你同行。'],
    ssr: ['今日戰略清晰——逐一斬斷，勝利在望。', '目標明確，按計畫推進即可。', '計畫精準，這是高效的節奏。'],
    ur: ['今日契約清晰明確——逐一履行，傳說將再度書寫。', '命運的今日路線已繪就，穩步前行。', '覺醒者的今日目標明確，星界為你讓路。'],
  },
  plan_heavy: {
    common: ['今天排得有點滿，先處理最關鍵的任務吧。', '任務好多！先挑最重要的做～', '今天有點忙，別忘了優先順序喔！'],
    sr: ['今日排程較滿，建議先處理最關鍵的任務。', '任務量偏多，集中火力處理優先事項。', '計畫較多，先完成最重要的幾項。'],
    ssr: ['今日戰場任務繁重——先斬斷最關鍵的威脅。', '排程密集，優先處理核心目標。', '任務眾多，戰略上先取最重要的勝利。'],
    ur: ['今日契約過於繁重——覺醒者，先履行最關鍵的那一條。', '星界今日震盪劇烈，先處理命運的核心之事。', '任務如潮，傳說者須先斬斷最關鍵的羈絆。'],
  },
  has_overdue: {
    common: ['有任務已經逾期了，先把它收掉會輕鬆很多。', '逾期的任務在等你，先處理會比較輕鬆～', '有幾件逾期了，先搞定它們吧！'],
    sr: ['有任務已逾期，優先處理會讓前路更輕鬆。', '逾期事項尚未清除，建議先處理。', '有逾期的任務，先收掉會減輕負擔。'],
    ssr: ['逾期威脅尚未斬斷——先處理，戰場才會清明。', '有任務已過期限，優先清除。', '逾期之事如陰影纏身，先斬斷它們。'],
    ur: ['星界感應到逾期契約——先履行，命運才會鬆動。', '有契約已逾期限，覺醒者，先將其斬斷。', '逾期的羈絆仍在，先收掉會讓星界為你讓路。'],
  },
  subtasks_all_done: {
    common: ['步驟都完成了，要把這個任務結案嗎？', '子任務都搞定了，主任務也完成吧！', '所有步驟都完成了，要結案了嗎？'],
    sr: ['所有步驟已完成，是否將主任務結案？', '子任務皆已達成，可以完成主任務了。', '步驟全部完成，建議結案此任務。'],
    ssr: ['所有步驟已斬斷——是時候完成主任務了。', '子任務全數達成，主任務等待你的号令。', '步驟皆畢，完成主任務即可凱旋。'],
    ur: ['所有契約步驟已履行——覺醒者，完成主任務吧。', '子任務的星界印記已全部點亮，結案之時到了。', '步驟皆盡，傳說的最後一筆等待你書寫。'],
  },
  habit_none: {
    common: ['可以建立一個小習慣，讓每天更穩定。', '試試看每天做一件小事，會很有成就感！', '從一個小習慣開始吧，我陪你一起。'],
    sr: ['可以建立一個小習慣，讓每天更穩定。', '穩定的節奏從小習慣開始，我會陪你。', '不妨先建立一個簡單的習慣，逐步累積。'],
    ssr: ['建立一個小習慣——穩定的戰力從日常累積。', '每日的微小堅持，將鑄就不可動搖的意志。', '從一個習慣開始，讓你的節奏無懈可擊。'],
    ur: ['星界建議：建立一個小習慣，讓命運的軌道更穩定。', '傳說者的日常，始於一個微小的契約。', '覺醒者，從一個習慣開始，星界將見證你的累積。'],
  },
  habit_today_remaining: {
    common: ['今天的習慣還有幾個沒完成，我們先從最簡單的開始吧。', '還有習慣等著你，先做最容易的那個！', '習慣還沒做完，一步一步來就好。'],
    sr: ['今天的習慣還有幾個未完成，先從最簡單的開始吧。', '尚有習慣待完成，穩步推進即可。', '剩餘的習慣不多，逐一完成吧。'],
    ssr: ['今日習慣尚未全部完成——先斬斷最簡單的那一項。', '尚有習慣待履行，從最容易的開始。', '剩餘習慣等待你的行動，先取最輕鬆的勝利。'],
    ur: ['今日契約尚未全部履行——覺醒者，先完成最簡單的那一項。', '習慣的羈絆仍在，從最容易的開始斬斷。', '星界感應到未完成的習慣，先從最輕的開始。'],
  },
  habit_today_done: {
    common: ['今天的習慣都完成了，節奏很穩。', '習慣全部搞定，今天節奏超棒！', '今日習慣完成，繼續保持！'],
    sr: ['今天的習慣都完成了，節奏很穩。', '今日習慣已全部達成，值得肯定。', '習慣完成，這是穩定的節奏。'],
    ssr: ['今日習慣全數完成——你的紀律值得讚賞。', '所有習慣已履行，節奏穩如磐石。', '今日習慣達標，氣勢持續累積。'],
    ur: ['今日所有習慣契約已履行——星界為你的穩定而震動。', '習慣全數完成，傳說者的節奏不可動搖。', '覺醒者，今日習慣皆畢，榮光已寫入星界。'],
  },
  habit_streak_7: {
    common: ['你已經連續 7 天保持這個習慣了，這不是偶然，是累積。', '連續 7 天了！超厲害的！', '7 天連續完成，你真的很有毅力！'],
    sr: ['你已經連續 7 天保持這個習慣了，這不是偶然，是累積。', '連續 7 天的堅持，值得肯定。', '七日的穩定節奏，這是可靠的夥伴該有的樣子。'],
    ssr: ['連續 7 天——這不是偶然，是意志的累積。', '七日不間斷，你的紀律已鑄成鋼鐵。', '七日的堅持，戰場上最難假裝的實力。'],
    ur: ['連續 7 日履行契約——星界確認，這是覺醒者的意志。', '七日的堅持非偶然，傳說由此累積。', '星界記錄了你的連續七日，這是命運的印記。'],
  },
  habit_weekly_near_goal: {
    common: ['這週只差一次就達標了，要不要今天補上？', '每週習慣差一次就達標囉，今天做吧！', '就差一次了，今天補上剛好達標！'],
    sr: ['這週只差一次就達標了，要不要今天補上？', '每週習慣即將達標，今天完成即可。', '距離本週目標只差一次，值得把握。'],
    ssr: ['本週目標只差一次——今日補上，即可達標。', '每週習慣瀕臨達標，今日一擊即可收官。', '差一次達標，不要讓這週的戰果溜走。'],
    ur: ['本週契約只差一次——覺醒者，今日補上即可達標。', '星界感應到每週習慣即將完成，今日是關鍵。', '距離本週達標僅差一次，命運在此轉折。'],
  },
  workshop_materials_ready: {
    common: ['材料已經夠做一份禮物了，要去工坊看看嗎？', '探險材料夠了，可以去做禮物囉！', '材料齊了，工坊在等你～'],
    sr: ['材料已足夠製作禮物，不妨前往工坊。', '探險所得已可製作道具，工坊等待你的到來。', '材料到位，是時候為夥伴準備禮物了。'],
    ssr: ['材料匯聚完成——工坊可鑄造新的羈絆之禮。', '探險戰利品已足，前往工坊鍛造心意吧。', '資源齊備，為夥伴製作一份禮物的時機到了。'],
    ur: ['星界材料已聚攏——工坊之門為你敞開，鑄造羈絆之禮吧。', '探險所得足以製作禮物，覺醒者，前往工坊。', '材料匯聚，傳說級的心意等待在工坊中誕生。'],
  },
  gift_available: {
    common: ['背包裡有可以送給夥伴的禮物。', '有做好的禮物，要不要送給夥伴？', '道具做好了，去工坊贈送頁看看吧！'],
    sr: ['背包中有可贈送的禮物，不妨前往工坊。', '已有親密度道具，是時候送給夥伴了。', '禮物已備，前往工坊贈送即可。'],
    ssr: ['背包中已有羈絆之禮——贈予夥伴，加深羈絆。', '親密度道具已就緒，前往工坊完成贈送。', '禮物在背包中等待，別忘了送給夥伴。'],
    ur: ['星界贈禮已備——覺醒者，將心意交予夥伴吧。', '背包中的羈絆道具等待你的贈予。', '禮物已鑄，前往工坊，完成這份星界的羈絆。'],
  },
  companion_likes_gift: {
    common: ['牠好像會喜歡你準備的那份禮物。', '這份禮物牠可能會很開心喔！', '我覺得牠會喜歡背包裡的那個～'],
    sr: ['以牠的喜好來看，背包中的禮物應會受歡迎。', '那份禮物與牠的特質相合，值得贈送。', '我感知到牠會喜歡你準備的禮物。'],
    ssr: ['那份禮物與牠的羈絆共鳴——贈予後將大幅加深親密度。', '牠的特質與背包中的禮物高度契合。', '這份禮物正是牠所偏好的，別錯過贈送的時機。'],
    ur: ['星界感應——背包中的禮物與牠的命運之線共鳴。', '那份贈禮正是牠靈魂所渴求的，覺醒者。', '傳說夥伴對這份禮物的喜好，星界已為你預示。'],
  },
  no_materials: {
    common: ['探險能帶回製作禮物的材料。', '材料還不太夠，派夥伴去探險吧！', '去探險收集材料，就能做禮物了～'],
    sr: ['探險可帶回製作禮物的材料，不妨派遣夥伴。', '材料尚少，探險是穩定的取得方式。', '派遣夥伴探險，可累積工坊所需材料。'],
    ssr: ['材料匱乏——派遣探險，開拓材料來源。', '探險戰場可帶回製作禮物所需的資源。', '前往探險，為工坊補給材料。'],
    ur: ['星界材料稀少——覺醒者，派遣夥伴穿越裂縫，帶回鑄禮之物。', '探險是取得工坊材料的命運之路。', '材料尚不足夠，讓夥伴踏上探險，為羈絆積累資源。'],
  },
  check_in_available: {
    common: ['今天的祝福還沒領喔。', '每日簽到還沒做，快來領祝福吧！', '別忘了今天的簽到獎勵喔～'],
    sr: ['今天的祝福尚未領取，不妨先完成簽到。', '每日簽到仍在等待，先領取今日祝福吧。', '今日祝福尚未簽收，我與你同行。'],
    ssr: ['今日祝福尚未領取——先簽到，再出發。', '每日契約等待履行，先領取祝福吧。', '星塵的祝福尚未到手，別錯過今日簽到。'],
    ur: ['星界今日祝福尚未降臨——覺醒者，先完成簽到。', '命運的每日贈禮仍在等待，別讓它溜走。', '今日祝福契約未締結，先領取再踏上征途。'],
  },
  wheel_available: {
    common: ['幸運轉盤好像正在發光。', '轉盤在閃耶，要不要試試手氣？', '今天的幸運轉盤還沒轉喔！'],
    sr: ['幸運轉盤似乎正在等待你，不妨一試。', '今日的轉盤尚未轉動，或許有好運。', '轉盤微光閃爍，今日幸運尚未揭曉。'],
    ssr: ['幸運轉盤正在發光——今日的命運等待你的抽選。', '轉盤已蓄力完畢，一轉或許改變今日戰果。', '星界的幸運之輪在呼喚，別錯過今日一次。'],
    ur: ['星界幸運轉盤正在綻放光芒——覺醒者，命運等待你的抉擇。', '傳說級的幸運之輪已醒，今日僅此一轉。', '轉盤感應到你的氣息，星界的贈禮在旋轉中等待。'],
  },
  check_in_done: {
    common: ['今天也有好好回來，做得不錯。', '簽到和轉盤都完成了，今天很棒！', '今日祝福都領到了，明天再來喔～'],
    sr: ['今天也有好好回來，節奏穩健。', '今日祝福皆已完成，值得肯定。', '簽到與轉盤皆畢，明日再會。'],
    ssr: ['今日祝福全數完成——你的紀律值得這份榮耀。', '簽到與轉盤皆畢，今日戰果穩固。', '你今日已領取全部祝福，明日再戰。'],
    ur: ['今日祝福契約皆已履行——星界為你的歸來而震動。', '覺醒者，今日簽到與轉盤皆畢，傳說繼續累積。', '星界確認你今日已領取全部祝福，明日再臨。'],
  },
};

/**
 * V2.6.0 羈絆解放：專屬羈絆台詞
 * Lv.2 解鎖親近台詞、Lv.5 解鎖羈絆台詞（通用，不需每隻客製）。
 */
export const BOND_DIALOGUES = {
  lv2: [
    '牠似乎越來越習慣待在你身邊了。',
    '牠輕輕靠近你，像是在替你加油。',
    '今天也一起完成一點小目標吧。',
  ],
  lv5: [
    '你們之間的羈絆已經非常深了。',
    '牠看著你，像是早就明白你的心情。',
    '無論今天任務多難，牠都會陪你走完。',
  ],
};

/**
 * 取得羈絆台詞（若寵物已解鎖）。
 * bondLiberated（Lv.5）時優先抽 Lv.5 台詞，否則若已解鎖 Lv.2 親近台詞則抽 Lv.2。
 * @param {object|null} companion - 需含 bondUnlockState
 * @returns {string|null}
 */
export function getBondDialogueLine(companion) {
  const state = companion?.bondUnlockState;
  if (!state) return null;
  let pool = null;
  if (state.bondLiberated) {
    pool = BOND_DIALOGUES.lv5;
  } else if (state.dialogueLv2) {
    pool = BOND_DIALOGUES.lv2;
  }
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 自動選擇情境的優先順序 */
const SCENARIO_PRIORITY = [
  'expedition_done',
  'check_in_available',
  'wheel_available',
  'habit_streak_7',
  'habit_weekly_near_goal',
  'subtasks_all_done',
  'has_overdue',
  'urgent_task',
  'important_task',
  'habit_today_remaining',
  'habit_today_done',
  'plan_heavy',
  'no_plan_today',
  'plan_focused',
  'ten_pull_ready',
  'stardust_ready',
  'expedition_ready',
  'workshop_materials_ready',
  'gift_available',
  'companion_likes_gift',
  'progress_good',
  'habit_none',
  'no_task',
  'no_materials',
  'check_in_done',
  'idle',
  'welcome',
];

/**
 * 判斷各情境是否成立
 */
export function detectScenarios(ctx) {
  const {
    tasks,
    todayCompleted,
    wallet,
    activeExpedition,
    expeditionAreas,
    habits = [],
    inventory,
    craftables = [],
    companion,
    dailyCheckIn,
  } = ctx;
  const today = getTodayDateString();
  const incomplete = tasks.filter((t) => !t.completed);
  const stardust = wallet?.stardust ?? 0;
  const energy = wallet?.adventureEnergy ?? 0;

  const activeHabits = getActiveHabits(habits);
  const habitStats = habits.length > 0 ? getHabitPageStats(habits, today) : null;

  const hasUrgent = incomplete.some((t) => t.priority === 'urgent');
  const hasImportant = incomplete.some((t) => t.priority === 'important');
  const noIncomplete = incomplete.length === 0;

  const todayPlan = incomplete.filter((t) => isInTodayPlan(t, today));
  const hasOverdue = incomplete.some(
    (t) => t.dueDate && t.dueDate < today
  );
  const hasSubtasksAllDone = incomplete.some((t) => allSubtasksCompleted(t));

  const expeditionComplete =
    activeExpedition &&
    activeExpedition.endsAt &&
    Date.now() >= new Date(activeExpedition.endsAt).getTime() &&
    !activeExpedition.claimed;

  const minEnergyCost = expeditionAreas?.length
    ? Math.min(...expeditionAreas.map((a) => a.energyCost ?? 999))
    : 999;
  const canExpedition = !activeExpedition && energy >= minEnergyCost;

  let workshopMaterialsReady = false;
  let giftAvailable = false;
  let companionLikesGift = false;
  let noMaterials = false;

  if (wallet && craftables.length > 0) {
    const { hasCraftableMaterials, hasBondItemsInInventory, companionLikesAnyGift, hasLowMaterials } =
      ctx.workshopHelpers || {};
    if (hasCraftableMaterials) {
      workshopMaterialsReady = hasCraftableMaterials(wallet, craftables);
    }
    if (hasBondItemsInInventory && inventory) {
      giftAvailable = hasBondItemsInInventory(inventory, craftables);
    }
    if (companionLikesAnyGift && inventory && companion) {
      companionLikesGift = companionLikesAnyGift(companion, inventory, craftables);
    }
    if (hasLowMaterials) {
      noMaterials = hasLowMaterials(wallet);
    }
  }

  return {
    welcome: !!ctx.isWelcome,
    check_in_available: dailyCheckIn ? !hasCheckedInToday(dailyCheckIn, today) : false,
    wheel_available: dailyCheckIn ? !hasSpunWheelToday(dailyCheckIn, today) : false,
    check_in_done: dailyCheckIn
      ? hasCheckedInToday(dailyCheckIn, today) && hasSpunWheelToday(dailyCheckIn, today)
      : false,
    habit_streak_7: hasAnyDailyStreak(habits, 7, today),
    habit_weekly_near_goal: hasWeeklyNearGoal(habits, today),
    habit_today_remaining: habitStats?.hasIncompleteToday ?? false,
    habit_today_done: habitStats?.allTodayDone ?? false,
    habit_none: activeHabits.length === 0,
    subtasks_all_done: hasSubtasksAllDone,
    has_overdue: hasOverdue && !hasUrgent,
    urgent_task: hasUrgent,
    important_task: hasImportant && !hasUrgent,
    no_plan_today: incomplete.length > 0 && todayPlan.length === 0,
    plan_focused: todayPlan.length >= 1 && todayPlan.length <= 3,
    plan_heavy: todayPlan.length > 6,
    no_task: noIncomplete,
    progress_good: todayCompleted >= 3,
    stardust_ready: stardust >= GACHA_COST && stardust < GACHA_TEN_COST,
    ten_pull_ready: stardust >= GACHA_TEN_COST,
    expedition_ready: canExpedition,
    expedition_done: !!expeditionComplete,
    workshop_materials_ready: workshopMaterialsReady,
    gift_available: giftAvailable,
    companion_likes_gift: companionLikesGift,
    no_materials: noMaterials && !workshopMaterialsReady,
    idle: !!ctx.isIdle,
  };
}

/**
 * 依優先順序解析目前情境
 */
export function resolveScenario(ctx) {
  const flags = detectScenarios(ctx);

  for (const scenario of SCENARIO_PRIORITY) {
    if (flags[scenario]) return scenario;
  }
  return 'welcome';
}

/**
 * 從情境池隨機取一句（依稀有度）
 */
export function getDialogueForScenario(scenario, companion) {
  const group = getRarityGroup(companion?.rarity || 'N');
  const pool = DIALOGUES[scenario]?.[group] || DIALOGUES.welcome.common;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 取得陪伴寵物台詞（寵物專屬 lore 優先，否則用情境台詞）
 */
/** 不應被羈絆台詞插隊的行動導向情境 */
const BOND_DIALOGUE_BLOCKED_SCENARIOS = new Set([
  'expedition_done',
  'check_in_available',
  'wheel_available',
  'urgent_task',
  'important_task',
  'has_overdue',
  'subtasks_all_done',
]);

export function getCompanionDialogue(ctx, forceScenario = null) {
  const { tasks, todayCompleted, companion } = ctx;
  const scenario = forceScenario || resolveScenario(ctx);

  // 羈絆台詞：在非行動導向情境下，依解鎖狀態有機率插入
  if (!BOND_DIALOGUE_BLOCKED_SCENARIOS.has(scenario)) {
    const bondLine = getBondDialogueLine(companion);
    if (bondLine) {
      const chance = companion?.bondUnlockState?.bondLiberated ? 0.35 : 0.2;
      if (Math.random() < chance) return bondLine;
    }
  }

  const scenarioList = ['expedition_done', 'check_in_available', 'wheel_available', 'check_in_done', 'stardust_ready', 'ten_pull_ready', 'expedition_ready', 'workshop_materials_ready', 'gift_available', 'companion_likes_gift', 'no_materials', 'idle', 'welcome', 'no_plan_today', 'plan_focused', 'plan_heavy', 'has_overdue', 'subtasks_all_done', 'habit_none', 'habit_today_remaining', 'habit_today_done', 'habit_streak_7', 'habit_weekly_near_goal'];
  if (scenarioList.includes(scenario)) {
    return getDialogueForScenario(scenario, companion);
  }

  if (companion) {
    const petLine = getRandomPetDialogue(companion, tasks, todayCompleted);
    if (petLine) return petLine;
  }

  return getDialogueForScenario(scenario, companion);
}

/**
 * 首頁預設台詞
 */
export function getWelcomeCompanionLine(ctx) {
  const { tasks, todayCompleted, companion } = ctx;
  const scenario = resolveScenario({ ...ctx, isWelcome: true });

  const scenarioList = ['expedition_done', 'check_in_available', 'wheel_available', 'check_in_done', 'stardust_ready', 'ten_pull_ready', 'expedition_ready', 'workshop_materials_ready', 'gift_available', 'companion_likes_gift', 'no_materials', 'idle', 'welcome', 'no_plan_today', 'plan_focused', 'plan_heavy', 'has_overdue', 'subtasks_all_done', 'habit_none', 'habit_today_remaining', 'habit_today_done', 'habit_streak_7', 'habit_weekly_near_goal'];
  if (scenarioList.includes(scenario)) {
    const group = getRarityGroup(companion?.rarity || 'N');
    const pool = DIALOGUES[scenario]?.[group] || DIALOGUES.welcome.common;
    return pool[0];
  }

  if (companion) {
    const petLine = getDefaultPetLine(companion, tasks, todayCompleted);
    if (petLine) return petLine;
  }

  return getDialogueForScenario(scenario, companion);
}

/** 聊天泡泡自動更新間隔（60～120 秒） */
export function randomBubbleInterval() {
  return 60000 + Math.floor(Math.random() * 60001);
}

/** 閒置判定門檻（毫秒） */
export const IDLE_THRESHOLD_MS = 120000;
