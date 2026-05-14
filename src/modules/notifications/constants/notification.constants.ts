export const NOTIFICATION_QUEUE_NAME = 'notification-queue';

export enum NotificationJobName {
  PUSH_REACTION = 'push.reaction',
  PUSH_WIDGET_REFRESH = 'push.widget_refresh',
  PUSH_CHAT_FCM = 'push.chat_fcm',
}

export enum NotificationType {
  POST_REACTION = 'POST_REACTION',
  WIDGET_REFRESH = 'WIDGET_REFRESH',
  NEW_CHAT_MESSAGE = 'NEW_CHAT_MESSAGE',
  NEW_MESSAGE_REACTION = 'NEW_MESSAGE_REACTION',
}

export enum NotificationDeliveryMode {
  SHOW = 'show',
  SILENT = 'silent',
}

export interface NotificationTypeMobilePolicy {
  deliveryMode: NotificationDeliveryMode;
  triggerWidgetRefresh: boolean;
  triggerFeedRefresh: boolean;
  deepLink: string | null;
}

export const NOTIFICATION_TYPE_MOBILE_POLICY: Record<
  NotificationType,
  NotificationTypeMobilePolicy
> = {
  [NotificationType.POST_REACTION]: {
    deliveryMode: NotificationDeliveryMode.SHOW,
    triggerWidgetRefresh: true,
    triggerFeedRefresh: false,
    deepLink: null,
  },
  [NotificationType.WIDGET_REFRESH]: {
    deliveryMode: NotificationDeliveryMode.SILENT,
    triggerWidgetRefresh: true,
    triggerFeedRefresh: false,
    deepLink: null,
  },
  [NotificationType.NEW_CHAT_MESSAGE]: {
    deliveryMode: NotificationDeliveryMode.SHOW,
    triggerWidgetRefresh: false,
    triggerFeedRefresh: false,
    deepLink: null,
  },
  [NotificationType.NEW_MESSAGE_REACTION]: {
    deliveryMode: NotificationDeliveryMode.SHOW,
    triggerWidgetRefresh: false,
    triggerFeedRefresh: false,
    deepLink: null,
  },
};
