/**
 * 探險地圖探索度系統
 *
 * 每次成功領取探險獎勵後，對應地區探索度增加，
 * 逐步解鎖地區故事、里程碑、地區徽章與稱號。
 *
 * 探索度與領獎在同一筆交易內更新，不在派遣或倒數中增加。
 */
import { dbGet, dbPut, dbMutateRecords, STORES } from './db.js';
import { normalizeWallet } from './rewardService.js';
import { MATERIAL_LABELS } from './expeditionService.js';

const EXPLORATION_PROGRESS_KEY = 'explorationProgress';

/** 里程碑百分比（所有地區共用） */
export const MILESTONE_PERCENTS = [10, 25, 50, 75, 100];

/** 探索里程碑道具顯示名稱（少量，避免額外載入 craftables） */
const REWARD_ITEM_LABELS = {
  item_warm_snack: '溫暖點心',
  item_astral_honey: '星界蜜糖',
  item_stardust_candy: '星塵糖果',
  item_small_spirit_food: '小份靈食',
};

/** 地區故事文字（達到對應探索度後解鎖顯示） */
export const AREA_STORIES = {
  aurora_feast_garden_story_10: "第一串露光標出通往膳亭的石階。",
  aurora_feast_garden_story_25: "採集隊學會留下未熟的花露，不再一次摘空花園。",
  aurora_feast_garden_story_50: "夜宴的小火為晚歸者一直留著，兩道香氣開始靠近。",
  aurora_feast_garden_story_75: "食籃接力跨過薄霧，晨宴與夜宴第一次互換食物。",
  aurora_feast_garden_story_100: "晨昏香氣回到膳鼎，所有席位都有一份為同行者留下的點心。",
  darkcrown_border_story_10: "邊境界石刻著七條仍有顏色的路：霧林、火脈、機械遺跡、星界、北境、田野與雲棧。旅人把這片由不同記憶織成的大地稱作織界。黑塔伸出的裂冠正試圖將它們染成同一個名字；你們先替一條熄滅的路重新點燈。",
  darkcrown_border_story_25: "暮紗幼蛛封住信封，緘信墨梟卻將沒有署名的信送出塔外。王庭的魔獸並非失去思考的影子：牠們各有欲望，也各有不願交出的記憶。你們在逆芽棘兔挖出的裂縫找到一張舊路圖，七地的故事依然保留自己的筆跡。",
  darkcrown_border_story_50: "裂月魔鰩划開潮汐門，終鐘夢蛾令鐘下的夢花停在盛開之前。黯冠古龍壓住交界石，要求萬物只聽一道意志。你們沒有擊碎界石，而是把七地傳來的不同回聲留在裂縫裡，讓每一條路仍能走向自己的地方。",
  darkcrown_border_story_75: "荊誓角麒撕裂紅色誓線，鏡宴銀狐的幻宴映出缺席的座位；灰律銅鴉停住齒輪，蝕星獄獅反轉牢鏈上的星光。四股力量沒有消失，王庭也沒有忽然變成善意的家。你們只替同行者留下一份可以自己選擇的約定，拒絕用另一道命令取代裂冠。",
  darkcrown_border_story_100: "黑塔仍在，裂冠仍試圖吞光，七色星路卻不再只靠一處抵抗。邊境路碑留出二十個不同的刻痕，證明每位生命有自己的名字。這條新路將舊地連在一起，沒有重寫任何人的往事；你們帶著各自的記憶，準備面對王庭下一次伸出的影子。",
  lionheart_city_story_10: "獅心城銅門上的浮雕只有天然羽翼與獅身。居民說，天律之冕・格里芬不需要任何人工增強，牠的血肉、感知與魔法本就完整。學院把每一次展翼都記進冊頁，城名也隨著這份崇敬流傳。",
  lionheart_city_story_25: "逆造工坊的舊筆記起初只記羽翼曲線，後來卻添上器官接口、壓力管線與人工骨架。人們不再滿足於觀察完美；他們要讓血肉跨過自身的限制。校準鴞說，那是一條追逐神的道路，盤根龜卻看見溫室裡被忽略的自然幼苗。",
  lionheart_city_story_50: "培育室的紀錄留下第一次自主呼吸：獅首奇美拉的胸腹起伏，人工器官隨之運作，機械翼面一節節張開。牠看向牆上的格里芬圖譜，沒有等待下一道口令。工匠曾想重現原型，眼前的生命卻已開始要求自己的名字與選擇。",
  lionheart_city_story_75: "試飛塔的蒸汽越過城牆，格里芬從高崖迎風而來。天然巨翼收束乱流，奇美拉則以人工翼架強行突破風壓。第一次交鋒撕開了城市的共識：格里芬拒絕逆造的道路，奇美拉拒絕低頭。工坊與學院的爭論，從此延伸到每條街道。",
  lionheart_city_story_100: "街道修好了，高崖與試飛塔卻仍隔城對峙。格里芬沒有接納人工造生，奇美拉也沒有放棄超越原型。獅心城保留下研究紀錄，讓後來者看見人們仰望完美、又向完美露齒的每一步。探索結束，這場衝突並未結束。",
  mist_forest_story_10: '你們在森林深處發現一座被苔蘚覆蓋的古老石碑，上面刻著早已模糊的召喚符文。',
  lava_rift_story_10: '裂谷邊緣傳來低沉的轟鳴聲，像是地底火脈仍在呼吸。',
  machine_ruins_story_10: '古老齒輪緩慢轉動，彷彿這座遺跡從未真正沉睡。',
  astral_rift_story_10: '星光碎片漂浮在半空中，牠們像是在等待某個願望被完成。',
  polar_shore_story_10: '風雪短暫停歇，隊伍看見冰岸上通往極光的古老航路。',
  harvest_fields_story_10: '田埂旁的小路連向村落，夥伴發現居民留下的守望記號。',
  cloudrest_trail_story_10: '斷橋邊的無字路碑下，藏著一張旅人留下的修橋草圖。山裡的靈獸每天送來一截木枝，卻始終少一個能把它們接起來的同行者。你們放下行囊，決定先替下一位過路人鋪好第一塊橋板。',
  cloudrest_trail_story_25: '竹林小亭沒有掌門的座位，只有一排大小不同的茶碗。靈貂帶回失落的繩索，玉蜂指出裂開的橋墩，白猿把草圖翻到最後一頁。你這才知道，這條路的功夫是把別人擅長的事情接在一起。',
  cloudrest_trail_story_50: '山口的風把半卷舊信吹到石階上。信中沒有失傳祕笈，只記著沿途願意借宿的人家與可以避雨的屋簷。你們把新的落腳處添上去，讓一份只屬於過去的記錄，成為今日仍能使用的路。',
  cloudrest_trail_story_75: '重岳雕在橋頭收起雙翼，讓最膽小的白驹先踏過去。大家曾以為只有最強的夥伴能領路，這次卻看見白驹回頭等了每一位同行者。橋上的腳步聲不整齊，卻沒有任何一個被落下。',
  cloudrest_trail_story_100: '你們將最後一塊橋板固定在晨光裡。靈獸們沒有把山路改成誰的名字，只在路碑下留下一碗溫熱的行旅糰。此後每位經過的人，都可以先歇一口氣，再帶著自己的事情走向下一段山河。',
};

