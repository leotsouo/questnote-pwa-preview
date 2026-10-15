/** Original local scenery, reusing the existing moon, mist and flower vocabulary. */
export function createEncounterScenery(world = 'bloom', motif = 'garden') {
  const scene = document.createElement('div');
  scene.className = `encounter-scene encounter-scene--${world}`;
  scene.dataset.motif = motif;
  scene.dataset.world = world;
  scene.setAttribute('aria-hidden', 'true');
  const stars = Array.from({ length: 18 }, (_, i) => `<i style="--i:${i};left:${8 + (i * 37) % 84}%;top:${8 + (i * 19) % 44}%"></i>`).join('');
  const petals = Array.from({ length: 14 }, (_, i) => `<i style="--i:${i};left:${(i * 31) % 100}%"></i>`).join('');
  scene.innerHTML = world === 'stars' ? `
    <div class="encounter-stars">${stars}</div>
    <svg class="encounter-landscape" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
      <g class="encounter-constellation" fill="none" stroke="#d6cfaa" stroke-width="2"><path d="m180 245 150-110 190 105 180-95 130 165M330 135l30 215 160-110"/><g fill="#f3e5b7"><circle cx="180" cy="245" r="5"/><circle cx="330" cy="135" r="7"/><circle cx="520" cy="240" r="6"/><circle cx="700" cy="145" r="5"/><circle cx="830" cy="310" r="6"/></g></g>
      <path fill="#1b3741" d="M0 650 150 435 265 575 420 370 570 570 730 410 1000 645V1000H0Z"/>
      <path fill="#102a30" d="M0 790 190 620 320 730 530 560 790 740 1000 650V1000H0Z"/>
      <path class="encounter-path" d="M480 910q-180-165 30-220t-5-145" fill="none" stroke="#d2ba85" stroke-width="3" pathLength="1"/>
    </svg><div class="encounter-gateway"><i></i><i></i><b></b></div><div class="encounter-mist"></div>` : `
    <div class="encounter-moon"><div class="dream-debut-mirror__glow"></div></div>
    <svg class="encounter-landscape" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
      <path fill="#252544" d="M0 590q180-155 340-30t350-40q170-95 310 50v430H0Z"/>
      <path fill="#171d36" d="M0 750q200-210 400-90t600-45v385H0Z"/>
      <ellipse class="encounter-mirror" cx="500" cy="620" rx="270" ry="60" fill="#a69dba33" stroke="#c9bce655"/>
      <g fill="#8c7094" opacity=".7"><path d="m70 660 20-190 35 190Zm90 50 20-220 40 220Zm645-30 28-185 35 185Zm85 70 30-260 35 260Z"/></g>
    </svg><div class="encounter-mist"></div><div class="encounter-petals">${petals}</div>
    <div class="encounter-flower"><div class="dream-debut-flower__aura"></div>${Array.from({length:5},(_,i)=>`<i style="--i:${i}"></i>`).join('')}<b></b></div>`;
  return scene;
}
