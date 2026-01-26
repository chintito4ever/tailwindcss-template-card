/**
 * Template Engine Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TemplateEngine } from '../src/services/template-engine';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;
  let mockHass: any;

  beforeEach(() => {
    mockHass = {
      states: {
        'sensor.temperature': {
          entity_id: 'sensor.temperature',
          state: '22',
          attributes: { unit_of_measurement: '°C' },
        },
        'light.living_room': {
          entity_id: 'light.living_room',
          state: 'on',
          attributes: { brightness: 255 },
        },
      },
      connection: {
        subscribeMessage: vi.fn().mockImplementation((callback, options) => {
          // Simulate immediate response
          setTimeout(() => {
            callback({ result: 'Rendered template result' });
          }, 0);
          return Promise.resolve(() => {});
        }),
      },
      callWS: vi.fn().mockResolvedValue({ result: 'Rendered template' }),
    };

    engine = new TemplateEngine(mockHass);
  });

  afterEach(() => {
    engine.cleanup();
  });

  describe('extractEntities', () => {
    it('should extract entity IDs from states() calls', () => {
      const template = "{{ states('sensor.temperature') }}";
      const entities = engine.extractEntities(template);
      expect(entities).toContain('sensor.temperature');
    });

    it('should extract entity IDs from state_attr() calls', () => {
      const template = "{{ state_attr('light.living_room', 'brightness') }}";
      const entities = engine.extractEntities(template);
      expect(entities).toContain('light.living_room');
    });

    it('should extract entity IDs from is_state() calls', () => {
      const template = "{% if is_state('light.living_room', 'on') %}Yes{% endif %}";
      const entities = engine.extractEntities(template);
      expect(entities).toContain('light.living_room');
    });

    it('should extract multiple entity IDs', () => {
      const template = `
        {{ states('sensor.temperature') }}
        {{ state_attr('light.living_room', 'brightness') }}
        {% if is_state('binary_sensor.door', 'on') %}Open{% endif %}
      `;
      const entities = engine.extractEntities(template);
      expect(entities).toContain('sensor.temperature');
      expect(entities).toContain('light.living_room');
      expect(entities).toContain('binary_sensor.door');
    });

    it('should return unique entities only', () => {
      const template = `
        {{ states('sensor.temperature') }}
        {{ states('sensor.temperature') }}
      `;
      const entities = engine.extractEntities(template);
      expect(entities.filter((e) => e === 'sensor.temperature').length).toBe(1);
    });

    it('should handle empty template', () => {
      const entities = engine.extractEntities('');
      expect(entities).toEqual([]);
    });

    it('should handle template without entities', () => {
      const template = '<div class="text-red-500">Static content</div>';
      const entities = engine.extractEntities(template);
      expect(entities).toEqual([]);
    });
  });

  describe('renderOnce', () => {
    it('should call hass.callWS with correct parameters', async () => {
      const template = "{{ states('sensor.temperature') }}";
      await engine.renderOnce(template);

      expect(mockHass.callWS).toHaveBeenCalledWith({
        type: 'render_template',
        template,
        timeout: 10,
        strict: false,
      });
    });

    it('should return rendered result', async () => {
      mockHass.callWS.mockResolvedValue({ result: '22' });
      const result = await engine.renderOnce("{{ states('sensor.temperature') }}");
      expect(result).toBe('22');
    });

    it('should handle errors gracefully', async () => {
      mockHass.callWS.mockRejectedValue(new Error('Template error'));
      await expect(engine.renderOnce('{{ invalid }}')).rejects.toThrow('Template error');
    });
  });

  describe('subscribeTemplate', () => {
    it('should attempt WebSocket subscription', async () => {
      const callback = vi.fn();
      await engine.subscribeTemplate("{{ states('sensor.temperature') }}", callback);

      expect(mockHass.connection.subscribeMessage).toHaveBeenCalled();
    });

    it('should call callback with result', async () => {
      const callback = vi.fn();
      await engine.subscribeTemplate("{{ states('sensor.temperature') }}", callback);

      // Wait for async callback
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledWith('Rendered template result');
    });

    it('should use provided entities list', async () => {
      const callback = vi.fn();
      const entities = ['sensor.custom', 'light.test'];
      await engine.subscribeTemplate('{{ test }}', callback, entities);

      expect(mockHass.connection.subscribeMessage).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          entity_ids: entities,
        })
      );
    });
  });

  describe('cleanup', () => {
    it('should unsubscribe all subscriptions', async () => {
      const unsubscribe = vi.fn();
      mockHass.connection.subscribeMessage.mockResolvedValue(unsubscribe);

      await engine.subscribeTemplate('{{ test1 }}', vi.fn());
      await engine.subscribeTemplate('{{ test2 }}', vi.fn());

      engine.cleanup();

      expect(unsubscribe).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateHass', () => {
    it('should update the hass instance', () => {
      const newHass = { ...mockHass, states: {} };
      engine.updateHass(newHass);
      // No error thrown means success
    });
  });
});