/**
 * 地區探索度定義：每個地區的每次增加量與里程碑內容。
 * 每個已登錄地區都保留探索進度與里程碑。
 */
export const AREA_EXPLORATION_DEFS = {
  aurora_feast_garden: {
  "areaId": "aurora_feast_garden",
  "name": "霓霞膳庭",
  "increment": 4,
  "milestones": [
    {
      "percent": 10,
      "title": "沿香入庭",
      "description": "第一串露光標出通往膳亭的石階。",
      "storyId": "aurora_feast_garden_story_10",
      "reward": {
        "stardust": 30
      }
    },
    {
      "percent": 25,
      "title": "晨露採香",
      "description": "採集隊學會留下未熟的花露，不再一次摘空花園。",
      "storyId": "aurora_feast_garden_story_25",
      "reward": {
        "stardust": 50
      }
    },
    {
      "percent": 50,
      "title": "夜灶留火",
      "description": "夜宴的小火為晚歸者一直留著，兩道香氣開始靠近。",
      "storyId": "aurora_feast_garden_story_50",
      "reward": {
        "stardust": 80
      }
    },
    {
      "percent": 75,
      "title": "雲橋共渡",
      "description": "食籃接力跨過薄霧，晨宴與夜宴第一次互換食物。",
      "storyId": "aurora_feast_garden_story_75",
      "reward": {
        "stardust": 100
      }
    },
    {
      "percent": 100,
      "title": "霓霞共席",
      "description": "晨昏香氣回到膳鼎，所有席位都有一份為同行者留下的點心。",
      "storyId": "aurora_feast_garden_story_100",
      "reward": {
        "stardust": 150
      }
    }
  ]
},
  darkcrown_border: {
  "areaId": "darkcrown_border",
  "name": "黯冠邊境",
  "increment": 4,
  "milestones": [
    {
      "percent": 10,
      "title": "七色界石",
      "description": "替仍有名字的星路重新點燈。",
      "storyId": "darkcrown_border_story_10",
      "reward": {
        "stardust": 50
      }
    },
    {
      "percent": 25,
      "title": "無署名的信",
      "description": "找回沒有被王庭抹去的筆跡。",
      "storyId": "darkcrown_border_story_25",
      "reward": {
        "stardust": 80,
        "materials": {
          "forest_leaf": 5
        }
      }
    },
    {
      "percent": 50,
      "title": "裂冠之外",
      "description": "把七地回聲留在界石裂縫裡。",
      "storyId": "darkcrown_border_story_50",
      "reward": {
        "stardust": 120,
        "title": "七路守燈者",
        "badgeId": "badge_darkcrown_50"
      }
    },
    {
      "percent": 75,
      "title": "自行選擇的約定",
      "description": "讓同行者保留自己的意志。",
      "storyId": "darkcrown_border_story_75",
      "reward": {
        "stardust": 180,
        "materials": {
          "lava_core": 3
        }
      }
    },
    {
      "percent": 100,
      "title": "織界有名",
      "description": "守住七色路線及二十個不同的名字。",
      "storyId": "darkcrown_border_story_100",
      "reward": {
        "stardust": 300,
        "materials": {
          "forest_leaf": 8
        },
        "title": "裂冠界線守望者",
        "badgeId": "badge_darkcrown_100"
      }
    }
  ]
},
  lionheart_city: {
    "areaId": "lionheart_city",
    "name": "獅心城",
    "increment": 4,
    "milestones": [
      {
        "percent": 10,
        "title": "完美的尺度",
        "description": "獅心城銅門上的浮雕只有天然羽翼與獅身。居民說，天律之冕・格里芬不需要任何人工增強，牠的血肉、感知與魔法本就完整。學院把每一次展翼都記進冊頁，城名也隨著這份崇敬流傳。",
        "reward": {
          "stardust": 30
        },
        "storyId": "lionheart_city_story_10"
      },
      {
        "percent": 25,
        "title": "逆造工坊",
        "description": "逆造工坊的舊筆記起初只記羽翼曲線，後來卻添上器官接口、壓力管線與人工骨架。人們不再滿足於觀察完美；他們要讓血肉跨過自身的限制。校準鴞說，那是一條追逐神的道路，盤根龜卻看見溫室裡被忽略的自然幼苗。",
        "reward": {
          "stardust": 50,
          "materials": {
            "machine_part": 1
          }
        },
        "storyId": "lionheart_city_story_25"
      },
      {
        "percent": 50,
        "title": "第一次呼吸",
        "description": "培育室的紀錄留下第一次自主呼吸：獅首奇美拉的胸腹起伏，人工器官隨之運作，機械翼面一節節張開。牠看向牆上的格里芬圖譜，沒有等待下一道口令。工匠曾想重現原型，眼前的生命卻已開始要求自己的名字與選擇。",
        "reward": {
          "stardust": 80,
          "materials": {
            "machine_part": 2
          }
        },
        "storyId": "lionheart_city_story_50"
      },
      {
        "percent": 75,
        "title": "越界試飛",
        "description": "試飛塔的蒸汽越過城牆，格里芬從高崖迎風而來。天然巨翼收束乱流，奇美拉則以人工翼架強行突破風壓。第一次交鋒撕開了城市的共識：格里芬拒絕逆造的道路，奇美拉拒絕低頭。工坊與學院的爭論，從此延伸到每條街道。",
        "reward": {
          "stardust": 120,
          "materials": {
            "machine_part": 2
          }
        },
        "storyId": "lionheart_city_story_75"
      },
      {
        "percent": 100,
        "title": "未竟的對峙",
        "description": "街道修好了，高崖與試飛塔卻仍隔城對峙。格里芬沒有接納人工造生，奇美拉也沒有放棄超越原型。獅心城保留下研究紀錄，讓後來者看見人們仰望完美、又向完美露齒的每一步。探索結束，這場衝突並未結束。",
        "reward": {
          "stardust": 200,
          "badgeId": "badge_lionheart_witness",
          "title": "獅心城見證者"
        },
        "storyId": "lionheart_city_story_100"
      }
    ]
  },
  mist_forest: {
    areaId: 'mist_forest',
    name: '迷霧森林',
    increment: 5,
    milestones: [
      {
        percent: 10,
        title: '霧中的石碑',
        description: '你們在森林深處發現一座被苔蘚覆蓋的古老石碑。',
        reward: { stardust: 50 },
        storyId: 'mist_forest_story_10',
      },
      {
        percent: 25,
        title: '林間補給',
        description: '森林的氣息變得熟悉，你更容易找到可用的靈材。',
        reward: { stardust: 80, materials: { forest_leaf: 5 } },
      },
      {
        percent: 50,
        title: '森林巡行徽章',
        description: '你已經熟悉迷霧森林的一半路徑。',
        reward: { stardust: 120, title: '森林巡行者', badgeId: 'badge_mist_forest_50' },
      },
      {
        percent: 75,
        title: '霧林守望者',
        description: '森林中的靈獸開始認可你的腳步。',
        reward: { stardust: 180, items: { item_warm_snack: 1 } },
      },
      {
        percent: 100,
        title: '迷霧森林完全探索',
        description: '你已經完成迷霧森林的主要探索。',
        reward: { stardust: 300, materials: { star_shard: 1 }, title: '霧林完成者', badgeId: 'badge_mist_forest_100' },
      },
    ],
  },
  lava_rift: {
    areaId: 'lava_rift',
    name: '熔岩裂谷',
    increment: 4,
    milestones: [
      {
        percent: 10,
        title: '熔岩邊界',
        description: '你們首次踏入炙熱裂谷，空氣中充滿火元素的震動。',
        reward: { stardust: 60 },
        storyId: 'lava_rift_story_10',
      },
      {
        percent: 25,
        title: '火脈碎片',
        description: '裂谷中的火脈逐漸顯露，能採集到更多熔岩核心。',
        reward: { stardust: 90, materials: { lava_core: 3 } },
      },
      {
        percent: 50,
        title: '火脈行者徽章',
        description: '你已能穩定穿越熔岩裂谷的危險區域。',
        reward: { stardust: 140, title: '火脈行者', badgeId: 'badge_lava_rift_50' },
      },
      {
        percent: 75,
        title: '裂谷深處',
        description: '寵物在火光中發現古老熔岩紋路。',
        reward: { stardust: 200, materials: { lava_core: 5 } },
      },
      {
        percent: 100,
        title: '熔岩裂谷完全探索',
        description: '你完成了熔岩裂谷的主要探索。',
        reward: { stardust: 350, materials: { star_shard: 1 }, title: '裂谷征服者', badgeId: 'badge_lava_rift_100' },
      },
    ],
  },
  machine_ruins: {
    areaId: 'machine_ruins',
    name: '古代機械遺跡',
    increment: 4,
    milestones: [
      {
        percent: 10,
        title: '齒輪門廊',
        description: '遺跡入口的巨大齒輪仍在緩慢轉動。',
        reward: { stardust: 60 },
        storyId: 'machine_ruins_story_10',
      },
      {
        percent: 25,
        title: '遺跡零件庫',
        description: '你們找到了保存尚好的古代零件。',
        reward: { stardust: 90, materials: { machine_part: 3 } },
      },
      {
        percent: 50,
        title: '齒輪考古徽章',
        description: '你已破解部分遺跡結構。',
        reward: { stardust: 140, title: '齒輪考古者', badgeId: 'badge_machine_ruins_50' },
      },
      {
        percent: 75,
        title: '中央控制室',
        description: '你們抵達疑似控制核心的區域。',
        reward: { stardust: 200, materials: { machine_part: 5 } },
      },
      {
        percent: 100,
        title: '古代機械遺跡完全探索',
        description: '你完成了古代機械遺跡的主要探索。',
        reward: { stardust: 350, materials: { star_shard: 1 }, title: '遺跡解讀者', badgeId: 'badge_machine_ruins_100' },
      },
    ],
  },
  astral_rift: {
    areaId: 'astral_rift',
    name: '星界裂縫',
    increment: 3,
    milestones: [
      {
        percent: 10,
        title: '星光邊境',
        description: '星界裂縫中漂浮著無數細小光點，像是未完成的願望。',
        reward: { stardust: 80 },
        storyId: 'astral_rift_story_10',
      },
      {
        percent: 25,
        title: '星屑流域',
        description: '你們開始熟悉星界碎片的流動軌跡。',
        reward: { stardust: 120, materials: { star_shard: 1 } },
      },
      {
        percent: 50,
        title: '星界旅人徽章',
        description: '你已能穩定穿越星界裂縫的一半路徑。',
        reward: { stardust: 180, title: '星界旅人', badgeId: 'badge_astral_rift_50' },
      },
      {
        percent: 75,
        title: '裂縫核心',
        description: '星界深處傳來遙遠的召喚聲。',
        reward: { stardust: 260, materials: { star_shard: 2 } },
      },
      {
        percent: 100,
        title: '星界裂縫完全探索',
        description: '你完成了星界裂縫的主要探索。',
        reward: {
          stardust: 500,
          materials: { star_shard: 3 },
          items: { item_astral_honey: 1 },
          title: '星界完成者',
          badgeId: 'badge_astral_rift_100',
        },
      },
    ],
  },
  polar_shore: {
    areaId: 'polar_shore', name: '極北冰岸', increment: 4,
    milestones: [
      { percent: 10, title: '極光航路', description: '隊伍找到風雪中的古老航路。', storyId: 'polar_shore_story_10', reward: { stardust: 60 } },
      { percent: 25, title: '冰岸補給點', description: '找到可穩定採集的冰晶。', reward: { stardust: 90, materials: { aurora_ice: 3 } } },
      { percent: 50, title: '北境巡行者', description: '能辨認寒潮前的徵兆。', reward: { stardust: 140, title: '北境巡行者', badgeId: 'badge_polar_shore_50' } },
      { percent: 75, title: '極光之夜', description: '夥伴在極光下留下新的旅途記憶。', reward: { stardust: 200, materials: { aurora_ice: 5 } } },
      { percent: 100, title: '極北冰岸完全探索', description: '完成冰岸的主要探索。', reward: { stardust: 350, materials: { aurora_ice: 5 }, title: '冰岸完成者', badgeId: 'badge_polar_shore_100' } },
    ],
  },
  harvest_fields: {
    areaId: 'harvest_fields', name: '豐穗遠郊', increment: 4,
    milestones: [
      { percent: 10, title: '村落守望', description: '認識遠郊的第一條田間小徑。', storyId: 'harvest_fields_story_10', reward: { stardust: 60 } },
      { percent: 25, title: '豐穗倉庫', description: '找到田園間保存的護符。', reward: { stardust: 90, materials: { harvest_charm: 3 } } },
      { percent: 50, title: '田野守護者', description: '隊伍已熟悉遠郊的一半道路。', reward: { stardust: 140, title: '田野守護者', badgeId: 'badge_harvest_fields_50' } },
      { percent: 75, title: '豐收祭前夜', description: '村民與夥伴分享沿途故事。', reward: { stardust: 200, materials: { harvest_charm: 5 } } },
      { percent: 100, title: '豐穗遠郊完全探索', description: '完成遠郊的主要探索。', reward: { stardust: 350, materials: { harvest_charm: 5 }, title: '遠郊完成者', badgeId: 'badge_harvest_fields_100' } },
    ],
  },
  cloudrest_trail: {
    areaId: 'cloudrest_trail', name: '雲棧古道', increment: 4,
    milestones: [
      { percent: 10, title: '無字路碑', description: '在斷橋邊找到修橋的第一張草圖。', storyId: 'cloudrest_trail_story_10', reward: { stardust: 50 } },
      { percent: 25, title: '群獸茶會', description: '替竹亭備妥補給，將各自的專長接成一條路。', storyId: 'cloudrest_trail_story_25', reward: { stardust: 80, materials: { forest_leaf: 5 } } },
      { percent: 50, title: '借一處屋簷', description: '把可以避雨的落腳處添進旅圖。', storyId: 'cloudrest_trail_story_50', reward: { stardust: 120, title: '雲棧同行者', badgeId: 'badge_cloudrest_trail_50' } },
      { percent: 75, title: '等一個腳步', description: '護送每位夥伴穿過新修的橋。', storyId: 'cloudrest_trail_story_75', reward: { stardust: 180, materials: { harvest_charm: 3 } } },
      { percent: 100, title: '山河有歸途', description: '古道重新暢通，為下一位行旅者留下補給。', storyId: 'cloudrest_trail_story_100', reward: { stardust: 300, materials: { forest_leaf: 8 }, title: '山河守諾者', badgeId: 'badge_cloudrest_trail_100' } },
    ],
  },
};

