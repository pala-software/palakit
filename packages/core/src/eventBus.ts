import { createPart } from "part-di";

export type Subscription = {
  unsubscribe: () => void;
};

export type EventBus = {
  connect: () => Promise<void>;
  publish: (options: { subject: string; payload?: Uint8Array }) => void;
  subscribe: (options: {
    subject: string;
    callback: (payload?: Uint8Array) => void;
    queueGroup?: string;
  }) => Promise<Subscription>;
};

export const EventBus = createPart<EventBus>("EventBus");
