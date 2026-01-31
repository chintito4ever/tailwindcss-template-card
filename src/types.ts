/**
 * Type definitions for TailwindCSS Template Card
 */

import { ActionConfig, LovelaceCard, LovelaceCardConfig } from 'custom-card-helpers';

/**
 * Binding configuration for dynamic content updates
 */
export interface Binding {
  /** CSS selector to find elements */
  selector: string;
  /** JavaScript expression to evaluate */
  bind: string;
  /** Type of binding: text, html, class, value, checked, or attribute name */
  type: string;
}

/**
 * Legacy action configuration
 */
export interface Action {
  /** CSS selector to find elements */
  selector: string;
  /** JavaScript code to execute */
  call: string;
  /** Event type: click, dblclick, change, input */
  type: string;
}

/**
 * Plugin options for DaisyUI
 */
export interface DaisyUIOptions {
  enabled: boolean;
  url?: string;
  theme?: string;
  overrideCardBackground?: boolean;
}

/**
 * Plugin options for Tailwind Elements
 */
export interface TailwindElementsOptions {
  enabled: boolean;
}

/**
 * Plugins configuration
 */
export interface PluginsConfig {
  daisyui: DaisyUIOptions;
  tailwindElements: TailwindElementsOptions;
}

/**
 * Code editor options enum
 */
export enum CodeEditorOptions {
  ACE = 'Ace',
  TEXTAREA = 'Textarea',
  CODEMIRROR = 'CodeMirror',
}

/**
 * Layout options for Sections dashboard
 */
export interface LayoutOptions {
  /** Grid columns to span (1-12 in Precise mode) */
  grid_columns?: number;
  /** Grid rows to span */
  grid_rows?: number;
  /** Minimum columns */
  grid_min_columns?: number;
  /** Maximum columns */
  grid_max_columns?: number;
  /** Minimum rows */
  grid_min_rows?: number;
  /** Maximum rows */
  grid_max_rows?: number;
}

/**
 * Camera streaming options
 */
export interface CameraOptions {
  /** Prefer WebRTC when available */
  prefer_webrtc?: boolean;
  /** Fallback to HLS if WebRTC fails */
  fallback_hls?: boolean;
  /** Show controls */
  show_controls?: boolean;
}

/**
 * Main card configuration
 */
export interface TailwindTemplateCardConfig extends LovelaceCardConfig {
  /** Card type (required by HA) */
  type: string;
  
  /** Primary entity for templating */
  entity?: string;
  
  /** Additional entities to watch */
  entities?: string[];
  
  /** HTML/Jinja2 template content */
  content: string;
  
  /** Ignore line breaks in content */
  ignore_line_breaks?: boolean;
  
  /** Always update on any hass change */
  always_update?: boolean;
  
  /** Parse Jinja2 templates */
  parse_jinja?: boolean;
  
  /** Trust HTML content (disable sanitization) */
  trusted?: boolean;
  
  /** Dynamic bindings */
  bindings?: Binding[];
  
  /** Legacy actions */
  actions?: Action[];
  
  /** Debounce period for changes (ms) */
  debounceChangePeriod?: number;
  
  /** Card size for layout calculations */
  card_size?: number;
  
  /** Code editor preference */
  code_editor?: CodeEditorOptions;
  
  /** Plugin configurations */
  plugins?: PluginsConfig;
  
  /** Layout options for Sections dashboard */
  layout_options?: LayoutOptions;
  
  /** Camera options */
  camera?: CameraOptions;

  /** Auto-detect entities from content */
  auto_detect_entities?: boolean;

  /** Auto-bind entity action mappings to matching elements */
  auto_bind_entity_actions?: boolean;

  /** Per-entity action mappings */
  entity_actions?: Record<string, {
    tap_action?: ActionConfig;
    hold_action?: ActionConfig;
    double_tap_action?: ActionConfig;
    selector?: string;
  }>;
  
  // Standard HA actions
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

/**
 * Card editor configuration
 */
export interface TailwindTemplateCardEditorConfig {
  entity?: string;
  entities?: string[];
  content?: string;
  parse_jinja?: boolean;
  trusted?: boolean;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

/**
 * Template subscription callback
 */
export type TemplateCallback = (result: string) => void;

/**
 * Camera capabilities response
 */
export interface CameraCapabilitiesResponse {
  frontend_stream_types: ('hls' | 'web_rtc')[];
}

/**
 * Extend the LovelaceCard interface
 */
export interface TailwindTemplateCardElement extends LovelaceCard {
  hass?: any;
  setConfig(config: TailwindTemplateCardConfig): void;
  getLayoutOptions(): LayoutOptions;
}

/**
 * Badge configuration (for the companion badge)
 */
export interface TailwindTemplateBadgeConfig {
  /** Badge type */
  type: string;
  
  /** Primary entity */
  entity?: string;
  
  /** Additional entities to watch */
  entities?: string[];
  
  /** Template content */
  content: string;
  
  /** Parse Jinja2 templates */
  parse_jinja?: boolean;
  
  /** Trust HTML content (disable sanitization) */
  trusted?: boolean;
  
  /** Debounce period for changes (ms) */
  debounceChangePeriod?: number;
  
  // Standard actions
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

/**
 * Window extension for Home Assistant
 */
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