/** 探索度系統支援的地區 id 清單 */
export const EXPLORATION_AREA_IDS = Object.keys(AREA_EXPLORATION_DEFS);

/** 徽章顯示名稱（以里程碑 title 為準，這裡提供備援對照） */
const BADGE_LABELS = {
  badge_darkcrown_50: '七路守燈徽章',
  badge_darkcrown_100: '裂冠守望徽章',
  badge_lionheart_witness: '逆造見證者',
  badge_mist_forest_50: '森林巡行徽章',
  badge_mist_forest_100: '迷霧森林完成徽章',
  badge_lava_rift_50: '火脈行者徽章',
  badge_lava_rift_100: '熔岩裂谷完成徽章',
  badge_machine_ruins_50: '齒輪考古徽章',
  badge_machine_ruins_100: '古代機械遺跡完成徽章',
  badge_astral_rift_50: '星界旅人徽章',
  badge_astral_rift_100: '星界裂縫完成徽章',
  badge_polar_shore_50: '北境巡行徽章',
  badge_polar_shore_100: '極北冰岸完成徽章',
  badge_harvest_fields_50: '田野守護徽章',
  badge_harvest_fields_100: '豐穗遠郊完成徽章',
  badge_cloudrest_trail_50: '雲棧同行徽章',
  badge_cloudrest_trail_100: '山河守諾徽章',
};

