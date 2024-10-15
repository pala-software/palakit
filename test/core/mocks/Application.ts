import { createPart, ApplicationConfiguration } from "@palakit/core";
import { MockRuntime } from "./Runtime";

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
