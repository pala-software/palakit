import type { Context } from "./Context";

export type Document<T extends Context, K extends keyof T["collections"]> = {
  [F in keyof T["collections"][K]["fields"]]: T["fieldTypes"][Extract<
    T["collections"][K]["fields"][F]["type"],
    string
  >]["schema"]["_output"];
};