function clampProgress(value) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toSafeInt(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === 'string' || typeof v === 'number');
}

/** 取得某地區依「目前 progress」應已解鎖的故事 id 清單 */
function computeUnlockedStories(areaId, progress, prevStories = []) {
  const def = AREA_EXPLORATION_DEFS[areaId];
  if (!def) return toStringArray(prevStories);
  const set = new Set(toStringArray(prevStories));
  for (const m of def.milestones) {
    if (m.storyId && progress >= m.percent) {
      set.add(m.storyId);
    }
  }
  return [...set];
}

/** 正規化單一地區探索資料 */
function normalizeArea(areaId, raw) {
  const progress = clampProgress(raw?.progress);
  const claimedMilestones = Array.isArray(raw?.claimedMilestones)
    ? raw.claimedMilestones
        .map((p) => Number(p))
        .filter((p) => MILESTONE_PERCENTS.includes(p))
    : [];
  const completedRuns = toSafeInt(raw?.completedRuns);
  const unlockedStories = computeUnlockedStories(areaId, progress, raw?.unlockedStories);
  // progress 未滿 100 不應有 completedAt；滿 100 但缺 completedAt 由更新流程補上
  const completedAt = progress >= 100 ? (raw?.completedAt ?? null) : null;
  return {
    areaId,
    progress,
    completedRuns,
    claimedMilestones: [...new Set(claimedMilestones)].sort((a, b) => a - b),
    unlockedStories,
    completedAt,
    lastExploredAt: raw?.lastExploredAt ?? null,
  };
}

