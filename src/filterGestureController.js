/** Keep edge gestures on filter rows inside the app instead of Safari history. */
export function initFilterGestures(root = document) {
  let mouseGesture = null;
  let suppressedBar = null;
  root.addEventListener('pointerdown', (event) => {
    suppressedBar = null;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const bar = event.target.closest?.('.filter-bar');
    if (!bar) return;
    mouseGesture = { bar, id: event.pointerId, x: event.clientX, y: event.clientY,
      left: bar.scrollLeft, dragging: false };
  });
  root.addEventListener('pointermove', (event) => {
    const current = mouseGesture;
    if (!current || event.pointerId !== current.id) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.dragging) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) { mouseGesture = null; return; }
      current.dragging = true;
      current.bar.setPointerCapture(event.pointerId);
      current.bar.classList.add('is-dragging');
    }
    event.preventDefault();
    current.bar.scrollLeft = current.left - dx;
  });
  const finishMouseGesture = (event) => {
    const current = mouseGesture;
    if (!current || event.pointerId !== current.id) return;
    mouseGesture = null;
    current.bar.classList.remove('is-dragging');
    if (current.dragging && event.type === 'pointerup') suppressedBar = current.bar;
    if (current.bar.hasPointerCapture(current.id)) current.bar.releasePointerCapture(current.id);
  };
  root.addEventListener('pointerup', finishMouseGesture);
  root.addEventListener('pointercancel', finishMouseGesture);
  root.addEventListener('lostpointercapture', finishMouseGesture);
  root.addEventListener('click', (event) => {
    if (!suppressedBar || event.detail === 0) return;
    const bar = suppressedBar;
    suppressedBar = null;
    if (!bar.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  let gesture = null;
  root.addEventListener('touchstart', (event) => {
    gesture = null;
    if (event.touches.length !== 1 || !event.cancelable) return;
    const touch = event.touches[0];
    if (touch.clientX > 24 && touch.clientX < window.innerWidth - 24) return;
    const bar = [...root.querySelectorAll('.filter-bar')].find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && touch.clientY >= rect.top && touch.clientY <= rect.bottom;
    });
    if (!bar) return;
    event.preventDefault();
    gesture = { bar, x: touch.clientX, y: touch.clientY, lastY: touch.clientY,
      left: bar.scrollLeft, axis: null, button: event.target.closest?.('.filter-btn') };
  }, { passive: false });
  root.addEventListener('touchmove', (event) => {
    if (!gesture) return;
    if (event.touches.length !== 1) { gesture = null; return; }
    if (event.cancelable) event.preventDefault();
    const touch = event.touches[0];
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    if (!gesture.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= 6) {
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (gesture.axis === 'x') gesture.bar.scrollLeft = gesture.left - dx;
    if (gesture.axis === 'y') window.scrollBy(0, gesture.lastY - touch.clientY);
    gesture.lastY = touch.clientY;
  }, { passive: false });
  root.addEventListener('touchend', (event) => {
    if (!gesture) return;
    const current = gesture;
    gesture = null;
    if (event.cancelable) event.preventDefault();
    if (!current.axis && current.button && current.bar.contains(current.button)) current.button.click();
  }, { passive: false });
  root.addEventListener('touchcancel', () => { gesture = null; });
}
