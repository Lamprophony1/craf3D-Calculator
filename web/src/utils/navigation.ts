type NavigationGuard = (proceed: () => void) => void;

let guard: NavigationGuard | undefined;

export function registerNavigationGuard(handler: NavigationGuard) {
  guard = handler;
  return () => { if (guard === handler) guard = undefined; };
}

export function requestNavigation(proceed: () => void) {
  if (guard) guard(proceed);
  else proceed();
}

function historyPosition(): number {
  const position: unknown = window.history.state?.printcostPosition;
  if (typeof position === 'number' && Number.isSafeInteger(position)) return position;
  window.history.replaceState({ ...window.history.state, printcostPosition: 0 }, '');
  return 0;
}

interface NavigationOptions {
  state?: Record<string, unknown>;
  replace?: boolean;
  confirmed?: boolean;
}

export function navigate(path: string, options: NavigationOptions = {}) {
  const proceed = () => {
    const position = historyPosition();
    const opensDifferentScreen = new URL(path, window.location.href).pathname !== window.location.pathname;
    const state = { ...options.state, printcostPosition: options.replace ? position : position + 1 };
    if (options.replace) window.history.replaceState(state, '', path);
    else window.history.pushState(state, '', path);
    if (opensDifferentScreen && window.scrollY && !options.state?.orderListRestore) window.scrollTo(0, 0);
    window.dispatchEvent(new PopStateEvent('popstate', { state }));
  };
  if (options.confirmed) proceed();
  else requestNavigation(proceed);
}

export function observeNavigation(update: () => void) {
  let current = { position: historyPosition(), href: window.location.href, state: window.history.state };
  let restoring: (() => void) | undefined;
  let approvedTraversal = false;

  const handlePop = (event: PopStateEvent) => {
    const position: unknown = window.history.state?.printcostPosition;
    if (restoring && event.isTrusted) {
      if (position === current.position && window.location.href === current.href) {
        const onRestored = restoring;
        restoring = undefined;
        onRestored();
      }
      return;
    }

    const leavesScreen = window.location.pathname !== new URL(current.href).pathname;
    if (event.isTrusted && leavesScreen && guard && !approvedTraversal) {
      // Back and Forward have already moved the URL. Restore the editor entry
      // before opening its dialog so the form stays mounted during the decision.
      const delta = typeof position === 'number' ? position - current.position : 0;
      if (delta) {
        restoring = () => requestNavigation(() => {
          approvedTraversal = true;
          window.history.go(delta);
        });
        window.history.go(-delta);
      } else {
        // Older entries may predate the position marker.
        window.history.pushState(current.state, '', current.href);
        requestNavigation(() => {
          approvedTraversal = true;
          window.history.back();
        });
      }
      return;
    }

    approvedTraversal = false;
    restoring = undefined;
    current = { position: historyPosition(), href: window.location.href, state: window.history.state };
    update();
  };
  window.addEventListener('popstate', handlePop);
  return () => window.removeEventListener('popstate', handlePop);
}