/**
 * 正規化 explorationProgress 資料，補齊舊資料缺少的欄位。
 * clamp progress 到 0～100，claimedMilestones 修正為 array。
 */
export function normalizeExplorationProgress(data) {
  const areasRaw = data?.areas && typeof data.areas === 'object' ? data.areas : {};
  const areas = {};
  for (const areaId of EXPLORATION_AREA_IDS) {
    areas[areaId] = normalizeArea(areaId, areasRaw[areaId]);
  }

  const fullyExploredAreas = EXPLORATION_AREA_IDS.filter(
    (id) => areas[id].progress >= 100
  ).length;

  const stats = data?.stats && typeof data.stats === 'object' ? data.stats : {};

  return {
    key: EXPLORATION_PROGRESS_KEY,
    areas,
    unlockedBadges: toStringArray(data?.unlockedBadges),
    unlockedTitles: toStringArray(data?.unlockedTitles),
    stats: {
      totalExplorationRuns: toSafeInt(stats.totalExplorationRuns),
      totalMilestonesClaimed: toSafeInt(stats.totalMilestonesClaimed),
      fullyExploredAreas,
      lastUpdatedAt: stats.lastUpdatedAt ?? null,
    },
  };
}

/** 建立預設 explorationProgress */
export function createDefaultExplorationProgress() {
  return normalizeExplorationProgress(null);
}

