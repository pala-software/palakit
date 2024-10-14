import { createPart } from "part-di";

type LogFunction = (obj: unknown, msg?: string) => void;

export type Logger = {
  createLogger: (category: string) => {
    debug: LogFunction;
    info: LogFunction;
    warn: LogFunction;
    error: LogFunction;
    fatal: LogFunction;
  };
};

export const Logger = createPart<Logger>("Logger", [], () => ({
  createLogger: (category: string) => ({
    debug: (obj, msg) => console.debug(category, obj, msg),
    info: (obj, msg) => console.info(category, obj, msg),
    warn: (obj, msg) => console.warn(category, obj, msg),
    error: (obj, msg) => console.error(category, obj, msg),
    fatal: (obj, msg) => console.error(category, obj, msg),
  }),
}));
