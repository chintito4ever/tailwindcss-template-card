# TailwindCSS Template Card

[![HACS Default](https://img.shields.io/badge/HACS-Default-orange.svg)](https://github.com/hacs/default)
[![GitHub Release](https://img.shields.io/github/release/chintito4ever/tailwindcss-template-card.svg)](https://github.com/chintito4ever/tailwindcss-template-card/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful Home Assistant custom card that renders Jinja2 templates with Tailwind CSS styling. Create beautiful, dynamic cards and badges with full control over layout and design using utility-first CSS.

## Features

- 🎨 **Tailwind CSS** - Full Tailwind CSS support via Twind (runtime compiler)
- 📝 **Jinja2 Templates** - Use Home Assistant's template engine for dynamic content
- 📊 **Sections Dashboard** - Full support for HA's new Sections/Masonry layout with resizing
- 🎬 **Actions** - Standard tap, hold, and double-tap actions
- 📸 **Camera Support** - Smart WebRTC/HLS/MJPEG detection and streaming
- 🔒 **Security** - Safe HTML rendering with DOMPurify sanitization
- 🏷️ **Badge Support** - Companion badge component for status indicators
- ⚡ **Performance** - WebSocket template streaming for efficient updates
- 🎯 **Visual Editor** - Modern editor UI using Home Assistant selectors

## Installation

### HACS (Recommended)

1. Open HACS in Home Assistant
2. Go to **Frontend** section
3. Click **+ Explore & Download Repositories**
4. Search for **TailwindCSS Template Card**
5. Click **Download**
6. Restart Home Assistant

### Manual Installation

1. Download `tailwindcss-template-card.js` from the [latest release](https://github.com/chintito4ever/tailwindcss-template-card/releases)
2. Copy to `/config/www/tailwindcss-template-card/tailwindcss-template-card.js`
3. Add the resource in Home Assistant:
   - Go to **Settings** → **Dashboards** → **Resources**
   - Add `/local/tailwindcss-template-card/tailwindcss-template-card.js` as JavaScript Module

For the badge component, also download and add `tailwindcss-template-badge.js`.

## Quick Start

### Basic Card

```yaml
type: custom:tailwindcss-template-card
content: |
  <div class="p-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl">
    <h2 class="text-2xl font-bold text-white">{{ states('sensor.temperature') }}°C</h2>
    <p class="text-white/80">Living Room Temperature</p>
  </div>
```

### Basic Badge

```yaml
type: custom:tailwindcss-template-badge
entity: sensor.temperature
content: |
  <span class="flex items-center gap-1">
    <ha-icon icon="mdi:thermometer" class="text-red-500"></ha-icon>
    <span class="font-medium">{{ states('sensor.temperature') }}°</span>
  </span>
```

## Configuration

### Card Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | **Required** | Must be `custom:tailwindcss-template-card` |
| `content` | string | **Required** | HTML/Jinja2 template content |
| `entity` | string | - | Primary entity for actions |
| `entities` | string[] | - | Additional entities to watch for updates |
| `parse_jinja` | boolean | `true` | Process Jinja2 templates |
| `ignore_line_breaks` | boolean | `false` | Remove line breaks from template |
| `trusted` | boolean | `false` | Allow unsafe HTML (⚠️ use with caution) |
| `always_update` | boolean | `false` | Re-render on every hass update (legacy) |
| `debounceChangePeriod` | number | `100` | Debounce delay in milliseconds |
| `auto_detect_entities` | boolean | `true` | Auto-detect entity IDs in the template |
| `auto_bind_entity_actions` | boolean | `true` | Auto-bind entity actions to matching elements |
| `entity_actions` | object | `{}` | Per-entity action mappings (optional selector per entity) |
| `default_entity` | string | - | Default entity for action resolution when no data-entity is present |
| `tap_action` | action | `more-info` | Action on tap |
| `hold_action` | action | - | Action on hold |
| `double_tap_action` | action | - | Action on double-tap |
| `camera` | object | - | Camera stream options |
| `layout_options` | object | - | Sections dashboard layout |

### Badge Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | **Required** | Must be `custom:tailwindcss-template-badge` |
| `content` | string | **Required** | HTML/Jinja2 template content |
| `entity` | string | - | Primary entity |
| `entities` | string[] | - | Entities to watch |
| `parse_jinja` | boolean | `true` | Process Jinja2 templates |
| `trusted` | boolean | `false` | Allow unsafe HTML |
| `tap_action` | action | `more-info` | Action on tap |
| `hold_action` | action | - | Action on hold |
| `double_tap_action` | action | - | Action on double-tap |

### Layout Options (Sections Dashboard)

```yaml
layout_options:
  grid_columns: 6        # Columns to span (default: 6)
  grid_rows: 2           # Rows to span (default: 2)
  grid_min_columns: 2    # Minimum columns (default: 2)
  grid_max_columns: 12   # Maximum columns (default: 12)
  grid_min_rows: 1       # Minimum rows (default: 1)
  grid_max_rows: 8       # Maximum rows (default: 8)
```

### Camera Options

```yaml
camera:
  prefer_webrtc: true    # Prefer WebRTC over HLS/MJPEG
  fallback_hls: true     # Fall back to HLS if WebRTC unavailable
  show_controls: true    # Show video controls
```

### Actions

Standard Home Assistant actions are supported:

```yaml
tap_action:
  action: toggle
hold_action:
  action: call-service
  service: light.turn_on
  data:
    brightness_pct: 100
double_tap_action:
  action: navigate
  navigation_path: /lovelace/lights
```

You can also trigger actions from elements within your template using data attributes:

```yaml
content: |
  <div class="flex gap-2">
    <button 
      data-ha-action="tap" 
      data-entity="light.living_room"
      class="px-4 py-2 bg-blue-500 text-white rounded"
    >
      Turn On
    </button>
    <button 
      data-ha-action="hold" 
      data-entity="light.living_room"
      class="px-4 py-2 bg-red-500 text-white rounded"
    >
      Turn Off (hold)
    </button>
  </div>
```

### Entity Detection & Entity Actions

The card can auto-detect entities referenced in your template (Jinja helpers and HTML attributes)
and lets you map actions to those entities without editing the HTML. Add `data-entity="entity_id"`
to mark the clickable element, and the card will bind the action automatically when
`auto_bind_entity_actions` is enabled. Explicit `data-ha-action` always takes precedence.

```yaml
auto_detect_entities: true
auto_bind_entity_actions: true
default_entity: sensor.medication_box_battery
entity_actions:
  switch.moen_water_shutoff_valve:
    tap_action:
      action: toggle
  sensor.droplet_flow_rate:
    tap_action:
      action: more-info
  sensor.moen_water_shutoff_water_temperature:
    selector: ".water-temp"
    tap_action:
      action: more-info
content: |
  <div class="flex items-center gap-2">
    <span data-entity="sensor.droplet_flow_rate">Flow</span>
    <button data-entity="switch.moen_water_shutoff_valve">Valve</button>
    <span class="water-temp">Temp</span>
  </div>
```

**Detection rules**
- Jinja helpers: `states()`, `is_state()`, `state_attr()`, `expand()`, `device_attr()` (and similar).
- HTML attributes: `data-entity="..."`, `entity="..."`, `ha-entity-picker` values.
- Optional selectors: add `selector` under `entity_actions` to bind actions when you can't add `data-entity`.
- If no `data-entity` is found, `default_entity` is used. If not set and there is exactly one `entity_actions` entry, that entity is used as a fallback.
- Entity IDs match `/[a-z0-9_]+\.[a-z0-9_]+/i` and are de-duplicated and sorted.

## Examples

### Weather Card

```yaml
type: custom:tailwindcss-template-card
entities:
  - weather.home
content: |
  <div class="p-6 bg-gradient-to-br from-sky-400 to-blue-600 rounded-2xl text-white">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-lg opacity-80">{{ state_attr('weather.home', 'friendly_name') }}</p>
        <p class="text-5xl font-light">{{ state_attr('weather.home', 'temperature') }}°</p>
      </div>
      <ha-icon icon="mdi:weather-{{ states('weather.home') }}" class="text-6xl opacity-90"></ha-icon>
    </div>
    <div class="mt-4 flex gap-4 text-sm opacity-80">
      <span><ha-icon icon="mdi:water-percent"></ha-icon> {{ state_attr('weather.home', 'humidity') }}%</span>
      <span><ha-icon icon="mdi:weather-windy"></ha-icon> {{ state_attr('weather.home', 'wind_speed') }} km/h</span>
    </div>
  </div>
```

### Thermostat Control

```yaml
type: custom:tailwindcss-template-card
entity: climate.living_room
content: |
  <div class="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-800 dark:text-white">Living Room</h3>
      <span class="px-3 py-1 text-sm rounded-full 
        {% if is_state('climate.living_room', 'heat') %}
          bg-orange-100 text-orange-600
        {% elif is_state('climate.living_room', 'cool') %}
          bg-blue-100 text-blue-600
        {% else %}
          bg-gray-100 text-gray-600
        {% endif %}">
        {{ states('climate.living_room') | title }}
      </span>
    </div>
    <div class="text-center">
      <p class="text-5xl font-bold text-gray-900 dark:text-white">
        {{ state_attr('climate.living_room', 'current_temperature') }}°
      </p>
      <p class="text-gray-500 mt-2">
        Target: {{ state_attr('climate.living_room', 'temperature') }}°
      </p>
    </div>
  </div>
tap_action:
  action: more-info
```

### Camera with WebRTC

```yaml
type: custom:tailwindcss-template-card
entity: camera.front_door
camera:
  prefer_webrtc: true
  show_controls: true
content: |
  <div class="relative overflow-hidden rounded-xl">
    <div id="camera-stream" class="w-full aspect-video bg-black"></div>
    <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
      <p class="text-white font-medium">Front Door</p>
      <p class="text-white/70 text-sm">{{ states('camera.front_door') }}</p>
    </div>
  </div>
layout_options:
  grid_columns: 6
  grid_rows: 4
```

### Status Badges

```yaml
type: custom:tailwindcss-template-badge
entity: binary_sensor.front_door
content: |
  <span class="flex items-center gap-2">
    <span class="w-2 h-2 rounded-full 
      {% if is_state('binary_sensor.front_door', 'on') %}
        bg-red-500 animate-pulse
      {% else %}
        bg-green-500
      {% endif %}">
    </span>
    <span>Front Door</span>
    <span class="text-gray-500">
      {{ 'Open' if is_state('binary_sensor.front_door', 'on') else 'Closed' }}
    </span>
  </span>
```

### Multi-Room Light Control

```yaml
type: custom:tailwindcss-template-card
entities:
  - light.living_room
  - light.bedroom
  - light.kitchen
content: |
  <div class="grid grid-cols-3 gap-4 p-4">
    {% for light in ['light.living_room', 'light.bedroom', 'light.kitchen'] %}
    <div 
      data-ha-action="tap" 
      data-entity="{{ light }}"
      class="p-4 rounded-xl cursor-pointer transition-all
        {% if is_state(light, 'on') %}
          bg-yellow-100 hover:bg-yellow-200
        {% else %}
          bg-gray-100 hover:bg-gray-200
        {% endif %}">
      <ha-icon 
        icon="mdi:lightbulb{% if is_state(light, 'off') %}-outline{% endif %}"
        class="text-2xl {% if is_state(light, 'on') %}text-yellow-500{% else %}text-gray-400{% endif %}">
      </ha-icon>
      <p class="mt-2 text-sm font-medium truncate">
        {{ state_attr(light, 'friendly_name') | replace(' Light', '') }}
      </p>
    </div>
    {% endfor %}
  </div>
tap_action:
  action: toggle
```

## Security

By default, all HTML content is sanitized using DOMPurify to prevent XSS attacks. The following elements and attributes are allowed:

**Safe Mode (default):**
- Tags: `div`, `span`, `p`, `h1-h6`, `ul`, `ol`, `li`, `table`, `tr`, `td`, `th`, `thead`, `tbody`, `a`, `img`, `br`, `hr`, `b`, `i`, `strong`, `em`, `code`, `pre`, `ha-icon`, `ha-state-icon`, `ha-svg-icon`, etc.
- Attributes: `class`, `style`, `id`, `src`, `alt`, `href`, `target`, `data-*`, `aria-*`

**Trusted Mode (`trusted: true`):**
- All HTML is rendered without sanitization
- ⚠️ Only use with content you fully control and trust

## Performance Tips

1. **Use explicit `entities`** - Specify which entities to watch instead of relying on template extraction
2. **Avoid `always_update: true`** - This legacy option re-renders on every Home Assistant update
3. **Use `debounceChangePeriod`** - Adjust debounce timing for your use case (default: 100ms)
4. **Keep templates simple** - Complex Jinja2 logic can slow down rendering

## Troubleshooting

### Card not displaying
- Check browser console for errors
- Verify the resource is loaded correctly
- Ensure `type` is exactly `custom:tailwindcss-template-card`

### Styles not applying
- Tailwind classes are processed at runtime - some dynamic classes may not work
- Use complete class names (e.g., `bg-red-500`) instead of dynamic interpolation
- Check for typos in class names

### Template errors
- Use Home Assistant's Developer Tools → Template to test Jinja2 syntax
- Ensure entities exist and are available
- Check for missing quotes around strings

### Actions not working
- Verify entity exists and is controllable
- Check action configuration syntax
- Ensure `data-ha-action` and `data-entity` attributes are correct

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` and `npm run build`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

- Built with [Lit](https://lit.dev/)
- Styled with [Twind](https://twind.style/) (Tailwind CSS runtime)
- Sanitized with [DOMPurify](https://github.com/cure53/DOMPurify)
- Inspired by the Home Assistant community
