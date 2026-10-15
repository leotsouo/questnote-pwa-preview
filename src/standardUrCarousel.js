import { getPetImageSrc } from './imagePreloadService.js';

export function getStandardUrPreviews(model) {
  return model?.poolId === 'standard'
    ? model.eligiblePets.filter((pet) => pet.rarity === 'UR') : [];
}

export function createStandardUrCarousel(host, { imageSrc = getPetImageSrc } = {}) {
  let pets = [];
  let index = 0;
  const image = host.querySelector('img');
  const name = host.querySelector('[data-carousel-name]');
  const count = host.querySelector('[data-carousel-count]');
  const button = host.querySelector('button');
  const show = () => {
    const pet = pets[index];
    if (!pet) return;
    const label = pet.title?.trim() || '';
    name.textContent = label;
    name.hidden = !label;
    count.textContent = `${index + 1} / ${pets.length}`;
    image.alt = label ? `${label}・UR 黑白預覽` : 'UR 角色黑白預覽';
    const src = imageSrc(pet, 'stage');
    if (image.dataset.src === src) return;
    image.classList.add('is-loading');
    image.dataset.src = src;
    image.onload = () => {
      if (image.dataset.src === src) image.classList.remove('is-loading');
    };
    image.onerror = () => {
      if (image.dataset.src !== src) return;
      image.onerror = null;
      const original = imageSrc(pet);
      if (original && original !== src) image.src = original;
    };
    if (src) image.src = src;
    else image.removeAttribute('src');
  };
  button.onclick = () => {
    if (!pets.length) return;
    index = (index + 1) % pets.length;
    show();
  };
  return {
    render(model) {
      const currentId = pets[index]?.id;
      pets = getStandardUrPreviews(model);
      index = Math.max(0, pets.findIndex((pet) => pet.id === currentId));
      host.hidden = pets.length === 0;
      button.disabled = pets.length < 2;
      show();
    },
  };
}
