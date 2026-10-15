/** Original local SVG scenery. Pure presentation; no transactions or storage. */
import { summonPreludeDurations } from './summonTiming.js';

export function swordwildPreludeDurations(rarity, mode, reduced) {
  void rarity;
  void mode;
  return summonPreludeDurations(reduced);
}

export function createSwordwildShanheScene(motif = 'summon') {
  const scene = document.createElement('div');
  scene.className = 'swordwild-scene';
  scene.dataset.motif = ['eagle', 'toad', 'ape', 'ink'].includes(motif) ? motif : 'summon';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = `
    <div class="shanhe-paper"></div>
    <svg class="shanhe-landscape" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
      <circle cx="694" cy="235" r="81" fill="#b7b492" opacity=".28"/>
      <g class="shanhe-ridges shanhe-ridges--far" fill="#578178">
        <path d="M0 568 80 435 150 481 256 225 331 411 401 327 503 473 578 294 655 428 739 170 826 387 918 324 1000 508V1000H0Z"/>
        <path d="m251 252 31 113 35 52-42-15-39 95 17-175Z" fill="#c8d2b8" opacity=".6"/>
        <path d="m739 184-55 205 51-69 33 44-15-116Z" fill="#c8d2b8" opacity=".45"/>
      </g>
      <g class="shanhe-ridges shanhe-ridges--near" fill="#163f39">
        <path d="M0 476 132 364 174 514 281 593 332 790 120 1000H0Zm1000-11-141-128-26 165-107 119-61 185 226 194h109Z"/>
        <path d="m45 580 101-159 9 137 84 67-133 58Zm800 123 25-139 84-100-53 192Z" fill="#396a56"/>
      </g>
      <path class="shanhe-trail" d="M346 1000q201-168 147-265t3-135q35-44-7-112" fill="none" stroke="#d0b679" stroke-width="22" opacity=".5"/>
      <path class="shanhe-trail-line" d="M346 1000q201-168 147-265t3-135q35-44-7-112" fill="none" stroke="#f7e5ae" stroke-width="2" pathLength="1"/>
      <g class="shanhe-bridge" fill="none" stroke="#a6976e" stroke-width="5">
        <path d="M372 711q125-90 257-8m-244-11q112-94 232-10m-232 10-13 19m41-39-8 20m41-36-5 19m40-30v22m36-30 4 22m34-21 5 20m34-15 6 20m25-5 5 20"/>
      </g>
      <g class="shanhe-bamboo" fill="none" stroke="#598b63" stroke-width="7">
        <path d="M74 1000 182 600m-67 252 43-7m-12-116 40-4M948 1000 842 574m33 244 35-9m-69-120 30-7"/>
      </g>
      <g class="shanhe-leaves" fill="#779863">
        <path d="m160 665-73-37 50 65Zm15 41 45-84-11 68ZM121 822l-75-24 51 56Zm750-175 57-89-22 80Zm-4 71-63-53 26 57Zm20 98 76-35-43 65Z"/>
      </g>
    </svg>
    <div class="shanhe-scroll"><i></i><i></i></div>
    <div class="shanhe-cloud shanhe-cloud--left"></div><div class="shanhe-cloud shanhe-cloud--right"></div>
    <div class="shanhe-sword-stroke"></div>
    <div class="shanhe-seals"><span>俠</span></div>
    <svg class="shanhe-motif" viewBox="0 0 1000 1000" focusable="false">
      <g class="shanhe-wing" fill="#c9b17d" stroke="#f4e3b5" stroke-width="2">
        <path d="M498 455Q378 374 207 192l52 155-149-69 129 145-169-30 177 103-158 5 189 59-112 35 197-5 123-75Z"/>
        <path d="M502 455Q622 374 793 192l-52 155 149-69-129 145 169-30-177 103 158 5-189 59 112 35-197-5-123-75Z"/>
      </g>
      <g class="shanhe-territory" fill="none" stroke="#e49862" stroke-width="4">
        <ellipse cx="500" cy="753" rx="345" ry="77"/><ellipse cx="500" cy="753" rx="285" ry="52"/>
        <path d="m239 730 41-9m440 9-41-9M465 805h70"/>
      </g>
      <g class="shanhe-sword" fill="none" stroke="#f9edc7">
        <path d="m273 807 447-552-15 56-409 510Z" fill="#d5dcb4" stroke-width="2"/>
        <path d="m262 783 60 47m-43-24-34 43" stroke-width="8"/>
        <path class="shanhe-cut" d="M211 668q356-247 616-300" stroke-width="3" pathLength="1"/>
      </g>
    </svg>
    <div class="shanhe-vignette"></div>
  `;
  return scene;
}
