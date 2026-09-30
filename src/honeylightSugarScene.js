/** Owned, local scenery; catalog copy never enters the markup. */
export function createHoneylightSugarScene() {
  const scene = document.createElement('div');
  scene.className = 'sugar-scene';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = `
    <div class="sugar-scene__sky"></div>
    <svg class="sugar-scene__garden" viewBox="0 0 900 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs><linearGradient id="sugar-glass" x2="0" y2="1"><stop stop-color="#fff5d9" stop-opacity=".28"/><stop offset="1" stop-color="#f4b4ce" stop-opacity=".08"/></linearGradient></defs>
      <path d="M100 1000V370Q450 -10 800 370V1000Z" fill="url(#sugar-glass)" stroke="#f6d6a2" stroke-width="5"/>
      <g fill="none" stroke="#f6d6a2" stroke-width="3" opacity=".5"><path d="M100 400H800M100 650H800M100 830H800M450 90V1000M240 200V1000M660 200V1000"/></g>
      <g class="sugar-scene__gate sugar-scene__gate--left"><path d="M280 990V480Q290 340 448 300V990Z" fill="#512d47" fill-opacity=".7" stroke="#ffe2ac" stroke-width="6"/><path d="M310 920V495Q330 395 415 365V920Z" fill="none" stroke="#efbda4" stroke-width="2"/></g>
      <g class="sugar-scene__gate sugar-scene__gate--right"><path d="M620 990V480Q610 340 452 300V990Z" fill="#512d47" fill-opacity=".7" stroke="#ffe2ac" stroke-width="6"/><path d="M590 920V495Q570 395 485 365V920Z" fill="none" stroke="#efbda4" stroke-width="2"/></g>
      <path d="M260 1000Q450 720 640 1000" fill="#fff2d1" opacity=".18"/>
    </svg>
    <div class="sugar-scene__light"></div>
    <div class="sugar-scene__crystals">${Array.from({ length: 12 }, (_, i) => `<i style="--i:${i};--x:${12 + (i * 29) % 76}%;--y:${16 + (i * 17) % 66}%"></i>`).join('')}</div>
    <div class="sugar-scene__candy"><i></i><b></b><i></i></div>
    <div class="sugar-scene__cream">${Array.from({ length: 7 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}<b></b></div>
    <div class="sugar-scene__vignette"></div>`;
  return scene;
}

/** The same state machine, with a shorter sugar-specific prelude. */
export function sugarPreludeDurations(rarity, mode, reduced) {
  if (reduced) return [80, 80, 100, 100];
  const finish = { N: 650, R: 700, SR: 850, SSR: 1000, UR: 1200 }[rarity] ?? 650;
  return [850, mode === 'ten' ? 850 : 750, 750, finish];
}
