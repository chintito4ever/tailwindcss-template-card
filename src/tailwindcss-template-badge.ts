/**
 * TailwindCSS Template Badge
 * 
 * A companion badge component for Home Assistant that reuses the template+Tailwind
 * pipeline from the card. Supports Jinja2 templates, actions, and safe HTML rendering.
 */

import {
  LitElement,
  html,
  css,
  PropertyValues,
  TemplateResult,
  CSSResultGroup,
  nothing,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { HomeAssistant, ActionConfig, LovelaceBadge, LovelaceBadgeEditor } from 'custom-card-helpers';
import { handleAction, hasAction } from 'custom-card-helpers';
import DOMPurify from 'dompurify';

// Twind imports
import { twind, cssom, observe } from '@twind/core';
import presetTailwind from '@twind/preset-tailwind';
import presetAutoprefix from '@twind/preset-autoprefix';

import type { TailwindTemplateBadgeConfig, Binding } from './types';
import { CARD_VERSION, DEFAULT_CONFIG } from './const';
import { TemplateEngine } from './services/template-engine';
import { setActionHandler, removeActionHandler } from './utils/action-binding';

// Register custom element
declare global {
  interface HTMLElementTagNameMap {
    'tailwindcss-template-badge': TailwindTemplateCardBadge;
    'tailwindcss-template-badge-editor': LovelaceBadgeEditor;
  }
}

// Allowed tags and attributes for badge (more restrictive than card)
const BADGE_ALLOWED_TAGS = [
  'span', 'div', 'ha-icon', 'ha-state-icon', 'ha-svg-icon',
  'img', 'b', 'i', 'strong', 'em', 'br', 'small', 'sup', 'sub',
];

const BADGE_ALLOWED_ATTRS = [
  'class', 'style', 'icon', 'src', 'alt', 'title',
  'data-ha-action', 'data-entity', 'data-action-type',
];

@customElement('tailwindcss-template-badge')
export class TailwindTemplateCardBadge extends LitElement implements LovelaceBadge {
  // Version info
  public static readonly VERSION = CARD_VERSION;

  // Home Assistant instance
  @property({ attribute: false }) public hass!: HomeAssistant;

  // Badge configuration
  @property({ attribute: false }) public _config!: TailwindTemplateBadgeConfig;

  // Rendered content
  @state() private _content: string = '';

  // Loading state
  @state() private _loading: boolean = true;

  // Error state
  @state() private _error: string | null = null;

  // Template engine instance
  private _templateEngine?: TemplateEngine;

  // Twind instance
  private _tw?: ReturnType<typeof twind>;

  // Shadow root observer for Twind
  private _observer?: MutationObserver;

  // Debounce timer
  private _debounceTimer?: number;

  private _actionTarget?: HTMLElement;
  private _actionListener?: (ev: Event) => void;

  /**
   * Set badge configuration
   */
  public setConfig(config: TailwindTemplateBadgeConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }

    // Merge with defaults
    this._config = {
      ...DEFAULT_CONFIG,
      ...config,
      // Badge-specific defaults
      trusted: config.trusted ?? false,
    };

    // Reset state
    this._content = '';
    this._error = null;
    this._loading = true;
  }

  /**
   * Get badge editor element
   */
  public static getConfigElement(): Promise<LovelaceBadgeEditor> {
    return import('./tailwindcss-template-badge-editor').then(() => {
      return document.createElement('tailwindcss-template-badge-editor') as LovelaceBadgeEditor;
    });
  }

  /**
   * Get stub configuration for badge picker
   */
  public static getStubConfig(): TailwindTemplateBadgeConfig {
    return {
      type: 'custom:tailwindcss-template-badge',
      content: '<span class="text-sm font-medium">{{ states("sensor.example") }}</span>',
    };
  }

  /**
   * Reactive properties
   */
  static get properties() {
    return {
      hass: { attribute: false },
      _config: { attribute: false },
      _content: { state: true },
      _loading: { state: true },
      _error: { state: true },
    };
  }

  /**
   * Lifecycle: Connected to DOM
   */
  connectedCallback(): void {
    super.connectedCallback();
    this._setupTwind();
    this._subscribeTemplate();
  }

  /**
   * Lifecycle: Disconnected from DOM
   */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._cleanup();
  }

  /**
   * Lifecycle: Property changed
   */
  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);

    if (changedProps.has('hass') && this.hass) {
      // Update template engine with new hass instance
      if (this._templateEngine) {
        this._templateEngine.updateHass(this.hass);
      }
    }

    if (changedProps.has('_config')) {
      // Re-subscribe on config change
      this._subscribeTemplate();
    }

    if (changedProps.has('_config') || changedProps.has('_content')) {
      this._setupBadgeActions();
    }
  }

  /**
   * Setup Twind for styling
   */
  private _setupTwind(): void {
    if (this._tw || !this.shadowRoot) return;

    const sheet = cssom(new CSSStyleSheet());
    this._tw = twind(
      {
        presets: [presetAutoprefix(), presetTailwind()],
        hash: false,
      },
      sheet
    );

    // Adopt stylesheet
    this.shadowRoot.adoptedStyleSheets = [sheet.target];

    // Observe for Twind class processing
    this._observer = observe(this._tw, this.shadowRoot);
  }

  /**
   * Subscribe to template updates
   */
  private async _subscribeTemplate(): Promise<void> {
    if (!this.hass || !this._config?.content) {
      this._loading = false;
      return;
    }

    // Cleanup existing subscription
    if (this._templateEngine) {
      this._templateEngine.cleanup();
    }

    // Create new template engine
    this._templateEngine = new TemplateEngine(this.hass);

    try {
      // Check if content needs Jinja processing
      if (this._config.parse_jinja !== false && this._containsJinja(this._config.content)) {
        // Subscribe to template updates
        await this._templateEngine.subscribeTemplate(
          this._config.content,
          (result) => this._handleTemplateResult(result),
          this._config.entities
        );
      } else {
        // Static content - no Jinja
        this._handleTemplateResult(this._config.content);
      }

      this._loading = false;
    } catch (error) {
      console.error('Template subscription error:', error);
      this._error = error instanceof Error ? error.message : 'Template error';
      this._loading = false;
    }
  }

  /**
   * Check if content contains Jinja templates
   */
  private _containsJinja(content: string): boolean {
    return /\{\{.*?\}\}|\{%.*?%\}/s.test(content);
  }

  /**
   * Handle template result
   */
  private _handleTemplateResult(result: string): void {
    // Debounce updates
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    const debounce = this._config.debounceChangePeriod ?? DEFAULT_CONFIG.debounceChangePeriod;

    this._debounceTimer = window.setTimeout(() => {
      // Skip if content hasn't changed
      if (result === this._content) return;

      // Sanitize content
      this._content = this._sanitizeContent(result);
      this._error = null;
    }, debounce);
  }

  /**
   * Sanitize HTML content
   */
  private _sanitizeContent(content: string): string {
    // If trusted mode, return as-is (use with caution!)
    if (this._config.trusted) {
      return content;
    }

    // Sanitize with DOMPurify using badge-specific restrictions
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: BADGE_ALLOWED_TAGS,
      ALLOWED_ATTR: BADGE_ALLOWED_ATTRS,
      ALLOW_DATA_ATTR: true,
      ALLOW_ARIA_ATTR: true,
    });
  }

  /**
   * Handle action events from content
   */
  private _handleContentAction(ev: Event): void {
    const target = ev.target as HTMLElement;
    const actionElement = target.closest('[data-ha-action]');

    if (!actionElement) return;

    const actionType = actionElement.getAttribute('data-ha-action') || 'tap';
    const entityId = actionElement.getAttribute('data-entity') || this._config.entity;

    if (!entityId) return;

    // Get action config
    let actionConfig: ActionConfig | undefined;

    switch (actionType) {
      case 'tap':
        actionConfig = this._config.tap_action || { action: 'more-info' };
        break;
      case 'hold':
        actionConfig = this._config.hold_action;
        break;
      case 'double_tap':
        actionConfig = this._config.double_tap_action;
        break;
    }

    if (actionConfig) {
      handleAction(this, this.hass, { ...actionConfig, entity: entityId } as any, actionType);
    }
  }

  /**
   * Handle badge click (main tap action)
   */
  private _handleBadgeAction(ev: CustomEvent): void {
    if (!this.hass) return;

    const action = ev.detail?.action || 'tap';
    let actionConfig: ActionConfig | undefined;

    switch (action) {
      case 'tap':
        actionConfig = this._config.tap_action || {
          action: 'more-info',
          entity: this._config.entity,
        };
        break;
      case 'hold':
        actionConfig = this._config.hold_action;
        break;
      case 'double_tap':
        actionConfig = this._config.double_tap_action;
        break;
    }

    if (actionConfig && hasAction(actionConfig)) {
      handleAction(
        this,
        this.hass,
        actionConfig as any,
        action
      );
    }
  }

  /**
   * Cleanup resources
   */
  private _cleanup(): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = undefined;
    }

    if (this._templateEngine) {
      this._templateEngine.cleanup();
      this._templateEngine = undefined;
    }

    if (this._observer) {
      this._observer.disconnect();
      this._observer = undefined;
    }

    if (this._actionTarget) {
      removeActionHandler(this._actionTarget);
      if (this._actionListener) {
        this._actionTarget.removeEventListener('action', this._actionListener);
      }
      this._actionTarget = undefined;
    }
  }

  private _setupBadgeActions(): void {
    if (!this.shadowRoot || !this._config) {
      return;
    }

    const badge = this.shadowRoot.getElementById('badge-root') as HTMLElement | null;
    if (!badge) {
      return;
    }

    const hasHold = hasAction(this._config.hold_action);
    const hasDoubleClick = hasAction(this._config.double_tap_action);
    const hasTap = hasAction(this._config.tap_action);
    const hasAnyAction = hasTap || hasHold || hasDoubleClick;

    if (this._actionTarget && this._actionTarget !== badge) {
      removeActionHandler(this._actionTarget);
      if (this._actionListener) {
        this._actionTarget.removeEventListener('action', this._actionListener);
      }
    }

    this._actionTarget = badge;
    if (!this._actionListener) {
      this._actionListener = (ev: Event) => this._handleBadgeAction(ev as CustomEvent);
    }

    if (hasAnyAction) {
      setActionHandler(badge, { hasHold, hasDoubleClick });
      badge.addEventListener('action', this._actionListener);
    } else {
      removeActionHandler(badge);
      badge.removeEventListener('action', this._actionListener);
    }
  }

  /**
   * Render badge
   */
  protected render(): TemplateResult {
    if (this._loading) {
      return html`
        <div class="badge-container loading">
          <ha-circular-progress indeterminate size="small"></ha-circular-progress>
        </div>
      `;
    }

    if (this._error) {
      return html`
        <div class="badge-container error" title="${this._error}">
          <ha-icon icon="mdi:alert-circle"></ha-icon>
        </div>
      `;
    }

    const hasBadgeAction =
      hasAction(this._config.tap_action) ||
      hasAction(this._config.hold_action) ||
      hasAction(this._config.double_tap_action);

    return html`
      <div
        id="badge-root"
        class="badge-container"
        @click="${this._handleContentAction}"
        tabindex=${hasBadgeAction ? '0' : nothing}
      >
        ${unsafeHTML(this._content)}
      </div>
    `;
  }

  /**
   * Component styles
   */
  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: inline-flex;
        align-items: center;
      }

      .badge-container {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 4px 8px;
        border-radius: 16px;
        background: var(--ha-card-background, var(--card-background-color, #fff));
        box-shadow: var(--ha-card-box-shadow, 0 2px 2px 0 rgba(0, 0, 0, 0.14));
        cursor: pointer;
        transition: transform 0.1s ease-in-out;
        min-height: 24px;
        font-size: 0.875rem;
      }

      .badge-container:hover {
        transform: scale(1.05);
      }

      .badge-container:active {
        transform: scale(0.98);
      }

      .badge-container.loading {
        min-width: 48px;
        justify-content: center;
      }

      .badge-container.error {
        background: var(--error-color, #db4437);
        color: white;
      }

      .badge-container.error ha-icon {
        --mdc-icon-size: 16px;
      }

      ha-circular-progress {
        --mdc-theme-primary: var(--primary-color);
      }

      /* Allow Tailwind classes to override */
      .badge-container * {
        all: revert;
      }
    `;
  }
}

// Register badge with Home Assistant
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'tailwindcss-template-badge',
  name: 'TailwindCSS Template Badge',
  description: 'A badge that renders Jinja2 templates with Tailwind CSS styling',
  preview: true,
  documentationURL: 'https://github.com/chintito4ever/tailwindcss-template-card',
});

console.info(
  `%c TAILWINDCSS-TEMPLATE-BADGE %c v${CARD_VERSION} `,
  'color: white; background: #3B82F6; font-weight: bold;',
  'color: #3B82F6; background: white; font-weight: bold;'
);
