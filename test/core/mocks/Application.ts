import { createPart } from "part-di";
import { MockRuntime } from "./Runtime";
import { ApplicationConfiguration } from "@palakit/core";

export const MockApplication = createPart(
  "Application",
  [MockRuntime, ApplicationConfiguration],
  ([rt, config]) => {
    return {
      name: config.name,
      start: rt.createTrigger("Application.start"),
      register: jest.fn(),
      resolve: jest.fn(),
    };
  },
);
