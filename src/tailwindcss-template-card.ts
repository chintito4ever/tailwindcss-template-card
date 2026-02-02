/**
 * TailwindCSS Template Card - Modernized for Home Assistant 2024-2026
 * 
 * Features:
 * - Sections dashboard support with sizing metadata
 * - WebSocket template streaming
 * - Standard HA action schema
 * - Safe-by-default HTML rendering with DOMPurify
 * - Camera capability detection with WebRTC preference
 */

import { LitElement, html, css, PropertyValues, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  HomeAssistant,
  hasAction,
  ActionHandlerEvent,
  handleAction,
  LovelaceCardEditor,
  getLovelace,
} from 'custom-card-helpers';
import DOMPurify from 'dompurify';
import { twind, cssom, observe } from '@twind/core';
import presetTailwind from '@twind/preset-tailwind';
import presetAutoprefix from '@twind/preset-autoprefix';

import type { TailwindTemplateCardConfig, Action, Binding } from './types';
import { CARD_VERSION, DEFAULT_CONFIG, SECTIONS_SIZING } from './const';
import { TemplateEngine } from './services/template-engine';
import { CameraCapabilities } from './services/camera-capabilities';
import { setActionHandler, removeActionHandler } from './utils/action-binding';
import { extractEntitiesFromContent } from './utils/entity-extractor';

// Register the card info for Home Assistant
console.info(
  `%c  TailwindCSS Template Card  %c  v${CARD_VERSION}  `,
  'color: #2d2c35; font-weight: bold; background: #f5f6f9',
  'color: #aef3fc; font-weight: bold; background: #2d2c35'
);

// Declare the window interface for customCards
declare global {
  interface Window {
    customCards: Array<{
      type: string;
      name: string;
      description: string;
      preview?: boolean;
      documentationURL?: string;
    }>;
  }
}

// Register card with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'tailwindcss-template-card',
  name: 'TailwindCSS Template Card',
  description: 'A powerful card for creating custom UI with Tailwind CSS and Jinja templates',
  preview: true,
  documentationURL: 'https://github.com/usernein/tailwindcss-template-card',
});

@customElement('tailwindcss-template-card')
export class TailwindTemplateCard extends LitElement {
  // Home Assistant instance
  @property({ attribute: false }) public hass!: HomeAssistant;

  // Card configuration
  @state() private _config!: TailwindTemplateCardConfig;

  // Rendered HTML content
  @state() private _renderedContent: string = '';

  // Template subscription ID for cleanup
  private _templateSubscription?: Promise<() => void>;

  // Previous entity states for change detection
  private _previousStates: Map<string, unknown> = new Map();

  // Template engine service
  private _templateEngine?: TemplateEngine;

  // Camera capabilities service
  private _cameraCapabilities?: CameraCapabilities;

  // Twind observer for cleanup
  private _twindObserver?: ReturnType<typeof observe>;

  // Debounce timeout for rendering
  private _renderDebounceTimeout?: number;

  private _resizeObserver?: ResizeObserver;
  private _resizeObserverTarget?: Element;
  private _resizeNotifyFrame?: number;

  private _actionTarget?: HTMLElement;
  private _actionListener?: (ev: Event) => void;
  private _entityActionListeners = new WeakMap<HTMLElement, (ev: Event) => void>();

  private _detectedEntities: string[] = [];
  private _lastDetectedContent?: string;
  private _lastAutoDetectSetting?: boolean;

  /**
   * Static method to provide card sizing metadata for Sections dashboard
   * This is the modern HA mechanism for custom cards
   */
  public static getStubConfig(): object {
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Get the layout options for Sections dashboard
   * Provides sizing constraints for the 12-column grid
   */
  public static getLayoutOptions() {
    return SECTIONS_SIZING;
  }

  /**
   * Get the card editor element
   */
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./tailwindcss-template-card-editor');
    return document.createElement('tailwindcss-template-card-editor') as LovelaceCardEditor;
  }

