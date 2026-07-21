/** Lightweight stack for open modals/sheets — used by Android back-button handling. */

const stack = [];

const listeners = new Set();

function notify() {
  for (const listener of listeners) listener(stack.length);
}

export function registerModal(id, onClose) {
  const entry = { id, onClose };
  stack.push(entry);
  notify();
  return () => {
    const index = stack.indexOf(entry);
    if (index >= 0) stack.splice(index, 1);
    notify();
  };
}

export function closeTopModal() {
  const top = stack[stack.length - 1];
  if (!top) return false;
  stack.pop();
  notify();
  try {
    top.onClose();
  } catch {
    // ignore close handler errors
  }
  return true;
}

export function hasOpenModal() {
  return stack.length > 0;
}

export function subscribeModalStack(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
