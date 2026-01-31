import { describe, it, expect } from 'vitest';
import { extractEntitiesFromContent } from '../src/utils/entity-extractor';

describe('extractEntitiesFromContent', () => {
  it('extracts entities from common Jinja helpers', () => {
    const content = `
      {{ states('sensor.droplet_flow_rate') }}
      {{ states("sensor.navien_boiler_2fl_water_flow") }}
      {% if is_state('light.kitchen', 'on') %}on{% endif %}
      {{ state_attr('sensor.temperature', 'unit_of_measurement') }}
      {{ expand('group.lights') }}
      {{ device_attr('device_tracker.phone', 'battery') }}
      {{ states.sensor.outdoor_temperature.state }}
    `;

    expect(extractEntitiesFromContent(content)).toEqual([
      'device_tracker.phone',
      'group.lights',
      'light.kitchen',
      'sensor.droplet_flow_rate',
      'sensor.navien_boiler_2fl_water_flow',
      'sensor.outdoor_temperature',
      'sensor.temperature',
    ]);
  });

  it('extracts entities from HTML attributes', () => {
    const content = `
      <div data-entity="switch.moen_water_shutoff_valve"></div>
      <span entity='binary_sensor.water_monitor_daily_analysis_status'></span>
      <ha-entity-picker value="sensor.navien_combi_boiler_1fl_water_flow"></ha-entity-picker>
    `;

    expect(extractEntitiesFromContent(content)).toEqual([
      'binary_sensor.water_monitor_daily_analysis_status',
      'sensor.navien_combi_boiler_1fl_water_flow',
      'switch.moen_water_shutoff_valve',
    ]);
  });

  it('deduplicates and sorts entities', () => {
    const content = `
      {{ states('sensor.temperature') }}
      <div data-entity="sensor.temperature"></div>
      {{ is_state('sensor.temperature', 'on') }}
    `;

    expect(extractEntitiesFromContent(content)).toEqual(['sensor.temperature']);
  });
});

