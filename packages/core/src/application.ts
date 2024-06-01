import { createPart, Part, resolvePart } from "part-di";
import { createEvent } from "./event";

export const Application = createPart("Application", [], () => ({
  init: createEvent(),
}));

export const createApplication = (plugins: Part[]) =>
  resolvePart(
    createPart(
      "ApplicationResolver",
      [Application, ...plugins],
      ([application]) => application
    ),
    []
  );
