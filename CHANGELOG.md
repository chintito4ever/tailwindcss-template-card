# Changelog

All notable changes to TailwindCSS Template Card will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.0] - 2024-01-25

### Added
- **Sections Dashboard Support**: Full support for Home Assistant's new Sections/Masonry layout
  - Configurable grid sizing via `layout_options`
  - Default 6×2 grid span with min 2×1 and max 12×8 constraints
  - Proper resize handle support
  
- **Custom Badge Component**: New `tailwindcss-template-badge` companion component
  - Reuses same template + Tailwind pipeline
  - Stricter HTML sanitization by default
  - Supports all standard actions (tap, hold, double-tap)
  - Visual editor included
  
- **Modern Card Editor**: Complete redesign using Home Assistant selectors
  - Tabbed interface: Content, Entity, Actions, Options, Layout
  - Uses native HA selectors (entity, template, ui-action, etc.)
  - Full YAML compatibility maintained
  
- **WebSocket Template Streaming**: Efficient template updates
  - Subscribes to `render_template` for real-time updates
  - Automatic fallback to polling for older HA versions
  - Intelligent dependency tracking
  
- **Standard HA Actions**: Proper action handling via custom-card-helpers
  - `tap_action`, `hold_action`, `double_tap_action` support
  - Element-level actions via `data-ha-action` attributes
  - Compatible with all HA action types
  
- **Camera WebRTC Detection**: Smart streaming capability detection
  - Automatic WebRTC/HLS/MJPEG capability detection
  - Prefers WebRTC when available
  - Configurable via `camera` options
  - 5-minute capability caching
  
- **Security Improvements**: Safe-by-default HTML rendering
  - DOMPurify sanitization enabled by default
  - Opt-in `trusted` mode for full HTML access
  - Stricter defaults for badge component

### Changed
- **Complete TypeScript Rewrite**: Migrated from JavaScript to TypeScript
  - Full type safety with strict mode
  - LitElement-based components
  - Better IDE support and autocompletion
  
- **Modern Build System**: Vite-based build pipeline
  - Separate builds for card and badge
  - Source maps included
  - Tree-shaking support
  
- **Improved Performance**
  - Removed `always_update` behavior by default
  - Debounced template updates (configurable)
  - Efficient DOM diffing via Lit

### Deprecated
- `always_update: true` - Use explicit `entities` list instead

### Fixed
- Memory leaks from unsubscribed WebSocket connections
- Race conditions during rapid configuration changes
- Proper cleanup on element disconnect

### Security
- All HTML sanitized by default via DOMPurify
- Blocked script execution, inline handlers, and unsafe attributes
- Explicit opt-in required for trusted/unsafe mode

## [3.1.0] - Previous Release

See previous release notes for older changes.

---

## Migration Guide

### From 3.1.x to 3.2.0

**Breaking Changes:** None! All existing configurations should work.

**Recommended Updates:**

1. **Remove `always_update: true`** if you're using it:
   ```yaml
   # Before
   always_update: true
   
   # After - specify entities explicitly
   entities:
     - sensor.temperature
     - sensor.humidity
   ```

2. **Add layout options** for Sections dashboard:
   ```yaml
   layout_options:
     grid_columns: 6
     grid_rows: 2
   ```

3. **Use standard actions** instead of custom handlers:
   ```yaml
   tap_action:
     action: toggle
   hold_action:
     action: more-info
   ```

**New Features to Try:**

- Badge component for status indicators
- Camera WebRTC streaming
- Modern visual editor
