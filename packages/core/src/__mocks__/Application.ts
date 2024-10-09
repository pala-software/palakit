import { createPart } from "part-di";
import { Runtime as LocalRuntime } from "./Runtime";
import { ApplicationConfiguration } from "../Application";

export const Application = createPart(
  "Application",
  [LocalRuntime, ApplicationConfiguration],
  ([local, config]) => {
    return {
      name: config.name,
      start: local.createTrigger("Application.start"),
      register: jest.fn(),
      resolve: jest.fn(),
    };
  },
);
