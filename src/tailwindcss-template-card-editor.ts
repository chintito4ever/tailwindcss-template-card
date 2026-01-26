/**
 * TailwindCSS Template Card Editor
 * 
 * Modern card editor using Home Assistant selectors.
 */

import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, fireEvent, LovelaceCardEditor } from 'custom-card-helpers';
import type { TailwindTemplateCardConfig, LayoutOptions } from './types';
import { DEFAULT_CONFIG, DAISYUI_THEMES, SECTIONS_SIZING } from './const';

// Schema definitions for HA selectors
const CONTENT_SCHEMA = [
  {
    name: 'content',
    selector: { template: {} },
  },
];

const ENTITY_SCHEMA = [
  {
    name: 'entity',
    selector: { entity: {} },
  },
];

const ENTITIES_SCHEMA = [
  {
    name: 'entities',
    selector: {
      entity: {
        multiple: true,
      },
    },
  },
];

const ACTIONS_SCHEMA = [
  {
    name: 'tap_action',
    selector: { 'ui-action': {} },
  },
  {
    name: 'hold_action',
    selector: { 'ui-action': {} },
  },
  {
    name: 'double_tap_action',
    selector: { 'ui-action': {} },
  },
];

const OPTIONS_SCHEMA = [
  {
    name: 'parse_jinja',
    selector: { boolean: {} },
  },
  {
    name: 'ignore_line_breaks',
    selector: { boolean: {} },
  },
  {
    name: 'trusted',
    selector: { boolean: {} },
  },
  {
    name: 'always_update',
    selector: { boolean: {} },
  },
];

const LAYOUT_SCHEMA = [
  {
    name: '',
    type: 'grid',
    schema: [
      {
        name: 'grid_columns',
        selector: {
          number: {
            min: 1,
            max: 12,
            mode: 'slider',
          },
        },
      },
      {
        name: 'grid_rows',
        selector: {
          number: {
            min: 1,
            max: 12,
            mode: 'slider',
          },
        },
      },
    ],
  },
];

