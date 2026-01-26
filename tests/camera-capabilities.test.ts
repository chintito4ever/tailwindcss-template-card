/**
 * Camera Capabilities Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CameraCapabilities, StreamType } from '../src/services/camera-capabilities';

describe('CameraCapabilities', () => {
  let cameraService: CameraCapabilities;
  let mockHass: any;

  beforeEach(() => {
    mockHass = {
      states: {
        'camera.front_door': {
          entity_id: 'camera.front_door',
          state: 'streaming',
          attributes: { friendly_name: 'Front Door' },
        },
        'camera.backyard': {
          entity_id: 'camera.backyard',
          state: 'idle',
          attributes: { friendly_name: 'Backyard' },
        },
        'light.living_room': {
          entity_id: 'light.living_room',
          state: 'on',
        },
      },
      callWS: vi.fn(),
      auth: {
        data: { access_token: 'test-token' },
      },
    };

    cameraService = new CameraCapabilities(mockHass);
  });

  afterEach(() => {
    cameraService.clearCache();
  });

  describe('isCameraEntity', () => {
    it('should return true for camera entities', () => {
      expect(cameraService.isCameraEntity('camera.front_door')).toBe(true);
    });

    it('should return false for non-camera entities', () => {
      expect(cameraService.isCameraEntity('light.living_room')).toBe(false);
    });

    it('should return false for non-existent entities', () => {
      expect(cameraService.isCameraEntity('camera.nonexistent')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(cameraService.isCameraEntity('')).toBe(false);
    });
  });

  describe('getCameraEntities', () => {
    it('should return all camera entities', () => {
      const cameras = cameraService.getCameraEntities();
      expect(cameras).toContain('camera.front_door');
      expect(cameras).toContain('camera.backyard');
      expect(cameras).not.toContain('light.living_room');
    });
  });

  describe('getCapabilities', () => {
    it('should call hass.callWS with correct parameters', async () => {
      mockHass.callWS.mockResolvedValue({
        frontend_stream_types: ['web_rtc', 'hls'],
      });

      await cameraService.getCapabilities('camera.front_door');

      expect(mockHass.callWS).toHaveBeenCalledWith({
        type: 'camera/capabilities',
        entity_id: 'camera.front_door',
      });
    });

    it('should cache capabilities', async () => {
      mockHass.callWS.mockResolvedValue({
        frontend_stream_types: ['web_rtc'],
      });

      await cameraService.getCapabilities('camera.front_door');
      await cameraService.getCapabilities('camera.front_door');

      // Should only call once due to caching
      expect(mockHass.callWS).toHaveBeenCalledTimes(1);
    });

    it('should return default capabilities on error', async () => {
      mockHass.callWS.mockRejectedValue(new Error('Camera error'));

      const capabilities = await cameraService.getCapabilities('camera.front_door');

      expect(capabilities.frontend_stream_types).toEqual([]);
    });
  });

  describe('getBestStreamType', () => {
    it('should prefer WebRTC when available', async () => {
      mockHass.callWS.mockResolvedValue({
        frontend_stream_types: ['web_rtc', 'hls'],
      });

      const type = await cameraService.getBestStreamType('camera.front_door');
      expect(type).toBe(StreamType.WEBRTC);
    });

    it('should fall back to HLS when WebRTC unavailable', async () => {
      mockHass.callWS.mockResolvedValue({
        frontend_stream_types: ['hls'],
      });

      const type = await cameraService.getBestStreamType('camera.front_door');
      expect(type).toBe(StreamType.HLS);
    });

    it('should fall back to MJPEG when nothing else available', async () => {
      mockHass.callWS.mockResolvedValue({
        frontend_stream_types: [],
      });

      const type = await cameraService.getBestStreamType('camera.front_door');
      expect(type).toBe(StreamType.MJPEG);
    });

    it('should respect preferWebRTC=false', async () => {
      mockHass.callWS.mockResolvedValue({
        frontend_stream_types: ['web_rtc', 'hls'],
      });

      const type = await cameraService.getBestStreamType('camera.front_door', false);
      expect(type).toBe(StreamType.HLS);
    });

    it('should return MJPEG for non-camera entities', async () => {
      const type = await cameraService.getBestStreamType('light.living_room');
      expect(type).toBe(StreamType.MJPEG);
    });
  });

  describe('isWebRTCAvailable', () => {
    it('should return true when WebRTC is available', async () => {
      mockHass.callWS.mockResolvedValue({
        frontend_stream_types: ['web_rtc'],
      });

      const available = await cameraService.isWebRTCAvailable('camera.front_door');
      expect(available).toBe(true);
    });

    it('should return false when WebRTC is not available', async () => {
      mockHass.callWS.mockResolvedValue({
        frontend_stream_types: ['hls'],
      });

      const available = await cameraService.isWebRTCAvailable('camera.front_door');
      expect(available).toBe(false);
    });

    it('should return false for non-camera entities', async () => {
      const available = await cameraService.isWebRTCAvailable('light.living_room');
      expect(available).toBe(false);
    });
  });

  describe('isHLSAvailable', () => {
    it('should return true when HLS is available', async () => {
      mockHass.callWS.mockResolvedValue({
        frontend_stream_types: ['hls'],
      });

      const available = await cameraService.isHLSAvailable('camera.front_door');
      expect(available).toBe(true);
    });

    it('should return false when HLS is not available', async () => {
      mockHass.callWS.mockResolvedValue({
        frontend_stream_types: ['web_rtc'],
      });

      const available = await cameraService.isHLSAvailable('camera.front_door');
      expect(available).toBe(false);
    });
  });

  describe('getMJPEGStreamUrl', () => {
    it('should return correct MJPEG URL', () => {
      const url = cameraService.getMJPEGStreamUrl('camera.front_door');
      expect(url).toContain('/api/camera_proxy_stream/camera.front_door');
      expect(url).toContain('token=test-token');
    });
  });

  describe('clearCache', () => {
    it('should clear all cached capabilities', async () => {
      mockHass.callWS.mockResolvedValue({
        frontend_stream_types: ['web_rtc'],
      });

      await cameraService.getCapabilities('camera.front_door');
      cameraService.clearCache();
      await cameraService.getCapabilities('camera.front_door');

      // Should be called twice after cache clear
      expect(mockHass.callWS).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearEntityCache', () => {
    it('should clear cache for specific entity', async () => {
      mockHass.callWS.mockResolvedValue({
        frontend_stream_types: ['web_rtc'],
      });

      await cameraService.getCapabilities('camera.front_door');
      await cameraService.getCapabilities('camera.backyard');
      cameraService.clearEntityCache('camera.front_door');
      await cameraService.getCapabilities('camera.front_door');
      await cameraService.getCapabilities('camera.backyard');

      // front_door: 2 calls (initial + after clear)
      // backyard: 1 call (still cached)
      expect(mockHass.callWS).toHaveBeenCalledTimes(3);
    });
  });
});
