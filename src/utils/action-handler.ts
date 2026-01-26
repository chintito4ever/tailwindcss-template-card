/**
 * Action Handler Utility
 * 
 * Provides action handling using custom-card-helpers for native HA behavior.
 */

import { noChange } from 'lit';
import { directive, Directive, PartInfo, PartType } from 'lit/directive.js';

interface ActionHandlerOptions {
  hasHold?: boolean;
  hasDoubleClick?: boolean;
  disabled?: boolean;
}

interface ActionHandlerDetail {
  action: 'tap' | 'hold' | 'double_tap';
}

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

class ActionHandler extends HTMLElement {
  public holdTime = 500;
  public ripple = document.createElement('div');

  protected timer?: number;
  protected held = false;
  protected cancelled = false;
  protected dblClickTimeout?: number;
  protected firstClick = false;

  public connectedCallback(): void {
    Object.assign(this.style, {
      position: 'absolute',
      width: isTouch ? '100px' : '50px',
      height: isTouch ? '100px' : '50px',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: '999',
    });

    this.appendChild(this.ripple);
    this.ripple.style.cssText =
      'position: absolute; width: 100%; height: 100%; ' +
      'border-radius: 50%; background: var(--secondary-text-color); ' +
      'opacity: 0; pointer-events: none; will-change: transform, opacity;';
  }

  public bind(element: Element, options: ActionHandlerOptions): void {
    if (element.actionHandler) {
      return;
    }

    element.actionHandler = true;

    element.addEventListener('contextmenu', (ev: Event) => {
      const e = ev || window.event;
      if (e.preventDefault) {
        e.preventDefault();
      }
      if (e.stopPropagation) {
        e.stopPropagation();
      }
      e.cancelBubble = true;
      e.returnValue = false;
      return false;
    });

    const start = (ev: Event): void => {
      this.cancelled = false;
      this.held = false;

      if (options.hasHold) {
        this.timer = window.setTimeout(() => {
          if (!this.cancelled) {
            this.held = true;
            this.fireEvent(element, 'hold');
          }
        }, this.holdTime);
      }
    };

    const end = (ev: Event): void => {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = undefined;
      }

      if (this.cancelled) {
        return;
      }

      if (this.held) {
        return;
      }

      if (options.hasDoubleClick) {
        if (this.firstClick) {
          this.firstClick = false;
          if (this.dblClickTimeout) {
            clearTimeout(this.dblClickTimeout);
            this.dblClickTimeout = undefined;
          }
          this.fireEvent(element, 'double_tap');
        } else {
          this.firstClick = true;
          this.dblClickTimeout = window.setTimeout(() => {
            this.firstClick = false;
            this.fireEvent(element, 'tap');
          }, 250);
        }
      } else {
        this.fireEvent(element, 'tap');
      }
    };

    const cancel = (): void => {
      this.cancelled = true;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = undefined;
      }
    };

    if (isTouch) {
      element.addEventListener('touchstart', start, { passive: true });
      element.addEventListener('touchend', end);
      element.addEventListener('touchcancel', cancel);
    } else {
      element.addEventListener('mousedown', start, { passive: true });
      element.addEventListener('mouseup', end);
      element.addEventListener('mouseleave', cancel);
    }

    element.addEventListener('click', (ev: Event) => {
      // Prevent click from firing after hold
      if (this.held) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    });
  }

  private fireEvent(element: Element, action: ActionHandlerDetail['action']): void {
    const event = new CustomEvent<ActionHandlerDetail>('action', {
      bubbles: true,
      composed: true,
      detail: { action },
    });
    element.dispatchEvent(event);
  }
}

customElements.define('action-handler', ActionHandler);

const getActionHandler = (): ActionHandler => {
  const body = document.body;
  if (body.querySelector('action-handler')) {
    return body.querySelector('action-handler') as ActionHandler;
  }

  const actionHandler = document.createElement('action-handler') as ActionHandler;
  body.appendChild(actionHandler);
  return actionHandler;
};

export const actionHandlerBind = (element: Element, options: ActionHandlerOptions): void => {
  const actionHandler = getActionHandler();
  if (!actionHandler) {
    return;
  }
  actionHandler.bind(element, options);
};

// Extend Element interface
declare global {
  interface Element {
    actionHandler?: boolean;
  }
}

/**
 * Action handler directive for use in Lit templates
 */
class ActionHandlerDirective extends Directive {
  private _options?: ActionHandlerOptions;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error('The `actionHandler` directive must be used on elements');
    }
  }

  update(part: any, [options]: [ActionHandlerOptions]) {
    if (options !== this._options) {
      this._options = options;
      actionHandlerBind(part.element, options);
    }
    return noChange;
  }

  render(_options: ActionHandlerOptions) {
    return noChange;
  }
}

export const actionHandler = directive(ActionHandlerDirective);
