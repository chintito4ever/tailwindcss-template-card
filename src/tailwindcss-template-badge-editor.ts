/**
 * TailwindCSS Template Badge Editor
 * 
 * Visual editor for the badge component using Home Assistant selectors.
 */

import {
  LitElement,
  html,
  css,
  TemplateResult,
  CSSResultGroup,
  PropertyValues,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, LovelaceBadgeEditor } from 'custom-card-helpers';
import { fireEvent } from 'custom-card-helpers';
import type { TailwindTemplateBadgeConfig } from './types';
import { DEFAULT_CONFIG } from './const';

// Schema for Content tab
const CONTENT_SCHEMA = [
  {
    name: 'content',
    selector: {
      template: {},
    },
  },
];

// Schema for Entity tab
const ENTITY_SCHEMA = [
  {
    name: 'entity',
    selector: {
      entity: {},
    },
  },
  {
    name: 'entities',
    selector: {
      entity: {
        multiple: true,
      },
    },
  },
];

// Schema for Actions tab
const ACTIONS_SCHEMA = [
  {
    name: 'tap_action',
    selector: {
      'ui-action': {},
    },
  },
  {
    name: 'hold_action',
    selector: {
      'ui-action': {},
    },
  },
  {
    name: 'double_tap_action',
    selector: {
      'ui-action': {},
    },
  },
];

// Schema for Options tab
const OPTIONS_SCHEMA = [
  {
    name: 'parse_jinja',
    selector: {
      boolean: {},
    },
  },
  {
    name: 'trusted',
    selector: {
      boolean: {},
    },
  },
  {
    name: 'debounceChangePeriod',
    selector: {
      number: {
        min: 0,
        max: 2000,
        step: 50,
        unit_of_measurement: 'ms',
        mode: 'slider',
      },
    },
  },
];

// Tab definitions
type TabName = 'content' | 'entity' | 'actions' | 'options';

interface TabConfig {
  id: TabName;
  label: string;
  icon: string;
}

const TABS: TabConfig[] = [
  { id: 'content', label: 'Content', icon: 'mdi:code-braces' },
  { id: 'entity', label: 'Entity', icon: 'mdi:eye' },
  { id: 'actions', label: 'Actions', icon: 'mdi:gesture-tap' },
  { id: 'options', label: 'Options', icon: 'mdi:cog' },
];

@customElement('tailwindcss-template-badge-editor')
export class TailwindTemplateCardBadgeEditor extends LitElement implements LovelaceBadgeEditor {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: TailwindTemplateBadgeConfig;
  @state() private _activeTab: TabName = 'content';

