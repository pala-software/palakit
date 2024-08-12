import { Application, createPart } from "@pala/core";
import { EventBus } from "@pala/events";
import { connect, ConnectionOptions, NatsConnection } from "nats";

export const createNatsEventBus = (options: ConnectionOptions) =>
  createPart(EventBus, [Application], ([application]) => {
    let setConnection: (connection: NatsConnection) => void;
    const connected = new Promise<NatsConnection>((resolve) => {
      setConnection = resolve;
    });

    return {
      connect: application.start.on("NatsEventBus.connect", async () => {
        const connection = await connect({
          name: application.name,
          ...options,
        });
        setConnection(connection);
      }),
      publish: (options) => {
        connected.then((connection) =>
          connection.publish(
            `${application.name}.${options.subject}`,
            options.payload,
          ),
        );
      },
      subscribe: async (options) => {
        const connection = await connected;
        const subscription = connection.subscribe(
          `${application.name}.${options.subject}`,
          {
            queue: options.queueGroup,
            callback: (_error, message) => {
              options.callback(message.data);
            },
          },
        );
        return {
          unsubscribe: () => subscription.unsubscribe(),
        };
      },
    };
  });
