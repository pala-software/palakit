import { createPart } from "part-di";

type LogFunction = (obj: unknown, msg?: string) => void;

type Logger = {
  createLogger: (category: string) => {
    debug: LogFunction;
    info: LogFunction;
    warn: LogFunction;
    error: LogFunction;
    fatal: LogFunction;
  };
};

export const Logger = createPart<Logger>("Logger");
