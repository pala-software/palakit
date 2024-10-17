import { createPart, Runtime } from "@palakit/core";

export const MockRuntime = createPart(Runtime, [], () => {
  const createFunction = jest.fn(() =>
    Object.assign(jest.fn(), {
      before: createFunction,
      after: createFunction,
    }),
  ) as unknown as jest.Mocked<Runtime["createFunction"]>;

  return {
    createFunction,
    createTrigger: jest.fn(() =>
      Object.assign(jest.fn(), {
        on: createFunction,
      }),
    ),
  };
});
