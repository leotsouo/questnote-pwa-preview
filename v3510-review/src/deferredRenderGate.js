/** Keep a hidden view stale until the next time it becomes visible. */
export function createDeferredRenderGate() {
  let dirty = false;
  return {
    markDirty() { dirty = true; },
    clear() { dirty = false; },
    flush(render) {
      if (!dirty) return false;
      render();
      dirty = false;
      return true;
    },
    get dirty() { return dirty; },
  };
}
