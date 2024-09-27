import { createPart } from "part-di";
import { Logger as PinoLogger } from "pino";
import { Logger } from "./Logger";

export const createPinoLogger = (logger: PinoLogger) =>
  createPart(Logger, [], () => ({
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
  }));
