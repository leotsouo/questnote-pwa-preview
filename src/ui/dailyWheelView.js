/**
 * Daily wheel presentation: SVG disc markup and the spin animation.
 * Pure view code — the reward and its index are decided by dailyCheckInService
 * before the wheel turns; nothing here reads or writes saved data.
 */
import { escapeHtml } from '../uiHelpers.js';

const WHEEL_CX = 150;
const WHEEL_CY = 150;
const WHEEL_R = 140;
const WHEEL_LABEL_R = 82;

const WHEEL_COLORS_DEFAULT = [
  '#2A1F4A', '#18304A', '#2B2340', '#3A2A18',
  '#1F3A35', '#251F3F', '#18364A', '#3A2030',
];

/** Sweet 轉盤扇區：交錯莓果／金／紫／薄荷／藍／珊瑚，避免整盤淡粉 */
const WHEEL_COLORS_SWEET = [
  '#E8A6BE', '#F3C979', '#B9A6E8', '#9ECFBE',
  '#9FC4DF', '#ECA5A5', '#E8B8D0', '#D4C4F0',
];

/** Sweet 扇區標籤文字色（依扇區明度選擇深色） */
const WHEEL_LABEL_COLORS_SWEET = [
  '#4A2E3B', '#684516', '#3F315F', '#245547',
  '#294E68', '#4A2E3B', '#4A2E3B', '#3F315F',
];

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function describeArcSector(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', cx, cy,
    'L', start.x, start.y,
    'A', r, r, 0, largeArcFlag, 0, end.x, end.y,
    'Z',
  ].join(' ');
}

function truncateWheelLabel(text, maxLen = 8) {
  const chars = Array.from(text || '');
  return chars.length <= maxLen ? chars.join('') : chars.slice(0, maxLen).join('');
}

export function getWheelShortLabel(reward) {
  const amount = reward.amount ?? 1;
  const amtStr = `+${amount}`;

  if (reward.type === 'stardust') {
    return { name: '星塵', amount: amtStr };
  }
  if (reward.type === 'adventureEnergy') {
    return { name: '能量', amount: amtStr };
  }
  if (reward.type === 'material') {
    const matNames = {
      forest_leaf: '嫩葉',
      lava_core: '熔岩',
      machine_part: '齒輪',
      star_shard: '星界',
    };
    const name = matNames[reward.materialId];
    if (name) return { name, amount: amtStr };
  }
  if (reward.type === 'item' && reward.itemId === 'item_small_spirit_food') {
    return { name: '靈食', amount: amtStr };
  }

  const label = reward.label || '';
  const plusMatch = label.match(/^(.+?)\s*(\+\d+)\s*$/);
  if (plusMatch) {
    return {
      name: truncateWheelLabel(plusMatch[1].trim(), 8),
      amount: plusMatch[2],
    };
  }
  return { name: truncateWheelLabel(label, 8), amount: amtStr };
}

function buildWheelSvgHtml(rewards, sweet) {
  const count = rewards.length || 8;
  const seg = 360 / count;
  const colors = sweet ? WHEEL_COLORS_SWEET : WHEEL_COLORS_DEFAULT;
  const stroke = sweet ? '#D4A0B8' : 'rgba(244, 247, 255, 0.16)';

  const sectors = rewards.map((reward, i) => {
    const startAngle = i * seg;
    const endAngle = startAngle + seg;
    const midAngle = startAngle + seg / 2;
    const path = describeArcSector(WHEEL_CX, WHEEL_CY, WHEEL_R, startAngle, endAngle);
    const short = getWheelShortLabel(reward);
    const labelPoint = polarToCartesian(WHEEL_CX, WHEEL_CY, WHEEL_LABEL_R, midAngle);
    let textRotation = midAngle;
    if (midAngle > 90 && midAngle < 270) {
      textRotation = midAngle + 180;
    }
    const labelFill = sweet ? WHEEL_LABEL_COLORS_SWEET[i % WHEEL_LABEL_COLORS_SWEET.length] : '';
    const fillAttr = labelFill ? ` fill="${labelFill}"` : '';

    return `
      <path class="daily-wheel-sector" d="${path}" fill="${colors[i % colors.length]}" stroke="${stroke}" stroke-width="1.5"/>
      <g class="daily-wheel-label-group" transform="translate(${labelPoint.x.toFixed(2)}, ${labelPoint.y.toFixed(2)}) rotate(${textRotation.toFixed(2)})">
        <text class="daily-wheel-label" text-anchor="middle" dominant-baseline="middle"${fillAttr}>
          <tspan x="0" dy="-0.35em" class="daily-wheel-label__name">${escapeHtml(short.name)}</tspan>
          <tspan x="0" dy="1.15em" class="daily-wheel-label__amount">${escapeHtml(short.amount)}</tspan>
        </text>
      </g>`;
  }).join('');

  return `
    <svg class="daily-wheel-svg" viewBox="0 0 300 300" aria-hidden="true">
      <circle class="daily-wheel-outer-ring" cx="${WHEEL_CX}" cy="${WHEEL_CY}" r="${WHEEL_R}" fill="none"/>
      ${sectors}
    </svg>`;
}

