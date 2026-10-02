/** UI-only theme identities, shared by preferences and backup validation. */
export const SUPPORTED_THEMES = Object.freeze(['default', 'sweet', 'twilight']);
export const THEME_COLORS = Object.freeze({
  default: '#101a2b',
  sweet: '#fff8f2',
  twilight: '#172330',
});

export const THEME_DIRECTIONS = Object.freeze({
  default: { name: '星夜遠行', legacyName: '深色幻想風', chapter: 'THE NIGHT JOURNEY', greeting: '把今天，\n點成星光。', statement: '在深藍星夜的營地，與幻獸校準今天的目標，把每一次完成化為前行的星光。', hero: './assets/scenes/night-graywolf.webp' },
  sweet: { name: '晨光花園', legacyName: '甜美可愛風', chapter: 'A LITTLE GROWTH', greeting: '小事，也\n慢慢開花。', statement: '在柔和晨光的花園，和熟悉的夥伴把日常小事照顧成值得期待的成長。', hero: './assets/scenes/garden-graywolf.webp' },
  twilight: { name: '暮光冒險手帳', legacyName: '暮光冒險手帳', chapter: 'YOUR DAILY CHAPTER', greeting: '今天，也\n一起前進。', statement: '在安靜的森林暮色裡，與夥伴把日常小事寫成共同成長的旅程。', hero: './assets/scenes/twilight-graywolf.webp' },
});
