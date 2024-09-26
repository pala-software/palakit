import { createPart } from "part-di";
import { Logger as PinoLoggerType } from "pino";
import { Logger } from "./Logger";

export const createPinoLogger = (logger: PinoLoggerType) =>
  createPart(Logger, [], () => ({
    createLogger: (category) => {
      const childLogger = logger.child({ category });
      return {
        debug: (...msg) => childLogger.debug(msg),
        info: (...msg) => childLogger.info(msg),
        warn: (...msg) => childLogger.warn(msg),
        error: (...msg) => childLogger.error(msg),
        fatal: (...msg) => childLogger.fatal(msg),
      };
    },
  }));
