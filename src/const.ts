/**
 * Constants for TailwindCSS Template Card
 */

import type { TailwindTemplateCardConfig, LayoutOptions, PluginsConfig, CodeEditorOptions } from './types';

/**
 * Card version
 */
export const CARD_VERSION = '3.2.0';

/**
 * Default DaisyUI CDN URL
 */
export const DAISYUI_CDN_URL = 'https://cdn.jsdelivr.net/npm/daisyui@latest/dist/full.css';

/**
 * Sections dashboard sizing metadata
 * This provides default size hints and constraints for the 12-column grid
 */
export const SECTIONS_SIZING: LayoutOptions = {
  // Default size (columns x rows)
  grid_columns: 6,
  grid_rows: 2,
  // Minimum constraints
  grid_min_columns: 2,
  grid_min_rows: 1,
  // Maximum constraints (12 is full width in Precise mode)
  grid_max_columns: 12,
  grid_max_rows: 8,
};

/**
 * Default plugins configuration
 */
export const DEFAULT_PLUGINS: PluginsConfig = {
  daisyui: {
    enabled: true,
    url: DAISYUI_CDN_URL,
    theme: 'dark',
    overrideCardBackground: false,
  },
  tailwindElements: {
    enabled: false,
  },
};

/**
 * Default card configuration
 */
export const DEFAULT_CONFIG: Partial<TailwindTemplateCardConfig> = {
  type: 'custom:tailwindcss-template-card',
  content: '',
  ignore_line_breaks: true,
  always_update: false,
  parse_jinja: true,
  trusted: false,
  entities: [],
  bindings: [],
  actions: [],
  debounceChangePeriod: 100,
  card_size: 3,
  code_editor: 'Ace' as any,
  plugins: DEFAULT_PLUGINS,
  layout_options: SECTIONS_SIZING,
  camera: {
    prefer_webrtc: true,
    fallback_hls: true,
    show_controls: true,
  },
  debug: false,
  auto_detect_entities: true,
  auto_bind_entity_actions: true,
  entity_actions: {},
  tap_action: { action: 'none' },
  hold_action: { action: 'none' },
  double_tap_action: { action: 'none' },
};

/**
 * Initial config for new cards (with example content)
 */
export const INITIAL_CONFIG: TailwindTemplateCardConfig = {
  ...DEFAULT_CONFIG,
  type: 'custom:tailwindcss-template-card',
  content: `<div class="flex flex-row gap-2 justify-center p-4">
  {% for color in ["primary", "secondary", "accent", "info", "warning", "error"] %}
    <div class="w-12 h-12 bg-{{color}} rounded-lg cursor-pointer hover:translate-y-2 transition-all animate-bounce hover:animate-spin"></div>
  {% endfor %}
</div>`,
} as TailwindTemplateCardConfig;

/**
 * DaisyUI theme definitions
 */
export const DAISYUI_THEMES = [
  { theme: 'light', scheme: 'light' },
  { theme: 'dark', scheme: 'dark' },
  { theme: 'cupcake', scheme: 'light' },
  { theme: 'bumblebee', scheme: 'light' },
  { theme: 'emerald', scheme: 'light' },
  { theme: 'corporate', scheme: 'light' },
  { theme: 'synthwave', scheme: 'dark' },
  { theme: 'retro', scheme: 'light' },
  { theme: 'cyberpunk', scheme: 'light' },
  { theme: 'valentine', scheme: 'light' },
  { theme: 'halloween', scheme: 'dark' },
  { theme: 'garden', scheme: 'light' },
  { theme: 'forest', scheme: 'dark' },
  { theme: 'aqua', scheme: 'dark' },
  { theme: 'lofi', scheme: 'light' },
  { theme: 'pastel', scheme: 'light' },
  { theme: 'fantasy', scheme: 'light' },
  { theme: 'wireframe', scheme: 'light' },
  { theme: 'black', scheme: 'dark' },
  { theme: 'luxury', scheme: 'dark' },
  { theme: 'dracula', scheme: 'dark' },
  { theme: 'cmyk', scheme: 'light' },
  { theme: 'autumn', scheme: 'light' },
  { theme: 'business', scheme: 'dark' },
  { theme: 'acid', scheme: 'light' },
  { theme: 'lemonade', scheme: 'light' },
  { theme: 'night', scheme: 'dark' },
  { theme: 'coffee', scheme: 'dark' },
  { theme: 'winter', scheme: 'light' },
  { theme: 'dim', scheme: 'dark' },
  { theme: 'nord', scheme: 'light' },
  { theme: 'sunset', scheme: 'dark' },
];

/**
 * Allowed HTML tags for sanitization
 */
export const ALLOWED_TAGS = [
  'div', 'span', 'p', 'a', 'img', 'br', 'hr', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th',
  'thead', 'tbody', 'tfoot', 'button', 'input', 'select', 'option',
  'label', 'form', 'video', 'audio', 'source', 'iframe', 'svg',
  'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'text',
  'g', 'defs', 'use', 'symbol', 'ha-icon', 'ha-state-icon', 'ha-svg-icon',
  'ha-card', 'ha-icon-button',
];

/**
 * Allowed HTML attributes for sanitization
 */
export const ALLOWED_ATTRS = [
  'class', 'style', 'id', 'src', 'href', 'alt', 'title', 'width',
  'height', 'type', 'value', 'name', 'placeholder', 'disabled',
  'readonly', 'checked', 'selected', 'for', 'target', 'rel',
  'data-ha-action', 'data-entity', 'data-action-config',
  'd', 'viewBox', 'fill', 'stroke', 'stroke-width', 'cx', 'cy',
  'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform',
  'icon', 'state', 'entity',
];

/**
 * Forbidden HTML tags
 */
export const FORBIDDEN_TAGS = ['script', 'style'];

/**
 * Forbidden HTML attributes
 */
export const FORBIDDEN_ATTRS = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'];
