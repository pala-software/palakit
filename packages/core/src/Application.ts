import { NotImplementedError, Part, createPart, resolvePart } from "part-di";
import { LocalRuntime } from "./LocalRuntime";

type ApplicationConfiguration = {
  name: string;
};

const ApplicationConfiguration = createPart<ApplicationConfiguration>(
  "ApplicationConfiguration"
);

export const Application = createPart(
  "Application",
  [LocalRuntime, ApplicationConfiguration],
  ([local, config]) => ({
    name: config.name,
    init: local.createTrigger("application.init"),
  })
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
        ([application]) => application
      ),
      [
        createPart(ApplicationConfiguration, [], () => ({
          name: options.name,
        })),
        ...options.parts,
      ]
    );
  } catch (error) {
    if (error instanceof NotImplementedError) {
      console.error(
        error.message,
        "\nPlease append some implementation of the required dependency into" +
          " the array of parts when calling resolveApplication."
      );
      process.exit(1);
    } else {
      throw error;
    }
  }
};