@customElement('tailwindcss-template-card-editor')
export class TailwindTemplateCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: TailwindTemplateCardConfig;
  @state() private _activeTab = 'content';

  public setConfig(config: TailwindTemplateCardConfig): void {
    this._config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  private _valueChanged(ev: CustomEvent): void {
    if (!this._config || !this.hass) {
      return;
    }

    const target = ev.target as any;
    const configValue = target.configValue;

    if (configValue) {
      const newValue = ev.detail?.value ?? target.value ?? target.checked;

      if (this._config[configValue] === newValue) {
        return;
      }

      let newConfig: TailwindTemplateCardConfig;

      if (newValue === '' || newValue === undefined) {
        newConfig = { ...this._config };
        delete (newConfig as any)[configValue];
      } else {
        newConfig = {
          ...this._config,
          [configValue]: newValue,
        };
      }

      fireEvent(this, 'config-changed', { config: newConfig });
    }
  }

  private _schemaValueChanged(ev: CustomEvent): void {
    if (!this._config || !this.hass) {
      return;
    }

    const newConfig = ev.detail.value;
    fireEvent(this, 'config-changed', { config: { ...this._config, ...newConfig } });
  }

  private _layoutValueChanged(ev: CustomEvent): void {
    if (!this._config || !this.hass) {
      return;
    }

    const layoutOptions = {
      ...this._config.layout_options,
      ...ev.detail.value,
    };

    fireEvent(this, 'config-changed', {
      config: { ...this._config, layout_options: layoutOptions },
    });
  }

  private _contentChanged(ev: Event): void {
    const target = ev.target as HTMLTextAreaElement;
    if (!this._config || target.value === this._config.content) {
      return;
    }

    fireEvent(this, 'config-changed', {
      config: { ...this._config, content: target.value },
    });
  }

  private _setTab(tab: string): void {
    this._activeTab = tab;
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }

    return html`
      <div class="card-config">
        <!-- Tabs -->
        <div class="tabs">
          <button
            class="tab ${this._activeTab === 'content' ? 'active' : ''}"
            @click=${() => this._setTab('content')}
          >
            Content
          </button>
          <button
            class="tab ${this._activeTab === 'entity' ? 'active' : ''}"
            @click=${() => this._setTab('entity')}
          >
            Entity
          </button>
          <button
            class="tab ${this._activeTab === 'actions' ? 'active' : ''}"
            @click=${() => this._setTab('actions')}
          >
            Actions
          </button>
          <button
            class="tab ${this._activeTab === 'options' ? 'active' : ''}"
            @click=${() => this._setTab('options')}
          >
            Options
          </button>
          <button
            class="tab ${this._activeTab === 'layout' ? 'active' : ''}"
            @click=${() => this._setTab('layout')}
          >
            Layout
          </button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          ${this._activeTab === 'content' ? this._renderContentTab() : nothing}
          ${this._activeTab === 'entity' ? this._renderEntityTab() : nothing}
          ${this._activeTab === 'actions' ? this._renderActionsTab() : nothing}
          ${this._activeTab === 'options' ? this._renderOptionsTab() : nothing}
          ${this._activeTab === 'layout' ? this._renderLayoutTab() : nothing}
        </div>
      </div>
    `;
  }

  private _renderContentTab() {
    return html`
      <div class="section">
        <h3>HTML / Jinja2 Template</h3>
        <p class="description">
          Write your HTML content with Tailwind CSS classes. Use Jinja2 templates for dynamic content.
        </p>
        <textarea
          class="content-editor"
          .value=${this._config.content || ''}
          @input=${this._contentChanged}
          rows="15"
          spellcheck="false"
        ></textarea>
        <div class="hint">
          <strong>Tip:</strong> Use <code>{{ states('sensor.temperature') }}</code> for entity states,
          or <code>{{ state_attr('sensor.temperature', 'unit_of_measurement') }}</code> for attributes.
        </div>
      </div>
    `;
  }

  private _renderEntityTab() {
    return html`
      <div class="section">
        <h3>Primary Entity</h3>
        <p class="description">
          Select an entity for quick access in templates and bindings.
        </p>
        <ha-form
          .hass=${this.hass}
          .data=${{ entity: this._config.entity }}
          .schema=${ENTITY_SCHEMA}
          .computeLabel=${(schema: any) => schema.name === 'entity' ? 'Entity' : schema.name}
          @value-changed=${this._schemaValueChanged}
        ></ha-form>
      </div>

      <div class="section">
        <h3>Additional Entities</h3>
        <p class="description">
          Add more entities to watch for changes.
        </p>
        <ha-form
          .hass=${this.hass}
          .data=${{ entities: this._config.entities || [] }}
          .schema=${ENTITIES_SCHEMA}
          .computeLabel=${(schema: any) => 'Entities'}
          @value-changed=${this._schemaValueChanged}
        ></ha-form>
      </div>
    `;
  }

  private _renderActionsTab() {
    return html`
      <div class="section">
        <h3>Card Actions</h3>
        <p class="description">
          Configure what happens when you tap, hold, or double-tap the card.
        </p>
        <ha-form
          .hass=${this.hass}
          .data=${{
            tap_action: this._config.tap_action,
            hold_action: this._config.hold_action,
            double_tap_action: this._config.double_tap_action,
          }}
          .schema=${ACTIONS_SCHEMA}
          .computeLabel=${(schema: any) => {
            switch (schema.name) {
              case 'tap_action': return 'Tap Action';
              case 'hold_action': return 'Hold Action';
              case 'double_tap_action': return 'Double Tap Action';
              default: return schema.name;
            }
          }}
          @value-changed=${this._schemaValueChanged}
        ></ha-form>
      </div>

      <div class="section">
        <h3>Element Actions</h3>
        <p class="description">
          Add <code>data-ha-action</code> attribute to elements inside your template to make them interactive.
        </p>
        <div class="hint">
          <strong>Example:</strong>
          <pre>&lt;button data-ha-action="tap" data-entity="light.living_room"&gt;Toggle&lt;/button&gt;</pre>
        </div>
      </div>
    `;
  }

  private _renderOptionsTab() {
    return html`
      <div class="section">
        <h3>Rendering Options</h3>
        <ha-form
          .hass=${this.hass}
          .data=${{
            parse_jinja: this._config.parse_jinja ?? true,
            ignore_line_breaks: this._config.ignore_line_breaks ?? true,
            trusted: this._config.trusted ?? false,
            always_update: this._config.always_update ?? false,
          }}
          .schema=${OPTIONS_SCHEMA}
          .computeLabel=${(schema: any) => {
            switch (schema.name) {
              case 'parse_jinja': return 'Parse Jinja2 Templates';
              case 'ignore_line_breaks': return 'Ignore Line Breaks';
              case 'trusted': return 'Trusted Mode (Disable Sanitization)';
              case 'always_update': return 'Always Update';
              default: return schema.name;
            }
          }}
          .computeHelper=${(schema: any) => {
            switch (schema.name) {
              case 'trusted': return '⚠️ Warning: Enables potentially unsafe HTML';
              case 'always_update': return 'Re-render on every state change (may impact performance)';
              default: return '';
            }
          }}
          @value-changed=${this._schemaValueChanged}
        ></ha-form>
      </div>

      <div class="section">
        <h3>Performance</h3>
        <label class="option">
          <span>Debounce Period (ms)</span>
          <input
            type="number"
            min="0"
            max="2000"
            step="50"
            .value=${String(this._config.debounceChangePeriod || 100)}
            .configValue=${'debounceChangePeriod'}
            @change=${this._valueChanged}
          />
        </label>
      </div>
    `;
  }

  private _renderLayoutTab() {
    const layoutOptions = this._config.layout_options || SECTIONS_SIZING;

    return html`
      <div class="section">
        <h3>Sections Dashboard Layout</h3>
        <p class="description">
          Configure how the card appears in Sections dashboards (12-column grid in Precise mode).
        </p>

        <div class="grid-2">
          <label class="option">
            <span>Default Columns</span>
            <input
              type="number"
              min="1"
              max="12"
              .value=${String(layoutOptions.grid_columns || 6)}
              @change=${(e: Event) => this._updateLayoutOption('grid_columns', parseInt((e.target as HTMLInputElement).value))}
            />
          </label>
          <label class="option">
            <span>Default Rows</span>
            <input
              type="number"
              min="1"
              max="12"
              .value=${String(layoutOptions.grid_rows || 2)}
              @change=${(e: Event) => this._updateLayoutOption('grid_rows', parseInt((e.target as HTMLInputElement).value))}
            />
          </label>
        </div>

        <h4>Constraints</h4>
        <div class="grid-2">
          <label class="option">
            <span>Min Columns</span>
            <input
              type="number"
              min="1"
              max="12"
              .value=${String(layoutOptions.grid_min_columns || 2)}
              @change=${(e: Event) => this._updateLayoutOption('grid_min_columns', parseInt((e.target as HTMLInputElement).value))}
            />
          </label>
          <label class="option">
            <span>Max Columns</span>
            <input
              type="number"
              min="1"
              max="12"
              .value=${String(layoutOptions.grid_max_columns || 12)}
              @change=${(e: Event) => this._updateLayoutOption('grid_max_columns', parseInt((e.target as HTMLInputElement).value))}
            />
          </label>
          <label class="option">
            <span>Min Rows</span>
            <input
              type="number"
              min="1"
              max="12"
              .value=${String(layoutOptions.grid_min_rows || 1)}
              @change=${(e: Event) => this._updateLayoutOption('grid_min_rows', parseInt((e.target as HTMLInputElement).value))}
            />
          </label>
          <label class="option">
            <span>Max Rows</span>
            <input
              type="number"
              min="1"
              max="12"
              .value=${String(layoutOptions.grid_max_rows || 8)}
              @change=${(e: Event) => this._updateLayoutOption('grid_max_rows', parseInt((e.target as HTMLInputElement).value))}
            />
          </label>
        </div>
      </div>

      <div class="section">
        <h3>Card Size</h3>
        <label class="option">
          <span>Card Size (for legacy layouts)</span>
          <input
            type="number"
            min="1"
            max="10"
            .value=${String(this._config.card_size || 3)}
            .configValue=${'card_size'}
            @change=${this._valueChanged}
          />
        </label>
      </div>
    `;
  }

  private _updateLayoutOption(key: keyof LayoutOptions, value: number): void {
    const layoutOptions = {
      ...this._config.layout_options,
      [key]: value,
    };

    fireEvent(this, 'config-changed', {
      config: { ...this._config, layout_options: layoutOptions },
    });
  }

  static get styles() {
    return css`
      .card-config {
        padding: 16px;
      }

      .tabs {
        display: flex;
        border-bottom: 1px solid var(--divider-color);
        margin-bottom: 16px;
        overflow-x: auto;
      }

      .tab {
        padding: 8px 16px;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        cursor: pointer;
        font-size: 14px;
        color: var(--secondary-text-color);
        white-space: nowrap;
      }

      .tab:hover {
        color: var(--primary-text-color);
      }

      .tab.active {
        color: var(--primary-color);
        border-bottom-color: var(--primary-color);
      }

      .section {
        margin-bottom: 24px;
      }

      h3 {
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 500;
      }

      h4 {
        margin: 16px 0 8px;
        font-size: 14px;
        font-weight: 500;
        color: var(--secondary-text-color);
      }

      .description {
        margin: 0 0 16px;
        color: var(--secondary-text-color);
        font-size: 14px;
      }

      .content-editor {
        width: 100%;
        min-height: 300px;
        padding: 12px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
        font-size: 13px;
        line-height: 1.5;
        resize: vertical;
        background: var(--card-background-color);
        color: var(--primary-text-color);
      }

      .content-editor:focus {
        outline: none;
        border-color: var(--primary-color);
      }

      .hint {
        margin-top: 8px;
        padding: 12px;
        background: var(--secondary-background-color);
        border-radius: 4px;
        font-size: 13px;
      }

      .hint code, .hint pre {
        background: var(--code-background-color, rgba(0, 0, 0, 0.1));
        padding: 2px 6px;
        border-radius: 3px;
        font-family: monospace;
        font-size: 12px;
      }

      .hint pre {
        display: block;
        margin: 8px 0 0;
        padding: 8px;
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-all;
      }

      .option {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
      }

      .option span {
        font-size: 14px;
      }

      .option input[type="number"] {
        width: 80px;
        padding: 8px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
      }

      .grid-2 {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }

      ha-form {
        display: block;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tailwindcss-template-card-editor': TailwindTemplateCardEditor;
  }
}
