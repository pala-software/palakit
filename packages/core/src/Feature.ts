import { createPart, Part } from "part-di";

export const createFeature = <Parts extends Part[], Configuration>(
  parts: [...Parts],
  configuration?: Part<Configuration>,
) => {
  return Object.assign(
    parts,
    configuration && {
      configure: (config: Configuration) => [
        ...parts,
        createPart(configuration, [], () => config),
      ],
    },
  );
};

export const createConfiguration = <Type>(name: string, defaults?: Type) =>
  createPart<Type>(name, [], defaults && (() => defaults));