/** Wheel disc, start button and the reward preview list. `sweet` selects the sweet-theme palette. */
export function buildWheelDiscHtml(rewards, { sweet = false } = {}) {
  const previewItems = rewards.map((r) =>
    `<li class="daily-wheel-preview__item">${escapeHtml(r.label)}</li>`
  ).join('');

  return `
    <div class="daily-wheel-stage">
      <div class="daily-wheel-wrapper">
        <div class="daily-wheel-pointer" aria-hidden="true"></div>
        <div class="daily-wheel-rotor" id="daily-wheel-rotor">
          ${buildWheelSvgHtml(rewards, sweet)}
        </div>
        <button type="button" class="daily-wheel-center-button" id="daily-wheel-start" aria-label="轉動轉盤">開始</button>
      </div>
    </div>
    <ul class="daily-wheel-preview" aria-label="轉盤獎勵清單">
      ${previewItems}
    </ul>`;
}

function waitForWheelRotorTransition(rotor, fallbackMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      rotor.removeEventListener('transitionend', onEnd);
      clearTimeout(timer);
      resolve();
    };
    const onEnd = (event) => {
      if (event.target !== rotor || event.propertyName !== 'transform') return;
      finish();
    };
    rotor.addEventListener('transitionend', onEnd);
    const timer = setTimeout(finish, fallbackMs);
  });
}

export function computeWheelRotationDeg(rewardIndex, segmentCount, extraSpins = 4, random = Math.random) {
  const seg = 360 / segmentCount;
  const targetMidAngle = rewardIndex * seg + seg / 2;
  const jitter = (random() - 0.5) * (seg * 0.2);
  return extraSpins * 360 + (360 - targetMidAngle + jitter);
}

/** Spin the rendered wheel so the pointer rests on `rewardIndex`; resolves when the rotor stops. */
export async function animateDailyWheel(rewardIndex, segmentCount, { reduceMotion = false } = {}) {
  const rotor = document.getElementById('daily-wheel-rotor');
  const startBtn = document.getElementById('daily-wheel-start');
  if (!rotor) return;

  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = '轉動';
  }

  const extraSpins = reduceMotion ? 1 : 3 + Math.floor(Math.random() * 2);
  const rotation = computeWheelRotationDeg(rewardIndex, segmentCount, extraSpins);

  rotor.style.transition = reduceMotion
    ? 'transform 300ms ease-out'
    : 'transform 2800ms cubic-bezier(0.12, 0.72, 0.18, 1)';

  void rotor.offsetHeight;
  const transformValue = `translate3d(0, 0, 0) rotate(${rotation}deg)`;
  rotor.style.setProperty('--wheel-rotation', `${rotation}deg`);
  rotor.style.transform = transformValue;

  const fallbackMs = reduceMotion ? 400 : 3000;
  await waitForWheelRotorTransition(rotor, fallbackMs);

  if (startBtn) startBtn.textContent = '已轉';
}