/** 取得 explorationProgress（自動 normalize，必要時寫回） */
export async function getExplorationProgress() {
  const raw = await dbGet(STORES.META, EXPLORATION_PROGRESS_KEY);
  const normalized = normalizeExplorationProgress(raw);
  if (!raw) {
    await dbPut(STORES.META, normalized);
  }
  return normalized;
}

/** 初始化 explorationProgress（首次使用或遷移舊資料） */
export async function initExplorationProgress() {
  const existing = await dbGet(STORES.META, EXPLORATION_PROGRESS_KEY);
  const normalized = normalizeExplorationProgress(existing);
  await dbPut(STORES.META, normalized);
  return normalized;
}

/** 取得單一地區探索資料 */
export async function getAreaExploration(areaId) {
  const ep = await getExplorationProgress();
  return ep.areas[areaId] ?? null;
}

/** 取得某地區每次探險完成的探索度增加量 */
export function getAreaExplorationIncrement(areaId) {
  return AREA_EXPLORATION_DEFS[areaId]?.increment ?? 0;
}

/** 取得某地區里程碑定義 */
export function getExplorationMilestones(areaId) {
  return AREA_EXPLORATION_DEFS[areaId]?.milestones ?? [];
}

/** 取得某地區已解鎖故事（文字） */
export async function getUnlockedAreaStories(areaId) {
  const area = await getAreaExploration(areaId);
  if (!area) return [];
  return area.unlockedStories
    .map((id) => ({ storyId: id, text: AREA_STORIES[id] || '' }))
    .filter((s) => s.text);
}

/** 該地區是否完全探索（100%） */
export async function isAreaFullyExplored(areaId) {
  const area = await getAreaExploration(areaId);
  return !!area && area.progress >= 100;
}

/**
 * 增加某地區探索度（僅在探險成功領獎時呼叫）。
 * @param {string} areaId
 * @param {number} amount 增加量（百分比）
 * @returns {Promise<{ success: boolean, area?: object, increment?: number, newlyReachedMilestones?: object[], newlyUnlockedStories?: object[], justCompleted?: boolean, areaName?: string }>}
 */
