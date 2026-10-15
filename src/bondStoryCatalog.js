/** Pure authored story validation and additive pool supplements. */
const CHAPTER_LEVELS = [2, 3, 4, 5];

export function validateBondStories(catalog, pets = []) {
  const errors = [];
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.stories)) return ['故事目錄格式無效'];
  const seen = new Set();
  const text = (value) => typeof value === 'string' && value.trim().length > 0;
  for (const story of catalog.stories) {
    if (!/^pet_[a-z0-9]+$/i.test(story?.petId) || seen.has(story.petId)) errors.push('故事角色 ID 重複或無效');
    seen.add(story?.petId);
    if (!text(story?.title) || !text(story?.keepsake?.name) || !text(story?.keepsake?.description)) errors.push(`${story?.petId}: 缺少紀念物`);
    if (!Array.isArray(story?.chapters) || story.chapters.length !== 4) { errors.push(`${story?.petId}: 需要四章故事`); continue; }
    story.chapters.forEach((chapter, index) => {
      if (!chapter || chapter.level !== CHAPTER_LEVELS[index] || !text(chapter.title) || !text(chapter.invitation)
        || !text(chapter.ending) || !Array.isArray(chapter.paragraphs) || chapter.paragraphs.length < 2
        || !chapter.paragraphs.every(text) || !Array.isArray(chapter.choices) || chapter.choices.length !== 2
        || chapter.choices[0]?.id !== 'gentle' || chapter.choices[1]?.id !== 'steady'
        || !chapter.choices.every((choice) => text(choice?.label) && text(choice?.reply))) errors.push(`${story.petId}: 章節 ${index + 1} 無效`);
    });
    if (pets.length && !pets.some((pet) => pet.id === story.petId)) errors.push(`${story.petId}: 未知角色`);
  }
  for (const pet of pets) if (!seen.has(pet.id)) errors.push(`${pet.id}: 未收錄故事`);
  return errors;
}


export function mergeBondStorySupplements(catalog, loreCatalog) {
  const stories = [...(catalog?.stories || [])];
  const seen = new Set(stories.map((story) => story.petId));
  for (const entry of loreCatalog?.lore || []) {
    if (entry.bondJourneyStory === undefined) continue;
    const story = entry.bondJourneyStory;
    if (story?.petId !== entry.id || seen.has(story?.petId)) throw new Error('羈絆故事補充 ID 無效或覆寫既有角色');
    seen.add(story.petId); stories.push(story);
  }
  const merged = { ...catalog, stories };
  const errors = validateBondStories(merged);
  if (errors.length) throw new Error(errors.join('；'));
  return merged;
}
