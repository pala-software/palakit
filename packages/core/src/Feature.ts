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

export const createConfiguration = <Type>(
  name: string,
  {
    optional,
    defaults,
  }: {
    /**
     * Force configuration to be optional without defining defaults. If true,
     * type parameter must be assignable to undefined because the default value
     * will be undefined.
     *
     * @default false
     */
    optional?: Type extends undefined ? boolean : false;

    /**
     * Default value for configuration. Defining this makes configuration
     * optional.
     */
    defaults?: Type;
  } = {},
) =>
  createPart<Type>(
    name,
    [],
    optional || defaults !== undefined ? () => defaults as Type : undefined,
  );
