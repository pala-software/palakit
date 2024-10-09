import {
  NotImplementedError,
  Part,
  createPart,
  getName,
  resolvePart,
} from "part-di";
import { LocalRuntime } from "./LocalRuntime";

type ApplicationConfiguration = {
  name: string;
};

export const ApplicationConfiguration = createPart<ApplicationConfiguration>(
  "ApplicationConfiguration",
);

export const Application = createPart(
  "Application",
  [LocalRuntime, ApplicationConfiguration],
  ([local, config]) => {
    const parts = new Map<Part, unknown>();

    const hasDefinition = (part: Part, definition: Part): boolean =>
      part === definition ||
      (typeof part.definition !== "string" &&
        hasDefinition(part.definition, definition));

    return {
      name: config.name,
      start: local.createTrigger("Application.start"),
      register: <T extends Part>(
        definition: T,
        implementation: ReturnType<T>,
      ) => {
        parts.set(definition, implementation);
      },
      resolve: <T extends Part>(definition: T): ReturnType<T> => {
        for (const [part, implementation] of parts.entries()) {
          if (hasDefinition(part, definition)) {
            return implementation as ReturnType<T>;
          }
        }
        throw new Error("Could not find part: " + getName(definition));
      },
    };
  },
);

export type ApplicationOptions = {
  name: string;
  parts: Part[];
};

export const resolveApplication = (options: ApplicationOptions) => {
  try {
    return resolvePart(
      createPart(
        "ApplicationResolver",
        [Application, ...options.parts],
        ([application, ...implementations]) => {
          for (let index = 0; index < options.parts.length; index++) {
            application.register(options.parts[index], implementations[index]);
          }
          return application;
        },
      ),
      [
        createPart(ApplicationConfiguration, [], () => ({
          name: options.name,
        })),
        ...options.parts,
      ],
    );
  } catch (error) {
    if (error instanceof NotImplementedError) {
      console.error(
        error.message,
        "\nPlease append some implementation of the required dependency into" +
          " the array of parts when calling resolveApplication.",
      );
      process.exit(1);
    } else {
      throw error;
    }
  }
};
