/**
 * Network fingerprint information
 */
export interface NetworkFingerprint {
  ip?: string;
  userAgent?: string;
  proxy?: string;
}

/**
 * Platform type - only iOS and Android are supported
 */
export type Platform = 'ios' | 'android';

/**
 * Device fingerprint information
 */
export interface DeviceFingerprint {
  deviceId: string;
  platform: Platform;
  model?: string;
  appVersion: string;
}

/**
 * Complete client fingerprint payload
 */
export interface ClientFingerprint
  extends DeviceFingerprint, NetworkFingerprint {
  ts: number; // Unix timestamp
}
