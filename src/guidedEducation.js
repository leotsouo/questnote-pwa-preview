/** Small, optional explanations at the feature the person actually opens. */
export const GUIDED_EDUCATION = Object.freeze({
  tasks: { title: '從今天的一件小事開始', body: '點「新增任務」，記下你想做的事。做完後，點那一件任務的「完成」。' },
  gacha: { title: '星塵，讓你遇見新夥伴', body: '先看「星塵總量」與召喚費用，再決定是否相遇。查看角色與機率不用花星塵；不用為了教學召喚。' },
  collection: { title: '找到已經相遇的夥伴', body: '選「已相遇」，點一位夥伴，再選「設為陪伴」。牠就會出現在首頁，陪你完成生活中的小事。' },
  expedition: { title: '準備好，再一起出發', body: '選一個地區，查看時間與能量，再選隊伍。確認後才會出發；時間到，回來閱讀報告並領收穫。', lesson: 'expedition' },
  workshop: { title: '把材料做成一份心意', body: '先看配方與你已有的材料。確認製作才會扣材料；做好後，可以選一位夥伴送禮。', lesson: 'workshop' },
  habits: { title: '每天一點點，也算前進', body: '新增一個想持續的習慣。今天做到了，就在那個習慣上打卡；不用一次設定很多個。' },
  settings: { title: '調成自己舒服的樣子', body: '可以調整字體大小、主題與減少動態效果。想保留這台裝置的紀錄，請先匯出備份，再更換裝置。' },
  'pet-care': { title: '相遇與親密度，慢慢累積', body: '再次相遇會得到跨卡池共用的相遇碎片，用來指定邀請新夥伴。完成自己的任務、摸摸或送禮會累積親密度。先看費用與條件，再決定要不要操作。', lesson: 'invitation' },
});

export function contextualEducation(record, feature) {
  if (!['completed', 'skipped'].includes(record?.status)
    || record.hintsAcknowledged?.includes(feature)
    || (feature === 'tasks' && record.status === 'completed')) return null;
  return GUIDED_EDUCATION[feature] || null;
}