  /**
   * Set editor configuration
   */
  public setConfig(config: TailwindTemplateBadgeConfig): void {
    this._config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Handle tab change
   */
  private _handleTabChange(tab: TabName): void {
    this._activeTab = tab;
  }

  /**
   * Handle value change from ha-form
   */
  private _valueChanged(ev: CustomEvent): void {
    const config = ev.detail.value;
    
    fireEvent(this, 'config-changed', {
      config: {
        ...this._config,
        ...config,
      },
    });
  }

  /**
   * Render tab content
   */
  private _renderTabContent(): TemplateResult {
    switch (this._activeTab) {
      case 'content':
        return this._renderContentTab();
      case 'entity':
        return this._renderEntityTab();
      case 'actions':
        return this._renderActionsTab();
      case 'options':
        return this._renderOptionsTab();
      default:
        return html``;
    }
  }

  /**
   * Render Content tab
   */
  private _renderContentTab(): TemplateResult {
    return html`
      <div class="tab-content">
        <div class="section">
          <div class="section-header">
            <ha-icon icon="mdi:code-braces"></ha-icon>
            <span>Badge Content</span>
          </div>
          <p class="description">
            Enter the HTML/Jinja2 template for your badge content. Use Tailwind CSS classes for styling.
          </p>
          <ha-form
            .hass=${this.hass}
            .data=${this._config}
            .schema=${CONTENT_SCHEMA}
            .computeLabel=${this._computeLabel}
            @value-changed=${this._valueChanged}
          ></ha-form>
        </div>

        <div class="section">
          <div class="section-header">
            <ha-icon icon="mdi:lightbulb-outline"></ha-icon>
            <span>Examples</span>
          </div>
          <div class="examples">
            <div class="example">
              <code>&lt;span class="font-bold"&gt;{{ states('sensor.temperature') }}°&lt;/span&gt;</code>
            </div>
            <div class="example">
              <code>&lt;ha-icon icon="mdi:thermometer"&gt;&lt;/ha-icon&gt; {{ states('sensor.temp') }}</code>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Entity tab
   */
  private _renderEntityTab(): TemplateResult {
    return html`
      <div class="tab-content">
        <div class="section">
          <div class="section-header">
            <ha-icon icon="mdi:eye"></ha-icon>
            <span>Entity Configuration</span>
          </div>
          <p class="description">
            Select the primary entity for this badge. Additional entities can be watched for updates.
          </p>
          <ha-form
            .hass=${this.hass}
            .data=${this._config}
            .schema=${ENTITY_SCHEMA}
            .computeLabel=${this._computeLabel}
            @value-changed=${this._valueChanged}
          ></ha-form>
        </div>
      </div>
    `;
  }

  /**
   * Render Actions tab
   */
  private _renderActionsTab(): TemplateResult {
    return html`
      <div class="tab-content">
        <div class="section">
          <div class="section-header">
            <ha-icon icon="mdi:gesture-tap"></ha-icon>
            <span>Badge Actions</span>
          </div>
          <p class="description">
            Configure what happens when you interact with the badge.
          </p>
          <ha-form
            .hass=${this.hass}
            .data=${this._config}
            .schema=${ACTIONS_SCHEMA}
            .computeLabel=${this._computeLabel}
            @value-changed=${this._valueChanged}
          ></ha-form>
        </div>
      </div>
    `;
  }

  /**
   * Render Options tab
   */
  private _renderOptionsTab(): TemplateResult {
    return html`
      <div class="tab-content">
        <div class="section">
          <div class="section-header">
            <ha-icon icon="mdi:cog"></ha-icon>
            <span>Badge Options</span>
          </div>

          <ha-form
            .hass=${this.hass}
            .data=${this._config}
            .schema=${OPTIONS_SCHEMA}
            .computeLabel=${this._computeLabel}
            .computeHelper=${this._computeHelper}
            @value-changed=${this._valueChanged}
          ></ha-form>
        </div>

        ${this._config.trusted ? html`
          <ha-alert alert-type="warning">
            <strong>Trusted mode is enabled!</strong> This allows potentially dangerous HTML.
            Only enable if you trust all template sources.
          </ha-alert>
        ` : ''}
      </div>
    `;
  }

  /**
   * Compute label for form fields
   */
  private _computeLabel = (schema: { name: string }): string => {
    const labels: Record<string, string> = {
      content: 'Template Content',
      entity: 'Primary Entity',
      entities: 'Additional Entities',
      tap_action: 'Tap Action',
      hold_action: 'Hold Action',
      double_tap_action: 'Double Tap Action',
      parse_jinja: 'Parse Jinja2 Templates',
      trusted: 'Trusted Mode (Unsafe)',
      debounceChangePeriod: 'Debounce Period',
    };
    return labels[schema.name] || schema.name;
  };

  /**
   * Compute helper text for form fields
   */
  private _computeHelper = (schema: { name: string }): string => {
    const helpers: Record<string, string> = {
      parse_jinja: 'Process Jinja2 templates in content',
      trusted: 'Allow all HTML including scripts (dangerous!)',
      debounceChangePeriod: 'Delay between template updates',
    };
    return helpers[schema.name] || '';
  };

  /**
   * Render editor
   */
  protected render(): TemplateResult {
    if (!this.hass || !this._config) {
      return html``;
    }

    return html`
      <div class="editor">
        <div class="tabs">
          ${TABS.map(
            (tab) => html`
              <button
                class="tab ${this._activeTab === tab.id ? 'active' : ''}"
                @click=${() => this._handleTabChange(tab.id)}
              >
                <ha-icon icon="${tab.icon}"></ha-icon>
                <span>${tab.label}</span>
              </button>
            `
          )}
        </div>

        ${this._renderTabContent()}
      </div>
    `;
  }

  /**
   * Component styles
   */
  static get styles(): CSSResultGroup {
    return css`
      .editor {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .tabs {
        display: flex;
        border-bottom: 1px solid var(--divider-color);
        gap: 4px;
        overflow-x: auto;
      }

      .tab {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--secondary-text-color);
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
        font-size: 14px;
      }

      .tab:hover {
        color: var(--primary-text-color);
        background: var(--secondary-background-color);
      }

      .tab.active {
        color: var(--primary-color);
        border-bottom-color: var(--primary-color);
      }

      .tab ha-icon {
        --mdc-icon-size: 20px;
      }

      .tab-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .section {
        background: var(--card-background-color);
        border-radius: 8px;
        padding: 16px;
        border: 1px solid var(--divider-color);
      }

      .section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-weight: 500;
        color: var(--primary-text-color);
      }

      .section-header ha-icon {
        --mdc-icon-size: 20px;
        color: var(--primary-color);
      }

      .description {
        color: var(--secondary-text-color);
        font-size: 0.875rem;
        margin: 0 0 16px 0;
      }

      .examples {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .example {
        background: var(--secondary-background-color);
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 0.8rem;
      }

      .example code {
        font-family: monospace;
        color: var(--primary-text-color);
      }

      ha-alert {
        margin-top: 8px;
      }

      ha-form {
        display: block;
      }
    `;
  }
}
