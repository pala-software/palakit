import { createPart, Part, resolvePart } from "part-di";
import { createTrigger } from "./trigger";
import { createFunction } from "./function";

const PartContainer = createPart<Map<Part, unknown>>("PartContainer");

export const Runtime = createPart(
  "Application",
  [PartContainer],
  ([parts]) => ({
    init: createTrigger(),
    get: <T extends Part>(part: T) =>
      parts.get(part) as
        | (T extends Part<infer Type> ? Type : never)
        | undefined,
  })
);

export const resolveRuntime = (parts: Part[]) =>
  resolvePart(
    createPart("RuntimeResolver", [Runtime], ([runtime]) => runtime),
    [
      createPart(PartContainer, parts, (implementations) => {
        const map = new Map<Part, unknown>();
        for (const [index, part] of parts.entries()) {
          map.set(part, implementations[index]);
        }
        return map;
      }),
    ]
  );
