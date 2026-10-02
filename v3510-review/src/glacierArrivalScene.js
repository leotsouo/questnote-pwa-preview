/** Owned scenery for the glacier_arrival template. No catalog HTML or remote assets. */
export function createGlacierArrivalScene() {
  const scene = document.createElement('div');
  scene.className = 'glacier-scene';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = `
    <div class="glacier-scene__sky"></div>
    <svg class="glacier-scene__landscape" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
      <g class="glacier-scene__distant">
        <path fill="#608a9a" d="M0 530 90 340 170 440 280 270 380 440 490 345 610 445 730 240 860 420 940 350 1000 500V1000H0Z"/>
        <path fill="#adcbd0" d="m170 440 110-170 100 170-86-91-34 42-18-26Zm440 5 120-205 130 180-111-114-32 40-20-10Z"/>
        <path fill="#163c49" d="M0 567 250 510 400 555 590 548 780 510 1000 555V1000H0Z"/>
      </g>
      <path class="glacier-scene__channel" fill="#397889" d="M468 551 531 551 586 665 850 1000H150L416 667Z"/>
      <g class="glacier-scene__ripples" fill="none" stroke="#a0d0d7" stroke-width="2" opacity=".35">
        <path d="M462 613h76m-103 64h123m-181 89h234M296 886h396M210 979h577"/>
      </g>
      <g class="glacier-scene__wall glacier-scene__wall--left">
        <path fill="#25546a" d="M0 0h180l63 270 92 65 66 279-190 140L0 880Z"/>
        <path fill="#75b0c0" d="M0 0h180l-66 330 129-60-65 206 157-141-66 284-161 157L0 753Z"/>
        <path fill="#c4e4e7" d="M0 0h84L42 352l72-22L0 540Zm180 0 63 270-58 16 28-105Z"/>
        <path fill="#45859b" d="m178 476 91 143 66-284 66 279-190 140-33-278Z"/>
        <path fill="none" stroke="#acd8df" stroke-width="3" opacity=".5" d="m90 133-25 340 43 139m108-319-62 108 35 222"/>
      </g>
      <g class="glacier-scene__wall glacier-scene__wall--right">
        <path fill="#173f55" d="M1000 0H832l-61 214-69 67-91 338 166 143 223 114Z"/>
        <path fill="#6fa6b7" d="M1000 0H832l23 261-84-47 48 195-117-128-40 262 115 219 77-326 146 267Z"/>
        <path fill="#b5d9de" d="M938 0h62v515l-63-235-37 57Zm-106 0-61 214 45 34 27-141Z"/>
        <path fill="#38728a" d="m662 543 115 219-166-143 91-338Z"/>
        <path fill="none" stroke="#9dd2de" stroke-width="3" opacity=".5" d="m881 136 23 289-46 89m-115-171 34 129-38 185"/>
      </g>
      <g class="glacier-scene__harbour" fill="#162d35" stroke="#9b7860" stroke-width="2">
        <path d="m399 554 20-20 24 20v23h-44Zm165 0 24-21 23 21v23h-47Z"/>
        <path d="M382 580h247m-235 0v25m220-25v25"/>
      </g>
      <g class="glacier-scene__ship">
        <path fill="#9d4432" stroke="#b18a60" stroke-width="2" d="M505 595v-91q-30 6-39 15l-12 58q28-6 51 18Z"/>
        <path fill="none" stroke="#d6bb86" stroke-width="3" d="M506 495v135m-54-110 75-22"/>
        <path fill="#201f24" stroke="#af8561" stroke-width="3" d="M441 612q57 24 113-6l-19 29h-68Z"/>
      </g>
      <g class="glacier-scene__ice" fill="#a4d5db" opacity=".8">
        <path d="m258 805 62-12 21 13-71 9Zm422 62 66 2 12 15-56 2ZM349 955l65-18 18 15-47 13Z"/>
      </g>
    </svg>
    <div class="glacier-scene__fog"></div>
    <div class="glacier-scene__beacons">
      <i style="--x:23%;--y:76%;--i:0"></i><i style="--x:77%;--y:76%;--i:1"></i>
      <i style="--x:36%;--y:65%;--i:2"></i><i style="--x:64%;--y:65%;--i:3"></i>
      <i style="--x:43%;--y:57%;--i:4"></i><i style="--x:57%;--y:57%;--i:5"></i>
    </div>
    <div class="glacier-scene__oath"></div>
    <div class="glacier-scene__vignette"></div>
  `;
  return scene;
}