export async function updateAreaExplorationProgress(areaId, amount) {
  const ep = await getExplorationProgress();
  const result = advanceExplorationRecord(ep, areaId, amount);
  if (result.success) await dbPut(STORES.META, result.record);
  return result;
}

/** Pure progress transition for an expedition's atomic reward transaction. */
export function advanceExplorationRecord(ep, areaId, amount) {
  const def = AREA_EXPLORATION_DEFS[areaId];
  if (!def) return { success: false };
  const inc = Number.isFinite(amount) ? amount : def.increment;
  if (inc <= 0) return { success: false };
  const area = ep.areas[areaId];
  const prevProgress = area.progress;
  const prevStories = new Set(area.unlockedStories);

  area.progress = clampProgress(prevProgress + inc);
  area.completedRuns = toSafeInt(area.completedRuns) + 1;
  area.lastExploredAt = new Date().toISOString();

  let justCompleted = false;
  if (area.progress >= 100 && !area.completedAt) {
    area.completedAt = area.lastExploredAt;
    justCompleted = true;
  }

  // 自動解鎖故事（達到 storyId 里程碑百分比）
  area.unlockedStories = computeUnlockedStories(areaId, area.progress, area.unlockedStories);
  const newlyUnlockedStories = area.unlockedStories
    .filter((id) => !prevStories.has(id))
    .map((id) => ({ storyId: id, text: AREA_STORIES[id] || '' }))
    .filter((s) => s.text);

  // 檢查新達成（可領取）里程碑
  const newlyReachedMilestones = def.milestones.filter(
    (m) => prevProgress < m.percent && area.progress >= m.percent
  );

  ep.stats.totalExplorationRuns = toSafeInt(ep.stats.totalExplorationRuns) + 1;
  ep.stats.fullyExploredAreas = EXPLORATION_AREA_IDS.filter(
    (id) => ep.areas[id].progress >= 100
  ).length;
  ep.stats.lastUpdatedAt = area.lastExploredAt;

  return {
    success: true,
    record: ep,
    area,
    areaName: def.name,
    increment: inc,
    newlyReachedMilestones,
    newlyUnlockedStories,
    justCompleted,
  };
}

/**
 * 領取地區里程碑獎勵（需使用者手動領取，不自動領取）。
 * @param {string} areaId
 * @param {number} milestonePercent
 * @returns {Promise<{ success: boolean, error?: string, milestone?: object, reward?: object, rewardText?: string }>}
 */
export async function claimExplorationMilestone(areaId, milestonePercent) {
  const def = AREA_EXPLORATION_DEFS[areaId];
  if (!def) return { success: false, error: '地區不存在' };

  const percent = Number(milestonePercent);
  const milestone = def.milestones.find((m) => m.percent === percent);
  if (!milestone) return { success: false, error: '里程碑不存在' };

  try {
    return await dbMutateRecords([
      { store: STORES.META, key: EXPLORATION_PROGRESS_KEY },
      { store: STORES.META, key: 'wallet' },
      { store: STORES.META, key: 'inventory' },
    ], ([epRaw, walletRaw, inventoryRaw]) => {
      const ep = normalizeExplorationProgress(epRaw);
      const area = ep.areas[areaId];
      if (area.progress < percent) return { puts: [], result: { success: false, error: '尚未達到此里程碑' } };
      if (area.claimedMilestones.includes(percent)) return { puts: [], result: { success: false, error: '獎勵已領取' } };
      const reward = milestone.reward || {};
      const wallet = normalizeWallet(walletRaw);
      const inventory = { ...inventoryRaw, key: 'inventory', items: { ...(inventoryRaw?.items || {}) }, itemUsageLogs: { ...(inventoryRaw?.itemUsageLogs || {}) } };
      const add = (current, amount) => {
        const value = (current || 0) + (amount || 0);
        if (!Number.isSafeInteger(value) || value < 0) throw new Error('獎勵數值需要檢查，原始紀錄已保留。');
        return value;
      };
      wallet.stardust = add(wallet.stardust, reward.stardust);
      for (const [id, amount] of Object.entries(reward.materials || {})) wallet.materials[id] = add(wallet.materials[id], amount);
      for (const [id, amount] of Object.entries(reward.items || {})) inventory.items[id] = add(inventory.items[id], amount);
      if (reward.title && !ep.unlockedTitles.includes(reward.title)) ep.unlockedTitles.push(reward.title);
      if (reward.badgeId && !ep.unlockedBadges.includes(reward.badgeId)) ep.unlockedBadges.push(reward.badgeId);
      area.claimedMilestones = [...area.claimedMilestones, percent].sort((a, b) => a - b);
      ep.stats.totalMilestonesClaimed += 1;
      ep.stats.lastUpdatedAt = new Date().toISOString();
      return { puts: [{ store: STORES.META, value: ep }, { store: STORES.META, value: wallet },
        ...(Object.keys(reward.items || {}).length ? [{ store: STORES.META, value: inventory }] : [])],
      result: { success: true, milestone, reward, rewardText: formatMilestoneReward(reward) } };
    });
  } catch (error) { return { success: false, error: error?.message || '獎勵發放失敗' }; }
}

