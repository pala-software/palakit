import { createPart, EventBus, Runtime } from "@pala/core";
import { connect, ConnectionOptions, NatsConnection } from "nats";

export const createNatsEventBus = (options: ConnectionOptions) =>
  createPart(EventBus, [Runtime], ([runtime]) => {
    let setConnection: (connection: NatsConnection) => void;
    let connected = new Promise<NatsConnection>((resolve) => {
      setConnection = resolve;
    });

    return {
      connect: async () => {
        const connection = await connect({ name: runtime.appName, ...options });
        setConnection(connection);
      },
      publish: (options) => {
        connected.then((connection) =>
          connection.publish(
            `${runtime.appName}.${options.subject}`,
            options.payload
          )
        );
      },
      subscribe: async (options) => {
        const connection = await connected;
        const subscription = connection.subscribe(options.subject, {
          queue: options.queueGroup,
          callback: (_error, message) => {
            options.callback(message.data);
          },
        });
        return {
          unsubscribe: () => subscription.unsubscribe(),
        };
      },
    };
  });
