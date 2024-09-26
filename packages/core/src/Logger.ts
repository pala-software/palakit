import { createPart } from "part-di";

type LoggerType = {
  createLogger: (category: string) => {
    debug: (...msg: unknown[]) => void;
    info: (...msg: unknown[]) => void;
    warn: (...msg: unknown[]) => void;
    error: (...msg: unknown[]) => void;
    fatal: (...msg: unknown[]) => void;
  };
};

export const Logger = createPart<LoggerType>("Logger");
