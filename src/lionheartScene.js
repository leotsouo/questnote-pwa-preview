/** Original city / natural wind / inverse machinery scenery. Presentation only. */
export function lionheartPreludeDurations(reduced) {
  return reduced ? [100, 100, 150, 150] : [650, 750, 900, 700];
}

export function createLionheartScene(motif = 'summon') {
  const scene = document.createElement('div');
  scene.className = 'lionheart-scene';
  scene.dataset.motif = ['griffin', 'chimera', 'bridge', 'roots'].includes(motif) ? motif : 'summon';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = `
    <svg class="lionheart-city" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
      <path class="lionheart-cloud" d="M-100 230Q200 50 500 240T1100 180M-100 360Q280 210 560 350T1100 280" fill="none" stroke="#b3c8c3" stroke-width="95" opacity=".16"/>
      <path d="M0 690 180 360 270 420 340 270 420 520 500 700V1000H0Z" fill="#314943"/>
      <path d="M0 810 170 520 230 560 315 415 400 650 510 850V1000H0Z" fill="#172d2b"/>
      <g fill="#533f32" stroke="#a88758" stroke-width="5">
        <path d="M600 770V370h65v400m40 0V245h70v525m50 0V415h80v355M550 770h450v230H550Z"/>
        <path d="m682 245 58-70 58 70ZM570 615h430v40H570Z" fill="#3c5550"/>
      </g>
      <g class="lionheart-bridge" fill="none" stroke="#b99b6b" stroke-width="9">
        <path d="M190 740H1000M200 690H1000M260 690v50m110-50v50m110-50v50m110-50v50m110-50v50m110-50v50m110-50v50"/>
      </g>
      <g class="lionheart-gear" fill="none" stroke="#d4ae73" stroke-width="12">
        <circle cx="740" cy="315" r="52"/><circle cx="740" cy="315" r="18"/>
        <path d="M740 250v130m-65-65h130m-110-45 90 90m0-90-90 90"/>
      </g>
      <g class="lionheart-roots" fill="none" stroke="#86ad7a" stroke-width="11">
        <path d="M660 1000q-30-140 90-220m-75 118-65-50m70 60 80-45m-45-50-35-65"/>
      </g>
    </svg>
    <div class="lionheart-gate"><i></i><i></i></div>
    <svg class="lionheart-natural" viewBox="0 0 1000 1000" focusable="false">
      <g class="lionheart-feathers" fill="#dfd5b8" stroke="#fff1ce" stroke-width="2">
        <path d="M497 470Q385 335 170 210l60 160-155-68 133 142-162-27 173 104-131 19 185 47-107 45 180-19 121-83Z"/>
        <path d="M503 470Q615 335 830 210l-60 160 155-68-133 142 162-27-173 104 131 19-185 47 107 45-180-19-121-83Z"/>
      </g>
      <g class="lionheart-wind" fill="none" stroke="#c4e0d7" stroke-width="5">
        <path d="M90 660Q500 350 910 660M140 720Q500 440 860 720M230 775Q500 560 770 775" pathLength="1"/>
      </g>
    </svg>
    <svg class="lionheart-artificial" viewBox="0 0 1000 1000" focusable="false">
      <g class="lionheart-wingframe" fill="#ad7446" stroke="#eed1a1" stroke-width="5">
        <path d="m495 480-290-245 40 150-125-35 125 130-110 15 175 73 100-5Z"/>
        <path d="m505 480 290-245-40 150 125-35-125 130 110 15-175 73-100-5Z"/>
        <path d="m205 235 205 328m-165-178 165 178m385-328L590 563m165-178L590 563" fill="none"/>
      </g>
      <g class="lionheart-pistons" fill="#573e31" stroke="#e5ac6b" stroke-width="6">
        <path d="M440 570v120h35V570Zm85 0v120h35V570Z"/>
      </g>
    </svg>
    <div class="lionheart-steam lionheart-steam--left"></div><div class="lionheart-steam lionheart-steam--right"></div>
    <div class="lionheart-pressure"><i></i></div>
    <div class="lionheart-vignette"></div>
    ${motif === 'griffin' ? `
      <svg class="lionheart-reveal-wind" viewBox="0 0 1000 1000" preserveAspectRatio="none" focusable="false">
        <g class="lionheart-wind-trails" fill="none" stroke="#d2eee5" stroke-linecap="round">
          <path style="--gust-delay:0s" d="M-150 790C170 830 310 690 175 585S130 285 460 220S845 190 1090 75"/>
          <path style="--gust-delay:-.7s" d="M-120 890C200 970 440 805 255 690S95 350 390 305S805 255 1110 135"/>
          <path style="--gust-delay:-1.3s" d="M-130 180C195 95 620 90 825 260S765 475 865 620S1100 745 1190 665"/>
          <path style="--gust-delay:-1.9s" d="M-90 115C190 35 645 55 895 225S805 535 925 660S1110 825 1190 750"/>
          <path style="--gust-delay:-.4s" d="M-100 945C285 1010 580 835 815 765S1010 595 1140 525"/>
          <path style="--gust-delay:-1.6s" d="M-120 865C250 965 530 790 790 710S965 560 1130 465"/>
        </g>
      </svg>
      <div class="lionheart-wind-motes">${Array.from({ length: 8 }, (_, i) => `<i style="--mote-y:${18 + i * 10}%;--mote-delay:${-i * .37}s"></i>`).join('')}</div>
    ` : ''}
    ${motif === 'chimera' ? `
      <div class="lionheart-reveal-steam">
        ${['left', 'right'].map((side) => `<div class="lionheart-steam-jet lionheart-steam-jet--${side}">${Array.from({ length: 8 }, (_, i) => `<i style="--steam-delay:${-i * .32}s;--steam-drift:${(i % 3 - 1) * 24}px;--steam-size:${72 + (i % 3) * 24}px"></i>`).join('')}</div>`).join('')}
      </div>
    ` : ''}
  `;
  return scene;
}
