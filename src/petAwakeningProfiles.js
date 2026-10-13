/** Controlled trial routing; authoring IDs allocated by chaos_demon_court pipeline. */
export const SWORDWILD_AWAKENING_IDS = Object.freeze([
  'pet_n36','pet_n37','pet_n38','pet_r36','pet_r37','pet_r38','pet_r39','pet_r40',
  'pet_sr30','pet_sr31','pet_sr32','pet_sr33','pet_sr34',
  'pet_ssr21','pet_ssr22','pet_ssr23','pet_ssr24','pet_ur16','pet_ur17','pet_ur18',
]);
export const DARKCOURT_AWAKENING_IDS = Object.freeze(['pet_ssr37','pet_ssr38','pet_ssr39','pet_ssr40','pet_ur28','pet_ur29','pet_ur30']);
export const FAIRY_AWAKENING_IDS = Object.freeze(['pet_ssr41', 'pet_ssr42', 'pet_ur31', 'pet_ur32']);
export const AWAKENING_PROFILES = Object.freeze([
  Object.freeze({poolId:'aurora_fairy_feast',name:'霓霞仙膳',petIds:FAIRY_AWAKENING_IDS,
    areaId:'aurora_feast_garden',areaName:'霓霞膳庭',foodId:'item_aurora_flower_tart',foodName:'霓霞花露塔',journeyLabel:'膳庭同行',eyebrow:'晨昏共席',countLabel:'四位 SSR／UR 可覺醒為仙女；其餘保持靈獸'}),
  Object.freeze({poolId:'swordwild_shanhe_v3',name:'劍隱山河',petIds:SWORDWILD_AWAKENING_IDS,
    areaId:'cloudrest_trail',areaName:'雲棧古道',foodId:'item_pine_trail_riceball',foodName:'松香行旅糰',journeyLabel:'古道同行',eyebrow:'一諾同行',countLabel:'二十位夥伴都可覺醒'}),
  Object.freeze({poolId:'darkcrown_court_release',name:'黯冠王庭',petIds:DARKCOURT_AWAKENING_IDS,
    areaId:'darkcrown_border',areaName:'黯冠邊境',foodId:'item_chaos_ember_tart',foodName:'黯莓餘燼塔',journeyLabel:'邊境同行',eyebrow:'裂冠有名',countLabel:'七位 UR／SSR 可覺醒為人形惡魔；其餘保持魔獸'}),
]);
export const getAwakeningProfile = (petId) => AWAKENING_PROFILES.find(p=>p.petIds.includes(petId)) || null;
export const getPoolAwakeningProfile = (poolId) => AWAKENING_PROFILES.find(p=>p.poolId===poolId) || null;
