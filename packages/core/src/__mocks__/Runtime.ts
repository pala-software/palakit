import { createPart } from "part-di";
import { Runtime as RuntimeDefinition } from "../Runtime";

export const MockRuntime = createPart(RuntimeDefinition, [], () => {
  const createFunction = jest.fn(() =>
    Object.assign(jest.fn(), {
      before: createFunction,
      after: createFunction,
    }),
  ) as unknown as jest.Mocked<RuntimeDefinition["createFunction"]>;

  return {
    createFunction,
    createTrigger: jest.fn(() =>
      Object.assign(jest.fn(), {
        on: createFunction,
      }),
    ),
  };
});
