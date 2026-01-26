/**
 * Test setup file
 * 
 * Configures the test environment with mocks and utilities.
 */

import { vi } from 'vitest';

// Mock Home Assistant connection
export const mockHass = {
  states: {
    'sensor.temperature': {
      entity_id: 'sensor.temperature',
      state: '22',
      attributes: {
        friendly_name: 'Temperature',
        unit_of_measurement: '°C',
      },
      last_updated: new Date().toISOString(),
      last_changed: new Date().toISOString(),
    },
    'light.living_room': {
      entity_id: 'light.living_room',
      state: 'on',
      attributes: {
        friendly_name: 'Living Room Light',
        brightness: 255,
      },
      last_updated: new Date().toISOString(),
      last_changed: new Date().toISOString(),
    },
    'camera.front_door': {
      entity_id: 'camera.front_door',
      state: 'streaming',
      attributes: {
        friendly_name: 'Front Door Camera',
      },
      last_updated: new Date().toISOString(),
      last_changed: new Date().toISOString(),
    },
  },
  connection: {
    subscribeMessage: vi.fn().mockResolvedValue(() => {}),
    sendMessagePromise: vi.fn().mockResolvedValue({}),
  },
  callWS: vi.fn().mockResolvedValue({}),
  callService: vi.fn().mockResolvedValue({}),
  auth: {
    data: {
      access_token: 'mock-token',
    },
  },
  language: 'en',
  locale: {
    language: 'en',
    number_format: 'language',
  },
};

// Mock custom-card-helpers
vi.mock('custom-card-helpers', () => ({
  handleAction: vi.fn(),
  hasAction: vi.fn((action) => !!action),
  fireEvent: vi.fn(),
}));

// Mock Lit decorators for testing
vi.mock('lit/decorators.js', async () => {
  const actual = await vi.importActual('lit/decorators.js');
  return {
    ...actual,
    customElement: (tagName: string) => (target: any) => {
      // Don't actually define custom elements in tests
      return target;
    },
  };
});

// Global test utilities
declare global {
  var mockHass: typeof mockHass;
}

globalThis.mockHass = mockHass;