  /**
   * Set the card configuration
   */
  public setConfig(config: TailwindTemplateCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }

    // Merge with defaults
    this._config = {
      ...DEFAULT_CONFIG,
      ...config,
      // Ensure actions have defaults
      tap_action: config.tap_action || { action: 'none' },
      hold_action: config.hold_action || { action: 'none' },
      double_tap_action: config.double_tap_action || { action: 'none' },
    };

    this._updateDetectedEntities();

    // Initialize services if hass is available
    if (this.hass) {
      this._initializeServices();
    }
  }

  /**
   * Called when the element is connected to the DOM
   */
  public connectedCallback(): void {
    super.connectedCallback();
    this._setupTwind();
  }

  /**
   * Called when the element is disconnected from the DOM
   */
  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this._cleanup();
  }

  /**
   * Clean up subscriptions and observers
   */
  private _cleanup(): void {
    // Unsubscribe from template updates
    if (this._templateSubscription) {
      this._templateSubscription.then((unsub) => unsub?.());
      this._templateSubscription = undefined;
    }

    // Clear debounce timeout
    if (this._renderDebounceTimeout) {
      clearTimeout(this._renderDebounceTimeout);
      this._renderDebounceTimeout = undefined;
    }

    if (this._resizeNotifyFrame) {
      cancelAnimationFrame(this._resizeNotifyFrame);
      this._resizeNotifyFrame = undefined;
    }

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = undefined;
      this._resizeObserverTarget = undefined;
    }

    if (this._actionTarget) {
      removeActionHandler(this._actionTarget);
      if (this._actionListener) {
        this._actionTarget.removeEventListener('action', this._actionListener);
      }
      this._actionTarget = undefined;
    }

    if (this._delegatedActionTarget && this._delegatedActionHandlers) {
      const target = this._delegatedActionTarget;
      const handlers = this._delegatedActionHandlers;
      target.removeEventListener('click', handlers.click);
      target.removeEventListener('dblclick', handlers.dblclick);
      target.removeEventListener('keydown', handlers.keydown);
      target.removeEventListener('pointerdown', handlers.pointerdown);
      target.removeEventListener('pointerup', handlers.pointerup);
      target.removeEventListener('pointercancel', handlers.pointercancel);
      this._delegatedActionTarget = undefined;
      this._delegatedActionHandlers = undefined;
    }
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = undefined;
    }
  }

  private _updateDetectedEntities(): void {
    if (!this._config) {
      return;
    }

    const autoDetect = this._config.auto_detect_entities !== false;
    const content = this._config.content || '';

    if (
      this._lastDetectedContent === content &&
      this._lastAutoDetectSetting === autoDetect
    ) {
      return;
    }

    this._lastDetectedContent = content;
    this._lastAutoDetectSetting = autoDetect;
    this._detectedEntities = autoDetect ? extractEntitiesFromContent(content) : [];
  }

  private _setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    if (!this.shadowRoot) {
      return;
    }

    const target =
      this.shadowRoot.querySelector('ha-card') ??
      this.shadowRoot.querySelector('.content') ??
      this.shadowRoot.getElementById('root');

    if (!target) {
      return;
    }

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }

    this._resizeObserverTarget = target;
    this._resizeObserver = new ResizeObserver(() => {
      if (typeof this._notifyCardResize === 'function') {
        this._notifyCardResize();
      }
    });
    this._resizeObserver.observe(target);

    if (this._config?.debug) {
      console.debug('Resize observer setup', { target });
    }
  }

  private _notifyCardResize(): void {
    if (!this.isConnected || !this.shadowRoot) {
      return;
    }

    if (!this.shadowRoot.querySelector('ha-card')) {
      return;
    }

    if (this._resizeNotifyFrame) {
      return;
    }

    this._resizeNotifyFrame = requestAnimationFrame(() => {
      this._resizeNotifyFrame = undefined;
      if (!this.isConnected) {
        return;
      }
      this.dispatchEvent(new Event('card-resize', { bubbles: true, composed: true }));
    });
  }

  /**
   * Setup Twind for runtime Tailwind CSS
   */
  private _setupTwind(): void {
    if (!this.shadowRoot) return;

    const sheet = cssom(new CSSStyleSheet());
    const tw = twind(
      {
        presets: [presetAutoprefix(), presetTailwind()],
      },
      sheet
    );

    // Observe the shadow root for class changes
    this._twindObserver = observe(tw, this.shadowRoot);

    // Adopt the stylesheet
    this.shadowRoot.adoptedStyleSheets = [
      ...this.shadowRoot.adoptedStyleSheets,
      sheet.target,
    ];
  }

  /**
   * Initialize services (template engine, camera capabilities)
   */
  private _initializeServices(): void {
    if (!this.hass) return;

    // Initialize template engine
    this._templateEngine = new TemplateEngine(this.hass);

    // Initialize camera capabilities
    this._cameraCapabilities = new CameraCapabilities(this.hass);

    // Subscribe to template updates
    this._subscribeToTemplate();
  }

  /**
   * Subscribe to template updates via WebSocket
   */
  private async _subscribeToTemplate(): Promise<void> {
    if (!this._config?.content || !this._templateEngine || !this.hass) return;

    // Clean up existing subscription
    if (this._templateSubscription) {
      const unsub = await this._templateSubscription;
      unsub?.();
    }

    // Check if we should use streaming or fallback
    if (this._config.parse_jinja !== false) {
      try {
        // Use WebSocket template streaming
        this._templateSubscription = this._templateEngine.subscribeTemplate(
          this._config.content,
          (result) => {
            this._handleTemplateResult(result);
          },
          this._getWatchedEntities()
        );
      } catch (error) {
        console.warn('Template streaming not available, using fallback:', error);
        this._renderTemplateFallback();
      }
    } else {
      // No Jinja parsing, just use the content as-is
      this._handleTemplateResult(this._config.content);
    }
  }

  /**
   * Fallback template rendering for older HA versions
   */
  private async _renderTemplateFallback(): Promise<void> {
    if (!this._config?.content || !this.hass) return;

    try {
      const result = await this.hass.callWS<{ result: string } | null>({
        type: 'render_template',
        template: this._config.content,
      });
      if (!result || typeof result.result !== 'string') {
        console.warn('Template rendering returned empty result, keeping previous content.');
        return;
      }
      this._handleTemplateResult(result.result);
    } catch (error) {
      console.error('Template rendering failed:', error);
      this._renderedContent = `<div class="error">Template error: ${error}</div>`;
    }
  }

  /**
   * Handle the template result (from streaming or fallback)
   */
  private _handleTemplateResult(result: string): void {
    let content = result;

    // Handle line breaks
    if (!this._config.ignore_line_breaks) {
      content = content.replace(/\r?\n|\r/g, '<br/>');
    }

    // Sanitize HTML (unless trusted mode is enabled)
    if (!this._config.trusted) {
      content = this._sanitizeHtml(content);
    }

    // Skip update if content hasn't changed
    if (content === this._renderedContent) return;

    this._renderedContent = content;
    this.requestUpdate();
  }

  /**
   * Sanitize HTML content using DOMPurify
   */
  private _sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'div', 'span', 'p', 'a', 'img', 'br', 'hr', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th',
        'thead', 'tbody', 'tfoot', 'button', 'input', 'select', 'option',
        'label', 'form', 'video', 'audio', 'source', 'iframe', 'svg',
        'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'text',
        'g', 'defs', 'use', 'symbol', 'ha-icon', 'ha-state-icon', 'ha-svg-icon',
        'ha-card', 'ha-icon-button',
      ],
      ALLOWED_ATTR: [
        'class', 'style', 'id', 'src', 'href', 'alt', 'title', 'width',
        'height', 'type', 'value', 'name', 'placeholder', 'disabled',
        'readonly', 'checked', 'selected', 'for', 'target', 'rel',
        'data-ha-action', 'data-entity', 'data-action-config',
        'd', 'viewBox', 'fill', 'stroke', 'stroke-width', 'cx', 'cy',
        'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform',
        'icon', 'state', 'entity',
      ],
      FORBID_TAGS: ['script', 'style'],
      FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus'],
    });
  }

  /**
   * Get the list of entities to watch for changes
   */
  private _getWatchedEntities(): string[] {
    const entities: Set<string> = new Set();

    // Add explicitly configured entity
    if (this._config?.entity) {
      entities.add(this._config.entity);
    }

    // Add explicitly configured entities list
    if (this._config?.entities) {
      this._config.entities.forEach((e) => entities.add(e));
    }

    // Auto-detect entities mentioned in content
    this._updateDetectedEntities();
    this._detectedEntities.forEach((entityId) => entities.add(entityId));

    // Add entities from bindings
    if (this._config?.bindings) {
      this._config.bindings.forEach((binding) => {
        if (binding.bind && this.hass?.states) {
          Object.keys(this.hass.states).forEach((entityId) => {
            if (binding.bind.includes(entityId)) {
              entities.add(entityId);
            }
          });
        }
      });
    }

    // Add entities from action mappings
    if (this._config?.entity_actions) {
      Object.keys(this._config.entity_actions).forEach((entityId) => entities.add(entityId));
    }

    return Array.from(entities);
  }

  /**
   * Property changed callback
   */
  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (changedProperties.has('hass')) {
      const oldHass = changedProperties.get('hass') as HomeAssistant | undefined;
      
      // Initialize services on first hass set
      if (!oldHass && this.hass && this._config) {
        this._initializeServices();
      }

      // Check if watched entities have changed
      if (this.hass && this._config && !this._config.always_update) {
        this._checkEntityChanges();
      }
    }

    // Apply bindings after render
    if (changedProperties.has('_renderedContent')) {
      this._applyBindings();
      this._setupActionHandlers();
      this._setupEntityActionBindings();
      this._applyHassToContent();
      if (typeof this._setupResizeObserver === 'function') {
        this._setupResizeObserver();
      }
      if (typeof this._notifyCardResize === 'function') {
        this._notifyCardResize();
      }
    }

    if (changedProperties.has('_config') || changedProperties.has('hass')) {
      this._setupCardActions();
      this._setupEntityActionBindings();
    }

    if (changedProperties.has('hass')) {
      this._applyHassToContent();
    }

    if (changedProperties.has('_config') || changedProperties.has('hass')) {
      this._setupCardActions();
    }
  }

  protected firstUpdated(): void {
    super.firstUpdated();
    if (typeof this._setupResizeObserver === 'function') {
      this._setupResizeObserver();
    }
    if (typeof this._notifyCardResize === 'function') {
      this._notifyCardResize();
    }
  }

  /**
   * Check if watched entities have changed
   */
  private _checkEntityChanges(): void {
    if (!this.hass || this._config?.always_update) return;

    const entities = this._getWatchedEntities();
    let hasChanges = false;

    for (const entityId of entities) {
      const currentState = this.hass.states[entityId];
      const previousState = this._previousStates.get(entityId);

      if (JSON.stringify(currentState) !== JSON.stringify(previousState)) {
        hasChanges = true;
        this._previousStates.set(entityId, JSON.parse(JSON.stringify(currentState)));
      }
    }

    // Only re-render if entities changed and we're not using streaming
    if (hasChanges && !this._templateSubscription && this._config?.parse_jinja !== false) {
      this._debounceRender();
    }
  }

  /**
   * Debounce re-rendering to avoid excessive updates
   */
  private _debounceRender(): void {
    if (this._renderDebounceTimeout) {
      clearTimeout(this._renderDebounceTimeout);
    }

    this._renderDebounceTimeout = window.setTimeout(() => {
      this._renderTemplateFallback();
    }, this._config?.debounceChangePeriod || 100);
  }

  /**
   * Apply bindings to the rendered content
   */
  private _applyBindings(): void {
    if (!this._config?.bindings || !this.shadowRoot) return;

    const container = this.shadowRoot.querySelector('.content');
    if (!container) return;

    this._config.bindings.forEach((binding: Binding) => {
      if (!binding.selector || !binding.bind || !binding.type) return;

      const matches = container.querySelectorAll(binding.selector);
      matches.forEach((element) => {
        const result = this._resolveBindValue(element, binding.bind);
        const target = element as HTMLElement;
        const targetAsInput = target as HTMLInputElement;

        switch (binding.type) {
          case 'text':
            target.innerText = String(result ?? '');
            break;
          case 'html':
            target.innerHTML = this._config.trusted
              ? String(result ?? '')
              : this._sanitizeHtml(String(result ?? ''));
            break;
          case 'class':
            if (result) target.classList.add(String(result));
            break;
          case 'checked':
            targetAsInput.checked = Boolean(result);
            break;
          case 'value':
            targetAsInput.value = String(result ?? '');
            break;
          default:
            if (result === undefined || result === '') {
              target.removeAttribute(binding.type);
            } else {
              target.setAttribute(binding.type, String(result));
            }
            break;
        }
      });
    });
  }

  private _applyHassToContent(): void {
    if (!this.shadowRoot || !this.hass) return;

    const container = this.shadowRoot.querySelector('.content');
    if (!container) return;

    container
      .querySelectorAll('ha-icon, ha-state-icon, ha-svg-icon, ha-icon-button')
      .forEach((element) => {
        (element as any).hass = this.hass;
      });
  }

  /**
   * Resolve a binding value
   */
  private _resolveBindValue(element: Element, bind: string): unknown {
    if (!this.hass) return undefined;

    const entity = this._config?.entity
      ? this.hass.states[this._config.entity]
      : undefined;

    try {
      const getState = new Function(
        'hass',
        'config',
        'entity',
        'state',
        'attr',
        bind
      );
      return getState.call(
        element,
        this.hass,
        this._config,
        entity,
        entity?.state,
        entity?.attributes
      );
    } catch (error) {
      console.error('Binding evaluation failed:', bind, error);
      return undefined;
    }
  }

  /**
   * Setup action handlers on elements with data-ha-action attribute
   */
  private _setupActionHandlers(): void {
    if (!this.shadowRoot) return;

    const container = this.shadowRoot.querySelector('.content');
    if (!container) return;

    if (this._delegatedActionTarget !== container) {
      if (this._delegatedActionTarget && this._delegatedActionHandlers) {
        const target = this._delegatedActionTarget;
        const handlers = this._delegatedActionHandlers;
        target.removeEventListener('click', handlers.click);
        target.removeEventListener('dblclick', handlers.dblclick);
        target.removeEventListener('keydown', handlers.keydown);
        target.removeEventListener('pointerdown', handlers.pointerdown);
        target.removeEventListener('pointerup', handlers.pointerup);
        target.removeEventListener('pointercancel', handlers.pointercancel);
      }

      const clickHandler = (ev: Event): void => {
        if (this._suppressNextClick) {
          this._suppressNextClick = false;
          return;
        }
        this._dispatchDelegatedAction('tap', ev);
      };
      const doubleClickHandler = (ev: Event): void => {
        this._dispatchDelegatedAction('double_tap', ev);
      };
      const keydownHandler = (ev: KeyboardEvent): void => {
        if (ev.repeat) return;
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          this._dispatchDelegatedAction('tap', ev);
        }
      };
      const pointerdownHandler = (ev: PointerEvent): void => {
        if (ev.button !== undefined && ev.button !== 0) {
          return;
        }
        if (this._holdTimer) {
          clearTimeout(this._holdTimer);
        }
        this._holdTimer = window.setTimeout(() => {
          const handled = this._dispatchDelegatedAction('hold', ev);
          if (handled) {
            this._suppressNextClick = true;
          }
        }, 500);
      };
      const pointerupHandler = (): void => {
        if (this._holdTimer) {
          clearTimeout(this._holdTimer);
          this._holdTimer = undefined;
        }
      };
      const pointercancelHandler = (): void => {
        if (this._holdTimer) {
          clearTimeout(this._holdTimer);
          this._holdTimer = undefined;
        }
      };

      container.addEventListener('click', clickHandler);
      container.addEventListener('dblclick', doubleClickHandler);
      container.addEventListener('keydown', keydownHandler);
      container.addEventListener('pointerdown', pointerdownHandler);
      container.addEventListener('pointerup', pointerupHandler);
      container.addEventListener('pointercancel', pointercancelHandler);

      this._delegatedActionTarget = container;
      this._delegatedActionHandlers = {
        click: clickHandler,
        dblclick: doubleClickHandler,
        keydown: keydownHandler,
        pointerdown: pointerdownHandler,
        pointerup: pointerupHandler,
        pointercancel: pointercancelHandler,
      };
    }

    // Handle legacy actions from config
    this._setupLegacyActions(container);
  }

  private _dispatchDelegatedAction(actionType: 'tap' | 'hold' | 'double_tap', ev: Event): boolean {
    if (!this.hass || !this._config) {
      return false;
    }

    const target = this._getEventTargetElement(ev);
    const actionNode = target?.closest?.('[data-ha-action], [data-entity]') as HTMLElement | null;
    const entity = actionNode?.closest?.('[data-entity]')?.getAttribute('data-entity') ?? undefined;
    const haActionNode = actionNode?.closest?.('[data-ha-action]') as HTMLElement | null;
    const haAction = haActionNode?.getAttribute('data-ha-action') ?? undefined;
    const actionConfigStr = haActionNode?.getAttribute('data-action-config');

    const entityActionConfig = entity ? this._config.entity_actions?.[entity] : undefined;
    const resolvedTap = entityActionConfig?.tap_action ?? this._config.tap_action;
    const resolvedHold = entityActionConfig?.hold_action ?? this._config.hold_action;
    const resolvedDouble = entityActionConfig?.double_tap_action ?? this._config.double_tap_action;

    let manualActionConfig: Record<string, unknown> | undefined;
    if (actionConfigStr) {
      try {
        manualActionConfig = JSON.parse(actionConfigStr);
      } catch {
        console.warn('Invalid action config:', actionConfigStr);
      }
    }
    if (haAction) {
      if (!manualActionConfig) {
        manualActionConfig = { action: haAction };
      } else if (!('action' in manualActionConfig)) {
        manualActionConfig = { ...manualActionConfig, action: haAction };
      }
      if (entity && !('entity' in manualActionConfig)) {
        manualActionConfig = { ...manualActionConfig, entity };
      }
    }

    const actionConfig = { ...this._config, entity };
    if (actionType === 'tap') {
      actionConfig.tap_action = manualActionConfig ?? resolvedTap;
    } else if (actionType === 'hold') {
      actionConfig.hold_action = manualActionConfig ?? resolvedHold;
    } else {
      actionConfig.double_tap_action = manualActionConfig ?? resolvedDouble;
    }

    const actionToCheck =
      actionType === 'tap'
        ? actionConfig.tap_action
        : actionType === 'hold'
          ? actionConfig.hold_action
          : actionConfig.double_tap_action;

    if (!hasAction(actionToCheck)) {
      return false;
    }

    if (this._config.debug) {
      console.debug('Action dispatch', {
        clicked: target,
        actionNode,
        entity,
        actionConfig: actionToCheck,
        actionType,
      });
    }

    handleAction(this, this.hass, actionConfig, actionType);
    return true;
  }

  private _getEventTargetElement(ev: Event): HTMLElement | null {
    const path = (ev.composedPath?.() || []) as Array<EventTarget>;
    for (const entry of path) {
      if (entry instanceof HTMLElement) {
        return entry;
      }
    }
    const target = ev.target;
    return target instanceof HTMLElement ? target : null;
  }

  private _setupEntityActionBindings(): void {
    if (!this.shadowRoot || !this.hass || !this._config) {
      return;
    }

    const container = this.shadowRoot.querySelector('.content');
    if (!container) return;

    if (this._config.auto_bind_entity_actions === false) {
      container
        .querySelectorAll<HTMLElement>('[data-auto-entity-action]')
        .forEach((element) => this._removeAutoEntityAction(element));
      return;
    }

    const entityActions = this._config.entity_actions || {};
    const boundElements = new Set<HTMLElement>();

    const applyTarget = (element: HTMLElement, entityId: string) => {
      if (element.hasAttribute('data-ha-action')) {
        this._removeAutoEntityAction(element);
        return;
      }
      if (!element.getAttribute('data-entity')) {
        element.setAttribute('data-entity', entityId);
        element.setAttribute('data-auto-entity', 'true');
      }
      this._applyAutoEntityAttributes(element);
    };

    container.querySelectorAll<HTMLElement>('[data-entity]').forEach((element) => {
      const entityId = element.getAttribute('data-entity');
      if (!entityId || !entityActions[entityId]) {
        this._removeAutoEntityAction(element);
        return;
      }
      applyTarget(element, entityId);
      boundElements.add(element);
    });

    Object.entries(entityActions).forEach(([entityId, actionConfig]) => {
      if (!actionConfig?.selector) {
        return;
      }
      container.querySelectorAll<HTMLElement>(actionConfig.selector).forEach((element) => {
        if (boundElements.has(element)) {
          return;
        }
        applyTarget(element, entityId);
        boundElements.add(element);
      });
    });
  }

  private _applyAutoEntityAttributes(element: HTMLElement): void {
    element.classList.add('auto-entity-action');
    element.setAttribute('data-auto-entity-action', 'true');
    if (!element.hasAttribute('role')) {
      element.setAttribute('role', 'button');
      element.setAttribute('data-auto-entity-role', 'true');
    }
    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '0');
      element.setAttribute('data-auto-entity-tabindex', 'true');
    }
  }

  private _removeAutoEntityAction(element: HTMLElement): void {
    if (element.hasAttribute('data-auto-entity-action')) {
      element.classList.remove('auto-entity-action');
      element.removeAttribute('data-auto-entity-action');

      if (element.hasAttribute('data-auto-entity-role')) {
        element.removeAttribute('role');
        element.removeAttribute('data-auto-entity-role');
      }
      if (element.hasAttribute('data-auto-entity-tabindex')) {
        element.removeAttribute('tabindex');
        element.removeAttribute('data-auto-entity-tabindex');
      }
    }

    const listener = this._entityActionListeners.get(element);
    if (listener) {
      element.removeEventListener('action', listener);
      this._entityActionListeners.delete(element);
    }

    removeActionHandler(element);

    if (element.getAttribute('data-auto-entity') === 'true') {
      element.removeAttribute('data-entity');
      element.removeAttribute('data-auto-entity');
    }
  }

  private _setupCardActions(): void {
    if (!this.shadowRoot || !this._config) {
      return;
    }

    const card = this.shadowRoot.getElementById('root') as HTMLElement | null;
    if (!card) {
      return;
    }

    const hasHold = hasAction(this._config.hold_action);
    const hasDoubleClick = hasAction(this._config.double_tap_action);
    const hasTap = hasAction(this._config.tap_action);
    const hasAnyAction = hasTap || hasHold || hasDoubleClick;

    if (this._actionTarget && this._actionTarget !== card) {
      removeActionHandler(this._actionTarget);
      if (this._actionListener) {
        this._actionTarget.removeEventListener('action', this._actionListener);
      }
    }

    this._actionTarget = card;
    if (!this._actionListener) {
      this._actionListener = (ev: Event) => this._handleCardAction(ev as ActionHandlerEvent);
    }

    if (hasAnyAction) {
      setActionHandler(card, { hasHold, hasDoubleClick });
      card.addEventListener('action', this._actionListener);
    } else {
      removeActionHandler(card);
      card.removeEventListener('action', this._actionListener);
    }
  }

  /**
   * Setup legacy action handlers from config
   */
  private _setupLegacyActions(container: Element): void {
    if (!this._config?.actions) return;

    this._config.actions.forEach((action: Action) => {
      if (!action.selector || !action.call || !action.type) return;

      const matches = container.querySelectorAll(action.selector);
      matches.forEach((element) => {
        element.addEventListener(action.type, (e) => {
          this._handleLegacyAction(e, action);
        });
      });
    });
  }

  /**
   * Handle element action (tap/hold/double_tap)
   */
  private _handleElementAction(
    actionType: 'tap' | 'hold' | 'double_tap',
    entityId?: string | null,
    actionConfig?: Record<string, unknown>
  ): void {
    if (!this.hass) return;

    const config = actionConfig || {
      action: 'toggle',
      entity: entityId || this._config?.entity,
    };

    handleAction(this, this.hass, {
      entity: entityId || this._config?.entity,
      [`${actionType}_action`]: config,
    }, actionType);
  }

  /**
   * Handle legacy action execution
   */
  private _handleLegacyAction(event: Event, action: Action): void {
    if (!this.hass || !this._config) return;

    const entityId = this._config.entity;
    const entity = entityId
      ? {
          ...this.hass.states[entityId],
          ...this._createEntityServices(entityId),
        }
      : undefined;

    try {
      const executeCall = new Function('hass', 'config', 'entity', action.call);
      executeCall.call(event.target, this.hass, this._config, entity);
    } catch (error) {
      console.error('Action execution failed:', error);
    }
  }

  /**
   * Create entity service methods
   */
  private _createEntityServices(entityId: string): Record<string, Function> {
    if (!this.hass) return {};

    const [domain] = entityId.split('.');
    const services: Record<string, Function> = {};

    const domainServices = this.hass.services[domain];
    if (domainServices) {
      for (const service in domainServices) {
        services[service] = (data: Record<string, unknown> = {}) =>
          this.hass!.callService(domain, service, { entity_id: entityId, ...data });
      }
    }

    return services;
  }

  /**
   * Handle card click for standard actions
   */
  private _handleCardAction(ev: ActionHandlerEvent): void {
    if (!this.hass || !this._config) return;

    handleAction(this, this.hass, this._config, ev.detail.action!);
  }

  /**
   * Get card size for layout calculations
   */
  public getCardSize(): number {
    const card = this.shadowRoot?.querySelector('ha-card') as HTMLElement | null;
    if (card) {
      const height = card.offsetHeight;
      if (height > 0) {
        return Math.max(1, Math.ceil(height / 50));
      }
    }
    return this._config?.card_size || 3;
  }

  /**
   * Get layout options for Sections dashboard
   */
  public getLayoutOptions() {
    return {
      ...SECTIONS_SIZING,
      ...this._config?.layout_options,
    };
  }

  /**
   * Render the card
   */
  protected render() {
    if (!this._config || !this.hass) {
      return html`<ha-card><div class="error">Configuration required</div></ha-card>`;
    }

    const hasCardAction = hasAction(this._config.tap_action) ||
                         hasAction(this._config.hold_action) ||
                         hasAction(this._config.double_tap_action);

    return html`
      <ha-card id="root" tabindex=${hasCardAction ? '0' : nothing}>
        <div
          class="content"
          .innerHTML=${this._renderedContent}
        ></div>
      </ha-card>
    `;
  }

  /**
   * Card styles
   */
  static get styles() {
    return css`
      :host {
        display: block;
      }
      ha-card {
        height: 100%;
        overflow: hidden;
        display: block;
      }
      .content {
        padding: var(--spacing, 0);
      }
      .content .auto-entity-action {
        cursor: pointer;
      }
      .error {
        color: var(--error-color, red);
        padding: 16px;
      }
    `;
  }
}
