/**
 * Template Engine Service
 * 
 * Provides WebSocket template streaming with fallback to render_template
 * for older Home Assistant versions.
 */

import type { HomeAssistant } from 'custom-card-helpers';
import type { TemplateCallback } from '../types';

/**
 * Template subscription response
 */
interface TemplateSubscriptionResponse {
  result: string;
}

/**
 * Template rendering service with WebSocket streaming support
 */
export class TemplateEngine {
  private hass: HomeAssistant;
  private subscriptions: Map<string, () => void> = new Map();

  constructor(hass: HomeAssistant) {
    this.hass = hass;
  }

  /**
   * Update the HomeAssistant instance
   */
  public updateHass(hass: HomeAssistant): void {
    this.hass = hass;
  }

  /**
   * Subscribe to template updates via WebSocket
   * Uses the modern render_template subscription when available
   */
  public async subscribeTemplate(
    template: string,
    callback: TemplateCallback,
    entities?: string[]
  ): Promise<() => void> {
    // Generate a unique subscription key
    const subscriptionKey = this.generateSubscriptionKey(template);

    // Unsubscribe from existing subscription if any
    if (this.subscriptions.has(subscriptionKey)) {
      this.subscriptions.get(subscriptionKey)?.();
      this.subscriptions.delete(subscriptionKey);
    }

    try {
      // Try the modern streaming subscription first
      const unsub = await this.subscribeStreaming(template, callback, entities);
      this.subscriptions.set(subscriptionKey, unsub);
      return unsub;
    } catch (error) {
      console.warn('Template streaming not available, using fallback:', error);
      
      // Fallback to one-time render
      return this.subscribeFallback(template, callback, entities);
    }
  }

  /**
   * Subscribe using WebSocket streaming (modern HA 2023+)
   */
  private async subscribeStreaming(
    template: string,
    callback: TemplateCallback,
    entities?: string[]
  ): Promise<() => void> {
    if (!this.hass.connection) {
      throw new Error('No connection available');
    }

    // Subscribe to template rendering with variables
    const unsub = await this.hass.connection.subscribeMessage<TemplateSubscriptionResponse>(
      (msg) => {
        if (msg.result !== undefined) {
          callback(msg.result);
        }
      },
      {
        type: 'render_template',
        template,
        // Provide entity_ids hint for optimization
        entity_ids: entities,
        // Report errors in template
        report_errors: true,
        // Include the timeout to prevent hanging
        timeout: 10,
      }
    );

    return unsub;
  }

  /**
   * Fallback subscription using polling (older HA versions)
   */
  private async subscribeFallback(
    template: string,
    callback: TemplateCallback,
    entities?: string[]
  ): Promise<() => void> {
    let lastResult: string | undefined;
    let intervalId: number | undefined;
    let isActive = true;

    // Initial render
    await this.renderOnce(template, callback);

    // Set up polling for entity changes
    if (entities && entities.length > 0) {
      let lastStates = this.getEntityStates(entities);

      intervalId = window.setInterval(async () => {
        if (!isActive) return;

        const currentStates = this.getEntityStates(entities);
        
        // Check if any entity state changed
        if (JSON.stringify(currentStates) !== JSON.stringify(lastStates)) {
          lastStates = currentStates;
          await this.renderOnce(template, (result) => {
            if (result !== lastResult) {
              lastResult = result;
              callback(result);
            }
          });
        }
      }, 1000); // Poll every second
    }

    // Return unsubscribe function
    return () => {
      isActive = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }

  /**
   * Render a template once
   */
  public async renderOnce(template: string, callback?: TemplateCallback): Promise<string> {
    try {
      const result = await this.hass.callWS<{ result: string }>({
        type: 'render_template',
        template,
      });

      if (callback) {
        callback(result.result);
      }

      return result.result;
    } catch (error) {
      console.error('Template rendering failed:', error);
      const errorMessage = `Template error: ${error}`;
      
      if (callback) {
        callback(errorMessage);
      }
      
      return errorMessage;
    }
  }

  /**
   * Get current states of specified entities
   */
  private getEntityStates(entities: string[]): Record<string, unknown> {
    const states: Record<string, unknown> = {};
    
    for (const entityId of entities) {
      const state = this.hass.states[entityId];
      if (state) {
        states[entityId] = {
          state: state.state,
          attributes: state.attributes,
          last_changed: state.last_changed,
        };
      }
    }
    
    return states;
  }

  /**
   * Generate a unique subscription key
   */
  private generateSubscriptionKey(template: string): string {
    // Simple hash of the template
    let hash = 0;
    for (let i = 0; i < template.length; i++) {
      const char = template.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `template_${hash}`;
  }

  /**
   * Extract entity IDs from a template
   */
  public extractEntities(template: string, knownEntities: string[]): string[] {
    const found: Set<string> = new Set();

    for (const entityId of knownEntities) {
      if (template.includes(entityId)) {
        found.add(entityId);
      }
    }

    // Also try to find common patterns
    const patterns = [
      /states\(['"]([^'"]+)['"]\)/g,
      /states\.([a-z_]+\.[a-z0-9_]+)/g,
      /is_state\(['"]([^'"]+)['"]/g,
      /state_attr\(['"]([^'"]+)['"]/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(template)) !== null) {
        if (match[1] && knownEntities.includes(match[1])) {
          found.add(match[1]);
        }
      }
    }

    return Array.from(found);
  }

  /**
   * Cleanup all subscriptions
   */
  public cleanup(): void {
    for (const unsub of this.subscriptions.values()) {
      unsub();
    }
    this.subscriptions.clear();
  }
}
