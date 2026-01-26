/**
 * Camera Capabilities Service
 * 
 * Detects camera streaming capabilities and prefers WebRTC when available.
 */

import type { HomeAssistant } from 'custom-card-helpers';
import type { CameraCapabilitiesResponse } from '../types';

/**
 * Stream type preference order
 */
export enum StreamType {
  WEBRTC = 'web_rtc',
  HLS = 'hls',
  MJPEG = 'mjpeg',
}

/**
 * Cached camera capabilities
 */
interface CachedCapabilities {
  capabilities: CameraCapabilitiesResponse;
  timestamp: number;
}

/**
 * Camera capabilities service
 */
export class CameraCapabilities {
  private hass: HomeAssistant;
  private cache: Map<string, CachedCapabilities> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
   * Get the best available stream type for a camera entity
   */
  public async getBestStreamType(entityId: string, preferWebRTC = true): Promise<StreamType> {
    // Validate entity
    if (!this.isCameraEntity(entityId)) {
      console.warn(`Entity ${entityId} is not a camera`);
      return StreamType.MJPEG;
    }

    try {
      const capabilities = await this.getCapabilities(entityId);

      if (preferWebRTC && capabilities.frontend_stream_types.includes('web_rtc')) {
        return StreamType.WEBRTC;
      }

      if (capabilities.frontend_stream_types.includes('hls')) {
        return StreamType.HLS;
      }

      return StreamType.MJPEG;
    } catch (error) {
      console.warn(`Failed to get camera capabilities for ${entityId}:`, error);
      return StreamType.MJPEG;
    }
  }

  /**
   * Check if WebRTC is available for a camera
   */
  public async isWebRTCAvailable(entityId: string): Promise<boolean> {
    if (!this.isCameraEntity(entityId)) {
      return false;
    }

    try {
      const capabilities = await this.getCapabilities(entityId);
      return capabilities.frontend_stream_types.includes('web_rtc');
    } catch {
      return false;
    }
  }

  /**
   * Check if HLS is available for a camera
   */
  public async isHLSAvailable(entityId: string): Promise<boolean> {
    if (!this.isCameraEntity(entityId)) {
      return false;
    }

    try {
      const capabilities = await this.getCapabilities(entityId);
      return capabilities.frontend_stream_types.includes('hls');
    } catch {
      return false;
    }
  }

  /**
   * Get camera capabilities from Home Assistant
   */
  public async getCapabilities(entityId: string): Promise<CameraCapabilitiesResponse> {
    // Check cache first
    const cached = this.cache.get(entityId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.capabilities;
    }

    // Fetch from HA
    try {
      const capabilities = await this.hass.callWS<CameraCapabilitiesResponse>({
        type: 'camera/capabilities',
        entity_id: entityId,
      });

      // Cache the result
      this.cache.set(entityId, {
        capabilities,
        timestamp: Date.now(),
      });

      return capabilities;
    } catch (error) {
      // Return default capabilities on error
      return {
        frontend_stream_types: [],
      };
    }
  }

  /**
   * Get WebRTC stream URL for a camera
   */
  public async getWebRTCStreamUrl(entityId: string): Promise<string | null> {
    if (!await this.isWebRTCAvailable(entityId)) {
      return null;
    }

    try {
      const response = await this.hass.callWS<{ url: string }>({
        type: 'camera/web_rtc_offer',
        entity_id: entityId,
      });
      return response.url;
    } catch (error) {
      console.error(`Failed to get WebRTC URL for ${entityId}:`, error);
      return null;
    }
  }

  /**
   * Get HLS stream URL for a camera
   */
  public async getHLSStreamUrl(entityId: string): Promise<string | null> {
    if (!await this.isHLSAvailable(entityId)) {
      return null;
    }

    try {
      const response = await this.hass.callWS<{ url: string }>({
        type: 'camera/stream',
        entity_id: entityId,
        format: 'hls',
      });
      return response.url;
    } catch (error) {
      console.error(`Failed to get HLS URL for ${entityId}:`, error);
      return null;
    }
  }

  /**
   * Get MJPEG stream URL for a camera
   */
  public getMJPEGStreamUrl(entityId: string): string {
    return `/api/camera_proxy_stream/${entityId}?token=${this.hass.auth?.data?.access_token || ''}`;
  }

  /**
   * Get the best available stream URL for a camera
   */
  public async getStreamUrl(entityId: string, preferWebRTC = true): Promise<string> {
    const streamType = await this.getBestStreamType(entityId, preferWebRTC);

    switch (streamType) {
      case StreamType.WEBRTC: {
        const url = await this.getWebRTCStreamUrl(entityId);
        if (url) return url;
        // Fall through to HLS
      }
      case StreamType.HLS: {
        const url = await this.getHLSStreamUrl(entityId);
        if (url) return url;
        // Fall through to MJPEG
      }
      default:
        return this.getMJPEGStreamUrl(entityId);
    }
  }

  /**
   * Check if an entity is a camera
   */
  public isCameraEntity(entityId: string): boolean {
    if (!entityId) return false;
    
    const domain = entityId.split('.')[0];
    if (domain !== 'camera') return false;

    const state = this.hass.states[entityId];
    return !!state;
  }

  /**
   * Get all camera entities
   */
  public getCameraEntities(): string[] {
    return Object.keys(this.hass.states)
      .filter((entityId) => entityId.startsWith('camera.'));
  }

  /**
   * Create a video element for the camera
   */
  public async createVideoElement(
    entityId: string,
    options: {
      preferWebRTC?: boolean;
      showControls?: boolean;
      autoplay?: boolean;
      muted?: boolean;
    } = {}
  ): Promise<HTMLVideoElement | HTMLImageElement> {
    const {
      preferWebRTC = true,
      showControls = true,
      autoplay = true,
      muted = true,
    } = options;

    const streamType = await this.getBestStreamType(entityId, preferWebRTC);

    if (streamType === StreamType.MJPEG) {
      // MJPEG uses img element
      const img = document.createElement('img');
      img.src = this.getMJPEGStreamUrl(entityId);
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      return img as any;
    }

    // Create video element for WebRTC or HLS
    const video = document.createElement('video');
    video.controls = showControls;
    video.autoplay = autoplay;
    video.muted = muted;
    video.playsInline = true;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';

    if (streamType === StreamType.WEBRTC) {
      // WebRTC requires special handling
      await this.setupWebRTC(video, entityId);
    } else {
      // HLS
      const url = await this.getHLSStreamUrl(entityId);
      if (url) {
        video.src = url;
      } else {
        // Fallback to MJPEG
        const img = document.createElement('img');
        img.src = this.getMJPEGStreamUrl(entityId);
        return img as any;
      }
    }

    return video;
  }

  /**
   * Setup WebRTC connection for video element
   */
  private async setupWebRTC(video: HTMLVideoElement, entityId: string): Promise<void> {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      // Handle incoming tracks
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          video.srcObject = event.streams[0];
        }
      };

      // Create offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      // Send offer to Home Assistant
      const response = await this.hass.callWS<{ answer: RTCSessionDescriptionInit }>({
        type: 'camera/web_rtc_offer',
        entity_id: entityId,
        offer: offer.sdp,
      });

      // Set remote description
      await pc.setRemoteDescription(new RTCSessionDescription(response.answer));

      // Store connection for cleanup
      (video as any)._rtcConnection = pc;
    } catch (error) {
      console.error('WebRTC setup failed:', error);
      throw error;
    }
  }

  /**
   * Clear the capabilities cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific entity
   */
  public clearEntityCache(entityId: string): void {
    this.cache.delete(entityId);
  }
}
