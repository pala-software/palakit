import pino, { DestinationStream, LoggerOptions } from "pino";
import {
  createConfiguration,
  createFeature,
  createPart,
  Logger,
} from "@palakit/core";

export type PinoLoggerConfiguration =
  | DestinationStream
  | LoggerOptions
  | undefined;

export const PinoLoggerConfiguration =
  createConfiguration<PinoLoggerConfiguration>(
    "PinoLoggerConfiguration",
    undefined,
  );

export const PinoLogger = createPart(
  Logger,
  [PinoLoggerConfiguration],
  ([config]) => {
    const logger = pino(config);
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
  },
);

export const PinoLoggerFeature = createFeature(
  [PinoLogger],
  PinoLoggerConfiguration,
);
