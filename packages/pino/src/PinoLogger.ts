import { createPart } from "part-di";
import pino, { DestinationStream, LoggerOptions } from "pino";
import { Logger } from "@palakit/core";

export const createPinoLogger = (
  options: DestinationStream | LoggerOptions | undefined,
) =>
  createPart(Logger, [], () => {
    const logger = pino(options);
    return {
      createLogger: (category) => {
        const childLogger = logger.child({ category });
        return {
          debug: (obj, msg?) => childLogger.debug(obj, msg),
          info: (obj, msg?) => childLogger.info(obj, msg),
          warn: (obj, msg?) => childLogger.warn(obj, msg),
          error: (obj, msg?) => childLogger.error(obj, msg),
          fatal: (obj, msg?) => childLogger.fatal(obj, msg),
        };
      },
    };
  });
