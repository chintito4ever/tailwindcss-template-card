export interface ActionHandlerOptions {
  hasHold?: boolean;
  hasDoubleClick?: boolean;
  disabled?: boolean;
}

type ActionType = 'tap' | 'hold' | 'double_tap';

interface ActionHandlerDetail {
  action: ActionType;
}

interface ActionHandlerState {
  timer?: number;
  dblClickTimeout?: number;
  firstClick: boolean;
  held: boolean;
  cancelled: boolean;
}

interface ActionHandlerBinding {
  options: ActionHandlerOptions;
  isTouch: boolean;
  handlers: {
    contextMenu: (ev: Event) => void;
    start: (ev: Event) => void;
    end: (ev: Event) => void;
    cancel: () => void;
    click: (ev: Event) => void;
    keydown: (ev: KeyboardEvent) => void;
  };
  state: ActionHandlerState;
}

const bindings = new WeakMap<HTMLElement, ActionHandlerBinding>();
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const HOLD_TIME = 500;

const fireAction = (element: HTMLElement, action: ActionType): void => {
  const event = new CustomEvent<ActionHandlerDetail>('action', {
    bubbles: true,
    composed: true,
    detail: { action },
  });
  element.dispatchEvent(event);
};

export const removeActionHandler = (element: HTMLElement): void => {
  const binding = bindings.get(element);
  if (!binding) {
    return;
  }

  const { handlers, isTouch: touch, state } = binding;
  if (state.timer) {
    clearTimeout(state.timer);
  }
  if (state.dblClickTimeout) {
    clearTimeout(state.dblClickTimeout);
  }

  element.removeEventListener('contextmenu', handlers.contextMenu);
  if (touch) {
    element.removeEventListener('touchstart', handlers.start);
    element.removeEventListener('touchend', handlers.end);
    element.removeEventListener('touchcancel', handlers.cancel);
  } else {
    element.removeEventListener('mousedown', handlers.start);
    element.removeEventListener('mouseup', handlers.end);
    element.removeEventListener('mouseleave', handlers.cancel);
  }
  element.removeEventListener('click', handlers.click);
  element.removeEventListener('keydown', handlers.keydown);
  bindings.delete(element);
};

export const setActionHandler = (element: HTMLElement, options?: ActionHandlerOptions): void => {
  if (!element || !options || options.disabled) {
    if (element) {
      removeActionHandler(element);
    }
    return;
  }

  const existing = bindings.get(element);
  if (
    existing &&
    existing.options.hasHold === options.hasHold &&
    existing.options.hasDoubleClick === options.hasDoubleClick &&
    existing.options.disabled === options.disabled
  ) {
    return;
  }

  if (existing) {
    removeActionHandler(element);
  }

  const state: ActionHandlerState = {
    firstClick: false,
    held: false,
    cancelled: false,
  };

  const contextMenuHandler = (ev: Event): void => {
    const e = ev || window.event;
    if (e.preventDefault) {
      e.preventDefault();
    }
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    e.cancelBubble = true;
    e.returnValue = false;
  };

  const start = (): void => {
    state.cancelled = false;
    state.held = false;

    if (options.hasHold) {
      state.timer = window.setTimeout(() => {
        if (!state.cancelled) {
          state.held = true;
          fireAction(element, 'hold');
        }
      }, HOLD_TIME);
    }
  };

  const end = (): void => {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }

    if (state.cancelled || state.held) {
      return;
    }

    if (options.hasDoubleClick) {
      if (state.firstClick) {
        state.firstClick = false;
        if (state.dblClickTimeout) {
          clearTimeout(state.dblClickTimeout);
          state.dblClickTimeout = undefined;
        }
        fireAction(element, 'double_tap');
      } else {
        state.firstClick = true;
        state.dblClickTimeout = window.setTimeout(() => {
          state.firstClick = false;
          fireAction(element, 'tap');
        }, 250);
      }
    } else {
      fireAction(element, 'tap');
    }
  };

  const cancel = (): void => {
    state.cancelled = true;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }
  };

  const clickHandler = (ev: Event): void => {
    if (state.held) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  };

  const keydownHandler = (ev: KeyboardEvent): void => {
    if (ev.repeat) {
      return;
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      fireAction(element, 'tap');
    }
  };

  element.addEventListener('contextmenu', contextMenuHandler);
  if (isTouch) {
    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('touchend', end);
    element.addEventListener('touchcancel', cancel);
  } else {
    element.addEventListener('mousedown', start, { passive: true });
    element.addEventListener('mouseup', end);
    element.addEventListener('mouseleave', cancel);
  }
  element.addEventListener('click', clickHandler);
  element.addEventListener('keydown', keydownHandler);

  bindings.set(element, {
    options,
    isTouch,
    handlers: {
      contextMenu: contextMenuHandler,
      start,
      end,
      cancel,
      click: clickHandler,
      keydown: keydownHandler,
    },
    state,
  });
};