/** 格式化里程碑獎勵文字 */
export function formatMilestoneReward(reward) {
  if (!reward) return '無';
  const parts = [];
  if (reward.stardust > 0) parts.push(`星塵 +${reward.stardust}`);
  if (reward.materials) {
    for (const [id, amt] of Object.entries(reward.materials)) {
      if (amt > 0) parts.push(`${MATERIAL_LABELS[id] || id} +${amt}`);
    }
  }
  if (reward.items) {
    for (const [id, amt] of Object.entries(reward.items)) {
      if (amt > 0) parts.push(`${REWARD_ITEM_LABELS[id] || id} +${amt}`);
    }
  }
  if (reward.title) parts.push(`稱號「${reward.title}」`);
  if (reward.badgeId) parts.push(`徽章「${BADGE_LABELS[reward.badgeId] || reward.badgeId}」`);
  return parts.length > 0 ? parts.join('、') : '無';
}

/** 取得獎勵的 chip 顯示資料（供 UI 分類上色） */
export function getRewardChips(reward) {
  if (!reward) return [];
  const chips = [];
  if (reward.stardust > 0) {
    chips.push({ type: 'stardust', label: `星塵 +${reward.stardust}` });
  }
  if (reward.materials) {
    for (const [id, amt] of Object.entries(reward.materials)) {
      if (amt > 0) chips.push({ type: 'material', label: `${MATERIAL_LABELS[id] || id} +${amt}` });
    }
  }
  if (reward.items) {
    for (const [id, amt] of Object.entries(reward.items)) {
      if (amt > 0) chips.push({ type: 'item', label: `${REWARD_ITEM_LABELS[id] || id} +${amt}` });
    }
  }
  if (reward.title) {
    chips.push({ type: 'title', label: `稱號「${reward.title}」` });
  }
  if (reward.badgeId) {
    chips.push({ type: 'title', label: `徽章「${BADGE_LABELS[reward.badgeId] || reward.badgeId}」` });
  }
  return chips;
}

/**
 * 取得供 UI 使用的探索度摘要。
 */
export async function getExplorationSummary() {
  const ep = await getExplorationProgress();

  const areas = EXPLORATION_AREA_IDS.map((areaId) => {
    const def = AREA_EXPLORATION_DEFS[areaId];
    const area = ep.areas[areaId];
    const milestones = def.milestones.map((m) => {
      let status = 'locked';
      if (area.claimedMilestones.includes(m.percent)) status = 'claimed';
      else if (area.progress >= m.percent) status = 'claimable';
      return {
        percent: m.percent,
        title: m.title,
        description: m.description,
        reward: m.reward,
        rewardChips: getRewardChips(m.reward),
        storyId: m.storyId || null,
        status,
      };
    });

    const nextMilestone = milestones.find((m) => area.progress < m.percent) || null;
    const claimableCount = milestones.filter((m) => m.status === 'claimable').length;
    const stories = area.unlockedStories
      .map((id) => ({ storyId: id, text: AREA_STORIES[id] || '' }))
      .filter((s) => s.text);
    // 尚未解鎖的第一個故事百分比（供 locked 提示）
    const firstStoryMilestone = def.milestones.find((m) => m.storyId);
    const storyLockedPercent = firstStoryMilestone ? firstStoryMilestone.percent : 10;

    return {
      areaId,
      name: def.name,
      increment: def.increment,
      progress: area.progress,
      completedRuns: area.completedRuns,
      completedAt: area.completedAt,
      lastExploredAt: area.lastExploredAt,
      fullyExplored: area.progress >= 100,
      milestones,
      nextMilestone,
      claimableCount,
      stories,
      storyLockedPercent,
      hasStory: stories.length > 0,
    };
  });

  const totalClaimable = areas.reduce((sum, a) => sum + a.claimableCount, 0);

  return {
    areas,
    unlockedBadges: [...ep.unlockedBadges],
    unlockedTitles: [...ep.unlockedTitles],
    stats: { ...ep.stats },
    totalClaimable,
  };
}

/** 匯出 explorationProgress（備份用） */
export async function exportExplorationProgress() {
  return getExplorationProgress();
}
