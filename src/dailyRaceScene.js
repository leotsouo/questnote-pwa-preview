// Presentation only: the caller supplies an already settled winner.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const RACE_SCENE_MS = 20000;
export const RACE_SCRIPTS = [
  { id: 'normal', label: '正常賽跑', title: '星光競速', ending: '一路你追我趕，這次的冠軍誕生了。' },
  { id: 'living-finish', label: '劇本 1 · 活眼終點', title: '終點今天不想上班', ending: '終於追上了！那顆眼睛看起來還不太服氣。' },
  { id: 'nap', label: '劇本 2 · 領先者打瞌睡', title: '領先太多，先睡一下', ending: '比賽結束。剛才睡覺的那位還在問早餐在哪。' },
  { id: 'wrong-way', label: '劇本 3 · 全員跑錯方向', title: '很有默契，全部跑反', ending: '跑錯路不尷尬，四位一起跑錯就很有氣勢。' },
];

export function pickRaceScript(randomByte = () => crypto.getRandomValues(new Uint8Array(1))[0]) {
  const byte = randomByte();
  if (!Number.isInteger(byte) || byte < 0 || byte > 255) throw new Error('Invalid script random byte');
  return RACE_SCRIPTS[byte % 4].id;
}

const storyBeats = {
  normal: [
    ['ready', '各就各位', '四位選手就位。今天誰能先抵達終點？'],
    ['run', '比賽開始！', '起跑！前方兩位選手正在爭奪領先。'],
    ['chase', '後方追上來了', '距離逐漸拉近，名次還沒定下來。'],
    ['tease', '誰也不讓誰', '四位選手都在加速，最後一段了！'],
    ['sprint', '最後衝刺！', '終點就在前方，看誰能率先衝線！'],
  ],
  'living-finish': [
    ['ready', '各就各位', '終點……剛剛是不是眨眼了？'],
    ['run', '比賽開始！', '起跑！請各位朝著那顆眼睛前進。'],
    ['escape', '等一下，終點在動？', '它跑回來了！等等，又溜走了！'],
    ['tease', '它正在偷看選手', '那顆眼睛一直往後瞄，絕對是故意的。'],
    ['sprint', '最後一段追逐！', '夥伴們追上來了！這次能追到嗎？'],
  ],
  nap: [
    ['ready', '各就各位', '選手們精神飽滿。至少看起來是。'],
    ['run', '有位選手衝出去了', '領先好多！它好像覺得已經贏了。'],
    ['sleep', '領先者睡著了？！', '它停下來打瞌睡了。這裡不是午睡區！'],
    ['wake', '醒醒，比賽還沒完！', '其他選手都超過去了！它終於醒了！'],
    ['sprint', '起床後的全力衝刺', '剛睡醒也得跑！大家都往終點衝！'],
  ],
  'wrong-way': [
    ['ready', '各就各位', '出發前，應該有人確認過方向吧？'],
    ['wrong', '等一下，方向反了', '四位一起往回跑。默契滿分，方向零分。'],
    ['turn', '終點在另一邊！', '全員緊急掉頭！剛才那段當作暖身。'],
    ['chase', '這次方向對了', '這次真的朝終點前進了，名次重新洗牌！'],
    ['sprint', '請保持這個方向', '最後衝刺！不要再回頭了！'],
  ],
};
// Four different chase trajectories. Roles rotate with the saved winner, never the bet.
const livingKeys = [
  [0, [0, 0, 0, 0], .70], [.10, [.01, .01, .01, .01], .70],
  [.29, [.27, .42, .33, .22], .70], [.38, [.27, .42, .33, .22], .96],
  [.43, [.29, .43, .34, .25], .79], [.52, [.43, .46, .50, .35], .96],
  [.60, [.55, .49, .61, .45], .80], [.66, [.60, .61, .62, .60], .96],
  [.73, [.66, .70, .64, .72], .85], [.79, [.72, .73, .69, .71], .96],
  [.88, [.84, .76, .71, .74], .90], [.94, [.96, .79, .74, .77], .90],
  [1, [.96, .79, .74, .77], .90],
];

const fixedFinishKeys = positions => positions.map(([time, runners]) => [time, runners, .90]);
const scriptKeys = {
  'living-finish': livingKeys,
  normal: fixedFinishKeys([
    [0, [0, 0, 0, 0]], [.2, [.15, .23, .18, .13]], [.4, [.32, .39, .44, .35]],
    [.6, [.55, .58, .56, .62]], [.8, [.75, .74, .69, .72]],
    [.96, [.96, .79, .74, .77]], [1, [.96, .79, .74, .77]],
  ]),
  nap: fixedFinishKeys([
    [0, [0, 0, 0, 0]], [.2, [.15, .30, .17, .12]], [.4, [.34, .55, .36, .31]],
    [.6, [.61, .55, .63, .60]], [.8, [.78, .68, .71, .72]],
    [.96, [.96, .79, .74, .77]], [1, [.96, .79, .74, .77]],
  ]),
  'wrong-way': fixedFinishKeys([
    [0, [0, 0, 0, 0]], [.2, [.24, .31, .27, .23]], [.4, [.08, .12, .10, .06]],
    [.45, [.08, .12, .10, .06]], [.6, [.35, .42, .45, .39]], [.8, [.74, .69, .72, .76]],
    [.96, [.96, .79, .74, .77]], [1, [.96, .79, .74, .77]],
  ]),
};

