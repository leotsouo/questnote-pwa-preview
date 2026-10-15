import { mountRaceScene } from './dailyRaceScene.js';
import { getDailyRaces, playDailyRace } from './dailyRaceService.js';
import { RACE_TRACKS, racePayout } from './dailyRaceCore.js';
import { getWallet } from './rewardService.js';
import { trackUpdateActivity } from './updateActivity.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let dispose = null;
export function closeDailyRace() { dispose?.(); dispose = null; }

export async function openDailyRace({ pets, ownedIds = [], imageHtml, openModal, refresh, reduceMotion = false }) {
  openModal('<section id="daily-race-panel" class="daily-race" aria-label="星辰賭場"><h2 class="modal-title">星辰賭場</h2><p role="status">正在準備賽道…</p></section>');
  const root = document.getElementById('daily-race-panel');
  let alive = true, state, wallet, roundIndex = 0, selectedId = null, stake = 5, busy = false, error = '';
  let skip = null, scene = null, rainTimer = 0;
  const knownPets = new Map(pets.map(p => [p.id, p]));
  const owned = new Set(ownedIds);
  const pet = id => knownPets.get(id) || { id, name: '旅途中的夥伴' };
  const name = id => pet(id).name || pet(id).title || id;
  const picture = id => imageHtml(pet(id), { size: 'sm', eager: true });
  const live = () => alive && root.isConnected;
  dispose = () => { alive = false; clearTimeout(rainTimer); scene?.dispose(); root.onclick = null; root.oninput = null; };

  function receipt(round) {
    const r = round.result;
    const net = r.payout - r.stake;
    return `<section class="race-receipt" aria-label="賽果"><span class="race-kicker">本場星光紀錄</span>
      <h3>${esc(name(r.winnerId))} 抵達終點！</h3>${picture(r.winnerId)}
      <p>${r.mode === 'watch' ? '免費觀賽完成 · 未扣除星塵' : `你選擇了 ${esc(name(r.selectedId))} · ${net > 0 ? '預測成功' : '本場未猜中'}`}</p>
      ${r.mode === 'bet' ? `<dl class="race-ledger"><div><dt>押注</dt><dd>${r.stake}</dd></div><div><dt>返還（含本金）</dt><dd>${r.payout}</dd></div><div><dt>本場淨變動</dt><dd>${net > 0 ? '+' : ''}${net}</dd></div></dl>` : ''}
      <p>本場已結算並保存。下一場每位夥伴仍有 25% 勝率。</p></section>`;
  }

  function historyHtml() {
    const entries = [...state.history, state.day].flatMap(day => day.rounds.map((r, index) => ({ ...r, date: day.date, index })).filter(r => r.result)).reverse();
    return `<details class="race-history"><summary>星光紀錄 · ${entries.length} 場（保存今日與過往 90 個賽事日）</summary>
      ${entries.length ? `<ol>${entries.slice(0, 30).map(r => `<li><span aria-hidden="true">${RACE_TRACKS[r.track].symbol}</span>
      <span>${esc(r.date)} · 第 ${r.index + 1} 場<br><strong>${esc(name(r.result.winnerId))}</strong> · ${r.result.mode === 'watch' ? '觀賽' : `押 ${r.result.stake}，返還 ${r.result.payout}`}</span></li>`).join('')}</ol><p>顯示最近 ${Math.min(entries.length, 30)} 場。所有保存紀錄會隨備份匯出。</p>` : '<p>每一段旅程都會留下一枚賽道印記，免費觀賽也會記錄。</p>'}</details>`;
  }

  function draw(focus = false) {
    if (!live()) return;
    const round = state.day.rounds[roundIndex];
    const track = RACE_TRACKS[round.track];
    const completed = state.day.rounds.filter(r => r.result).length;
    root.innerHTML = `<header class="race-heading"><span class="race-kicker">DAILY STARDUST RUN · ${esc(state.day.date)}</span>
      <h2 class="modal-title" tabindex="-1">星辰賭場</h2><p>今天已完成 ${completed} / 3 場 · 星塵餘額 ${wallet.stardust}</p></header>
      <nav class="race-rounds" aria-label="選擇今日賽事">${state.day.rounds.map((r, i) => `<button type="button" class="btn btn--ghost" data-race-round="${i}" aria-pressed="${i === roundIndex}">第 ${i + 1} 場${r.result ? ' · 已完成' : ''}</button>`).join('')}</nav>
      <div class="race-track-title"><span aria-hidden="true">${track.symbol}</span><div><h3>${track.name}</h3><p>${track.line}</p></div></div>
      <p class="race-error" role="alert">${esc(error)}</p>
      ${round.result ? receipt(round) : `<form id="race-bet-form"><fieldset><legend>選一位你看好的夥伴 · 每位勝率 25%</legend>
        <div class="race-entrants">${round.petIds.map((id, i) => `<label class="race-entrant"><input type="radio" name="race-pet" value="${esc(id)}" ${id === selectedId ? 'checked' : ''}>
          <span class="race-entrant__card"><span class="race-number">0${i + 1}</span>${picture(id)}<strong>${esc(name(id))}</strong><small>${owned.has(id) ? '已收藏' : '圖鑑焦點'} · 勝率 25%</small></span></label>`).join('')}</div></fieldset>
        <div class="race-stake"><label for="race-stake">押注星塵（5～500，以 5 為級距）</label>
        <input id="race-stake" type="number" min="5" max="500" step="5" value="${stake}" inputmode="numeric" required aria-describedby="race-quote">
        <div class="race-amounts">${[5, 25, 100, 500].map(n => `<button type="button" class="btn btn--ghost" data-race-stake="${n}">${n}</button>`).join('')}</div>
        <p id="race-quote" aria-live="polite"></p></div>
        <div class="race-actions"><button type="submit" class="btn btn--primary">確認下注內容</button><button type="button" class="btn btn--secondary" data-race-action="watch">免費觀賽</button></div>
        <p class="race-note">免費觀賽也會使用本場次，開賽後不能補下注。</p></form>`}
      ${completed === 3 ? '<p class="race-day-done">今天三段旅程都留下紀錄了。下次再來看新的賽道與夥伴。</p>' : ''}
      <details class="race-rules"><summary>賽事規則與星塵風險</summary><p>四位夥伴等機率獲勝，稀有度、等級、賽道及過往輸贏均不影響機率。賽果在開賽時保存，動畫只呈現賽事。</p>
      <p>猜中返還 3.8 倍，包含本金；猜錯失去全部押注。長期平均返還率 95%、遊戲方優勢 5%，不代表每次或每天都能拿回 95%。</p>
      <p>每天最多三場，每場最多 500 星塵。一天最多損失 1,500 星塵，約等於 15 次 100 星塵單抽。缺席不扣進度，使用裝置當地日期換日。</p></details>${historyHtml()}`;
    root.querySelector('form')?.addEventListener('submit', event => { event.preventDefault(); confirm('bet'); });
    quote();
    if (focus) root.querySelector('h2').focus();
  }

  function quote() {
    const el = root.querySelector('#race-quote');
    if (!el) return;
    try { const prize = racePayout(stake); el.textContent = `猜中共返還 ${prize}（含本金），淨賺 ${prize - stake}；猜錯損失 ${stake} 星塵。`; }
    catch (e) { el.textContent = e.message; }
  }

  function confirm(mode) {
    if (!live() || busy) return;
    if (mode === 'bet') {
      try {
        racePayout(stake);
        if (!state.day.rounds[roundIndex].petIds.includes(selectedId)) throw new Error('請先選一位夥伴');
        if (wallet.stardust < stake) throw new Error('星塵不足，仍可免費觀賽');
      } catch (e) { root.querySelector('.race-error').textContent = e.message; return; }
    }
    const prize = mode === 'bet' ? racePayout(stake) : 0;
    root.innerHTML = `<h2 class="modal-title" tabindex="-1">${mode === 'bet' ? '確認這場押注' : '確認免費觀賽'}</h2>
      ${mode === 'bet' ? `<p>第 ${roundIndex + 1} 場 · ${esc(name(selectedId))} · 勝率 25%</p><dl class="race-ledger"><div><dt>押注</dt><dd>${stake}</dd></div><div><dt>猜中共返還</dt><dd>${prize}</dd></div><div><dt>猜錯損失</dt><dd>${stake}</dd></div></dl>
      <p>返還包含本金；猜中淨賺 ${prize - stake} 星塵。</p><p class="race-risk">每天最多三場、每場最多 500。三場全押滿並全輸，最多損失 1,500 星塵，約等於 15 次單抽。</p>` : '<p>不扣星塵、不派彩。本場觀賽後不能補下注。</p>'}
      <p>開賽即保存結果，無法取消；關閉畫面也會保留賽果。</p><div class="race-actions"><button class="btn btn--ghost" type="button" data-race-action="cancel">返回選擇</button><button class="btn btn--primary" type="button" data-race-play="${mode}">${mode === 'bet' ? `押 ${stake} 星塵並開賽` : '開始免費觀賽'}</button></div>`;
    root.querySelector('h2').focus();
  }

  async function play(mode) {
    if (busy) return;
    busy = true;
    root.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try {
      const result = await playDailyRace({ date: state.day.date, round: roundIndex, mode,
        selectedId: mode === 'watch' ? null : selectedId, stake: mode === 'watch' ? 0 : stake });
      state = result.state;
      wallet = result.wallet;
      // Refresh even if the user closed while the transaction was committing.
      error = '';
      try { await refresh(); }
      catch { error = '賽果與星塵已保存；主畫面更新失敗，重新開啟即可同步。'; }
      if (!live()) return;
      if (result.duplicate || reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) draw(true);
      else animate();
    } catch (e) {
      if (!live()) return;
      error = e.message || '賽事暫時無法開始，請稍後再試';
      try { state = await getDailyRaces(pets); wallet = await getWallet(); } catch { /* Preserve the original error. */ }
      draw(true);
    } finally { busy = false; }
  }

  function animate() {
    const round = state.day.rounds[roundIndex];
    scene?.dispose();
    scene = mountRaceScene(root, {
      pets: round.petIds.map(pet), winnerId: round.result.winnerId,
      imageHtml: p => picture(p.id),
      onComplete: () => { skip = null; scene = null; if (live()) draw(true); },
    });
    skip = scene.skip;
  }

  root.onclick = trackUpdateActivity(async event => {
    const button = event.target.closest('button');
    if (!button || busy) return;
    if (button.dataset.raceRound !== undefined) { roundIndex = Number(button.dataset.raceRound); selectedId = null; error = ''; draw(true); }
    else if (button.dataset.raceStake) { stake = Number(button.dataset.raceStake); root.querySelector('#race-stake').value = stake; quote(); }
    else if (button.dataset.racePlay) await play(button.dataset.racePlay);
    else if (button.dataset.raceAction === 'watch') confirm('watch');
    else if (button.dataset.raceAction === 'cancel') draw(true);
    else if (button.dataset.raceAction === 'skip') skip?.();
    else if (button.dataset.raceAction === 'retry') await load();
  });
  root.oninput = event => {
    if (event.target.name === 'race-pet') selectedId = event.target.value;
    if (event.target.id === 'race-stake') { stake = Number(event.target.value); quote(); }
  };

  async function load() {
    try {
      [state, wallet] = await Promise.all([getDailyRaces(pets), getWallet()]);
      if (!live()) return;
      const next = state.day.rounds.findIndex(r => !r.result);
      roundIndex = next < 0 ? 0 : next;
      draw(true);
    } catch (e) {
      if (live()) root.innerHTML = `<h2 class="modal-title">星辰賭場</h2><p role="alert">${esc(e.message)}</p><button type="button" class="btn btn--secondary" data-race-action="retry">重新載入</button>`;
    }
  }
  await load();
  if (live() && state && !reduceMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const rain = document.createElement('div');
    rain.className = 'casino-coin-rain'; rain.setAttribute('aria-hidden', 'true');
    rain.innerHTML = Array.from({ length: 24 }, (_, i) => '<span style="--coin-x:' + ((i * 37) % 100) + '%;--coin-delay:' + ((i % 6) * .1) + 's;--coin-spin:' + (i % 2 ? 420 : -380) + 'deg"></span>').join('');
    root.append(rain);
    rainTimer = setTimeout(() => rain.remove(), 3000);
  }
}
