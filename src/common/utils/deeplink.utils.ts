export const DEEPLINK_BASE = 'snaplet://app';

export enum DeeplinkScreen {
  SPOTLIGHT = 'spotlight',
}

export function buildDeeplink(screen: DeeplinkScreen, id: string): string {
  return `${DEEPLINK_BASE}/${screen}/${id}`;
}

export function extractDeeplinkId(deeplink: string): string {
  const id = deeplink.split('/').at(-1);
  if (!id) {
    throw new Error(`Cannot extract ID from deeplink: "${deeplink}"`);
  }
  return id;
}

export function buildFriendRequestDeeplink(username: string): string {
  return `${DEEPLINK_BASE}?userName=${username}`;
}