export function raceSceneFrame(progress, winnerIndex, scriptId = 'living-finish') {
  if (!Number.isInteger(winnerIndex) || winnerIndex < 0 || winnerIndex > 3) throw new Error('Invalid race scene winner');
  if (!Object.hasOwn(scriptKeys, scriptId)) throw new Error('Invalid race script');
  const keys = scriptKeys[scriptId];
  const t = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const next = keys.findIndex(key => key[0] > t);
  const a = keys[next < 0 ? keys.length - 1 : Math.max(0, next - 1)];
  const b = keys[next < 0 ? keys.length - 1 : next];
  const ratio = a === b ? 0 : (t - a[0]) / (b[0] - a[0]);
  const ease = ratio * ratio * (3 - 2 * ratio);
  const lerp = (x, y) => x + (y - x) * ease;
  const beat = storyBeats[scriptId][Math.min(4, Math.floor(t * 5))];
  return { phase: beat[0], title: beat[1], line: beat[2], finish: lerp(a[2], b[2]), gaze: b[2] > a[2] ? -3 : 3,
    sleepingIndex: scriptId === 'nap' && t >= .4 && t < .6 ? (winnerIndex + 1) % 4 : -1,
    backwards: scriptId === 'wrong-way' && t >= .2 && t < .4,
    positions: Array.from({ length: 4 }, (_, index) => {
      const role = (index - winnerIndex + 4) % 4;
      return lerp(a[1][role], b[1][role]);
    }) };
}

export function mountRaceScene(root, { pets, winnerId, imageHtml, onComplete, reducedMotion = false, scriptId = pickRaceScript() }) {
  const winnerIndex = pets.findIndex(p => p.id === winnerId);
  if (pets.length !== 4 || winnerIndex < 0) throw new Error('Race scene requires four entrants and a saved winner');
  const script = RACE_SCRIPTS.find(item => item.id === scriptId);
  if (!script) throw new Error('Invalid race script');
  let frame = 0, disposed = false, phase = '';
  const reduced = reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.innerHTML = `<section class="race-show" data-phase="ready" data-script="${scriptId}" aria-label="星辰夥伴賽：比賽進行中">
    <header class="race-show__heading"><span class="race-kicker">星辰體育台 · 今日特別轉播</span><h2 tabindex="-1">比賽進行中</h2><p>星辰夥伴賽</p></header>
    <div class="race-show__broadcast"><span class="race-show__live">● 現場播報</span><p role="status" aria-live="polite"></p></div>
    <div class="race-show__arena" aria-label="四位夥伴的賽跑">
      <div class="race-show__sky" aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span><span>✧</span></div>
      <div class="race-show__notice" aria-hidden="true">各就各位</div>
      <div class="race-show__track">${pets.map((pet, i) => `<div class="race-show__lane"><span class="race-show__name">0${i + 1} · ${esc(pet.name)}</span><div class="race-show__path">
        <div class="race-show__runner" data-scene-runner="${i}"><span class="race-show__reaction" aria-hidden="true">？！</span><span class="race-show__portrait">${imageHtml(pet)}</span><span class="race-show__dust" aria-hidden="true">···</span></div>
        <span class="race-show__finish ${scriptId === 'living-finish' ? 'race-show__finish--eye' : ''}" aria-hidden="true">${scriptId === 'living-finish' ? '<b class="race-show__eye"></b>' : ''}</span>
      </div></div>`).join('')}</div>
    </div>
    <button class="btn btn--secondary" type="button" data-scene-skip>略過動畫，查看賽果</button>
  </section>`;
  const show = root.querySelector('.race-show');
  show.classList.toggle('is-reduced', reduced);
  const runners = [...root.querySelectorAll('[data-scene-runner]')];
  const finishes = [...root.querySelectorAll('.race-show__finish')];
  const line = root.querySelector('[role="status"]');
  const notice = root.querySelector('.race-show__notice');
  const button = root.querySelector('[data-scene-skip]');
  function dispose() { disposed = true; cancelAnimationFrame(frame); button.removeEventListener('click', finish); }
  function finish() { if (disposed) return; dispose(); onComplete(); }
  function render(t) {
    const state = raceSceneFrame(t, winnerIndex, scriptId);
    runners.forEach((runner, i) => {
      runner.style.left = `${state.positions[i] * 100}%`;
      runner.classList.toggle('is-sleeping', i === state.sleepingIndex);
      runner.classList.toggle('is-backwards', state.backwards);
      runner.querySelector('.race-show__reaction').textContent = i === state.sleepingIndex ? 'Zzz' : '？！';
      runner.classList.toggle('is-winner', state.positions[i] >= state.finish && i === winnerIndex);
    });
    finishes.forEach(el => { el.style.left = `${state.finish * 100}%`; el.style.setProperty('--eye-look', `${state.gaze}px`); });
    if (state.phase !== phase) {
      phase = state.phase; show.dataset.phase = phase; notice.textContent = state.title;
      line.textContent = state.line;
    }
  }
  button.addEventListener('click', finish);
  root.querySelector('h2').focus();
  const start = performance.now();
  function step(now) {
    if (disposed) return;
    if (!root.isConnected) { dispose(); return; }
    const t = Math.min(1, (now - start) / RACE_SCENE_MS);
    render(t);
    if (t === 1) finish(); else frame = requestAnimationFrame(step);
  }
  if (reduced) { render(1); button.textContent = '查看賽果'; }
  else { render(0); frame = requestAnimationFrame(step); }
  return { dispose, skip: finish };
}
