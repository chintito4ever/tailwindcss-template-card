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
import { extractEntitiesFromContent } from './utils/entity-extractor';

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

const ENTITY_ACTIONS_SCHEMA = [
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

const ENTITY_ACTION_OPTIONS_SCHEMA = [
  {
    name: 'auto_detect_entities',
    selector: { boolean: {} },
  },
  {
    name: 'auto_bind_entity_actions',
    selector: { boolean: {} },
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
  @state() private _detectedEntities: string[] = [];
  @state() private _lastDetectedContent?: string;
  @state() private _lastAutoDetectSetting?: boolean;
  @state() private _entityFilter = '';

  public setConfig(config: TailwindTemplateCardConfig): void {
    this._config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this._updateDetectedEntities();
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

  private _updateEntityActions(entityId: string, value: Record<string, unknown>): void {
    const entityActions = {
      ...(this._config.entity_actions || {}),
      [entityId]: {
        ...(this._config.entity_actions?.[entityId] || {}),
        ...value,
      },
    };

    fireEvent(this, 'config-changed', {
      config: { ...this._config, entity_actions: entityActions },
    });
  }

  private _applyQuickAction(entityId: string, action: Record<string, unknown>): void {
    this._updateEntityActions(entityId, { tap_action: action });
  }

  private _applyDefaultActionToAll(): void {
    const entityActions = { ...(this._config.entity_actions || {}) };
    this._detectedEntities.forEach((entityId) => {
      entityActions[entityId] = {
        ...(entityActions[entityId] || {}),
        tap_action: { action: 'more-info' },
      };
    });

    fireEvent(this, 'config-changed', {
      config: { ...this._config, entity_actions: entityActions },
    });
  }

  private _clearActionsForAll(): void {
    fireEvent(this, 'config-changed', {
      config: { ...this._config, entity_actions: {} },
    });
  }

  private _removeActionsForMissingEntities(): void {
    const detected = new Set(this._detectedEntities);
    const entityActions = { ...(this._config.entity_actions || {}) };
    Object.keys(entityActions).forEach((entityId) => {
      if (!detected.has(entityId)) {
        delete entityActions[entityId];
      }
    });

    fireEvent(this, 'config-changed', {
      config: { ...this._config, entity_actions: entityActions },
    });
  }

  protected updated(changedProperties: Map<string, unknown>): void {
    super.updated(changedProperties);
    if (changedProperties.has('_config')) {
      this._updateDetectedEntities();
    }
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
            class="tab ${this._activeTab === 'entity-actions' ? 'active' : ''}"
            @click=${() => this._setTab('entity-actions')}
          >
            Entities & Actions
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
          ${this._activeTab === 'entity-actions' ? this._renderEntityActionsTab() : nothing}
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

  private _renderEntityActionsTab() {
    const filter = this._entityFilter.toLowerCase();
    const filteredEntities = this._detectedEntities.filter((entityId) =>
      entityId.toLowerCase().includes(filter)
    );

    const groupedEntities = filteredEntities.reduce<Record<string, string[]>>((acc, entityId) => {
      const [domain] = entityId.split('.');
      acc[domain] = acc[domain] || [];
      acc[domain].push(entityId);
      return acc;
    }, {});

    const toggleDomains = new Set([
      'switch',
      'light',
      'input_boolean',
      'fan',
      'cover',
      'lock',
      'script',
      'automation',
    ]);

    return html`
      <div class="section">
        <h3>Entity Detection</h3>
        <ha-form
          .hass=${this.hass}
          .data=${{
            auto_detect_entities: this._config.auto_detect_entities ?? true,
            auto_bind_entity_actions: this._config.auto_bind_entity_actions ?? true,
          }}
          .schema=${ENTITY_ACTION_OPTIONS_SCHEMA}
          .computeLabel=${(schema: any) => {
            switch (schema.name) {
              case 'auto_detect_entities': return 'Auto-detect entities from template';
              case 'auto_bind_entity_actions': return 'Auto-bind entity actions';
              default: return schema.name;
            }
          }}
          .computeHelper=${(schema: any) => {
            switch (schema.name) {
              case 'auto_bind_entity_actions':
                return 'Elements with data-entity will receive actions automatically.';
              default:
                return '';
            }
          }}
          @value-changed=${this._schemaValueChanged}
        ></ha-form>
      </div>

      <div class="section">
        <h3>Detected Entities</h3>
        <p class="description">
          Detected entities from your template. Explicit <code>data-ha-action</code> overrides auto binding.
        </p>
        <div class="entity-actions-toolbar">
          <input
            class="entity-filter"
            type="search"
            placeholder="Filter entities..."
            .value=${this._entityFilter}
            @input=${(ev: Event) => { this._entityFilter = (ev.target as HTMLInputElement).value; }}
          />
          <div class="entity-actions-buttons">
            <button class="button" @click=${this._applyDefaultActionToAll}>
              Apply more-info to all
            </button>
            <button class="button" @click=${this._clearActionsForAll}>
              Clear actions
            </button>
            <button class="button" @click=${this._removeActionsForMissingEntities}>
              Remove missing entities
            </button>
          </div>
        </div>

        ${filteredEntities.length === 0
          ? html`<p class="description">No entities detected.</p>`
          : html`
            <div class="entity-groups">
              ${Object.entries(groupedEntities).map(([domain, entities]) => html`
                <details class="entity-group" open>
                  <summary>${domain} (${entities.length})</summary>
                  ${entities.map((entityId) => {
                    const stateObj = this.hass.states[entityId];
                    const friendlyName = stateObj?.attributes?.friendly_name;
                    const actionConfig = this._config.entity_actions?.[entityId] || {};
                    const canToggle = toggleDomains.has(domain);
                    return html`
                      <div class="entity-row">
                        <div class="entity-meta">
                          <div class="entity-id">${entityId}</div>
                          ${friendlyName ? html`<div class="entity-name">${friendlyName}</div>` : nothing}
                        </div>
                        <div class="entity-actions">
                          <label class="selector-input">
                            <span>Target selector (optional)</span>
                            <input
                              type="text"
                              placeholder="e.g. .water-temp"
                              .value=${actionConfig.selector || ''}
                              @change=${(ev: Event) => this._updateEntityActions(entityId, { selector: (ev.target as HTMLInputElement).value })}
                            />
                          </label>
                          <div class="quick-actions">
                            <span class="quick-label">Quick actions:</span>
                            <button class="chip" @click=${() => this._applyQuickAction(entityId, { action: 'more-info' })}>
                              More info
                            </button>
                            ${canToggle ? html`
                              <button class="chip" @click=${() => this._applyQuickAction(entityId, { action: 'toggle' })}>
                                Toggle
                              </button>
                            ` : nothing}
                            <button class="chip" @click=${() => this._applyQuickAction(entityId, { action: 'navigate', navigation_path: '' })}>
                              Navigate
                            </button>
                            <button class="chip" @click=${() => this._applyQuickAction(entityId, { action: 'call-service', service: '' })}>
                              Call service
                            </button>
                          </div>
                          <ha-form
                            class="entity-action-form"
                            .hass=${this.hass}
                            .data=${actionConfig}
                            .schema=${ENTITY_ACTIONS_SCHEMA}
                            .computeLabel=${(schema: any) => {
                              switch (schema.name) {
                                case 'tap_action': return 'Tap Action';
                                case 'hold_action': return 'Hold Action';
                                case 'double_tap_action': return 'Double Tap Action';
                                default: return schema.name;
                              }
                            }}
                            @value-changed=${(ev: CustomEvent) => this._updateEntityActions(entityId, ev.detail.value)}
                          ></ha-form>
                        </div>
                      </div>
                    `;
                  })}
                </details>
              `)}
            </div>
          `}
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

      .entity-actions-toolbar {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 16px;
      }

      .entity-actions-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .entity-filter {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
      }

      .entity-groups {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .entity-group {
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        padding: 12px;
        background: var(--card-background-color);
      }

      .entity-group summary {
        cursor: pointer;
        font-weight: 500;
        margin-bottom: 8px;
      }

      .entity-row {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px 0;
        border-top: 1px solid var(--divider-color);
      }

      .entity-row:first-of-type {
        border-top: none;
      }

      .entity-meta {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .entity-id {
        font-weight: 500;
      }

      .entity-name {
        color: var(--secondary-text-color);
        font-size: 13px;
      }

      .quick-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }

      .quick-label {
        font-size: 12px;
        color: var(--secondary-text-color);
      }

      .chip {
        border: 1px solid var(--divider-color);
        border-radius: 999px;
        padding: 4px 10px;
        background: var(--secondary-background-color);
        cursor: pointer;
        font-size: 12px;
      }

      .button {
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        padding: 6px 12px;
        background: var(--secondary-background-color);
        cursor: pointer;
        font-size: 13px;
      }

      .entity-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .selector-input {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 12px;
        color: var(--secondary-text-color);
      }

      .selector-input input {
        padding: 8px 10px;
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
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
