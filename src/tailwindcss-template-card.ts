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

  private _actionTarget?: HTMLElement;
  private _actionListener?: (ev: Event) => void;

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

    if (this._actionTarget) {
      removeActionHandler(this._actionTarget);
      if (this._actionListener) {
        this._actionTarget.removeEventListener('action', this._actionListener);
      }
      this._actionTarget = undefined;
    }
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
      const result = await this.hass.callWS<{ result: string }>({
        type: 'render_template',
        template: this._config.content,
      });
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
        'g', 'defs', 'use', 'symbol', 'ha-icon', 'ha-card', 'ha-icon-button',
      ],
      ALLOWED_ATTR: [
        'class', 'style', 'id', 'src', 'href', 'alt', 'title', 'width',
        'height', 'type', 'value', 'name', 'placeholder', 'disabled',
        'readonly', 'checked', 'selected', 'for', 'target', 'rel',
        'data-ha-action', 'data-entity', 'data-action-config',
        'd', 'viewBox', 'fill', 'stroke', 'stroke-width', 'cx', 'cy',
        'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform',
        'icon',
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
    if (this._config?.content && this.hass?.states) {
      const content = this._config.content;
      Object.keys(this.hass.states).forEach((entityId) => {
        if (content.includes(entityId)) {
          entities.add(entityId);
        }
      });
    }

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
    }

    if (changedProperties.has('_config') || changedProperties.has('hass')) {
      this._setupCardActions();
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

    // Find elements with data-ha-action
    const actionElements = container.querySelectorAll('[data-ha-action]');
    actionElements.forEach((element) => {
      const actionType = element.getAttribute('data-ha-action');
      const entityId = element.getAttribute('data-entity');
      const actionConfigStr = element.getAttribute('data-action-config');

      let actionConfig: ActionHandlerEvent['detail']['action'] | undefined;
      if (actionConfigStr) {
        try {
          actionConfig = JSON.parse(actionConfigStr);
        } catch {
          console.warn('Invalid action config:', actionConfigStr);
        }
      }

      // Add action handler directive
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        this._handleElementAction('tap', entityId, actionConfig);
      });

      element.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this._handleElementAction('double_tap', entityId, actionConfig);
      });

      // Long press handling
      let pressTimer: number | undefined;
      element.addEventListener('mousedown', () => {
        pressTimer = window.setTimeout(() => {
          this._handleElementAction('hold', entityId, actionConfig);
        }, 500);
      });
      element.addEventListener('mouseup', () => {
        if (pressTimer) clearTimeout(pressTimer);
      });
      element.addEventListener('mouseleave', () => {
        if (pressTimer) clearTimeout(pressTimer);
      });
    });

    // Handle legacy actions from config
    this._setupLegacyActions(container);
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
      }
      .content {
        padding: var(--spacing, 0);
      }
      .error {
        color: var(--error-color, red);
        padding: 16px;
      }
    `;
  }
}
