/** Keep edge gestures on filter rows inside the app instead of Safari history. */
export function initFilterGestures(root = document) {
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
