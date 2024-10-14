import { createPart, Resolved } from "@palakit/core";
import { Field } from "./DocumentStore";
import { validate } from "@typeschema/main";

export type DocumentStoreUtils = Resolved<typeof DocumentStoreUtils>;

const maxInteger = (bits: number) => 2 ** (bits - 1) - 1;

export const DocumentStoreUtils = createPart("DocumentStoreUtils", [], () => ({
  validateField: async (
    field: Field & { name: string },
    input: unknown,
  ): Promise<void> => {
    if (field.schema) {
      const result = await validate(field.schema, input);
      if (!result.success) {
        throw new Error(
          "Validation failed with following issues: \n" +
            result.issues
              .map(
                ({ message, path }) =>
                  ` - ${message}` +
                  (path?.length ? ` (at ${path.join(".")})` : ""),
              )
              .join("\n"),
        );
      }
    }

    if ((field.nullable ?? true) && input === undefined) {
      // No input for nullable field. That's ok.
      return;
    }

    switch (field.dataType) {
      case "string":
        if (typeof input !== "string") {
          throw new Error(`Field value for ${field.name} is not a string`);
        }
        if (field.length !== undefined && input.length > field.length) {
          throw new Error(
            `Field value for ${field.name} has length more` +
              " than allowed maximum",
          );
        }
        break;
      case "boolean":
        if (typeof input !== "boolean") {
          throw new Error(`Field value for ${field.name} is not a boolean`);
        }
        break;
      case "integer": {
        if (typeof input !== "number" || Number.isNaN(input)) {
          throw new Error(`Field value for ${field.name} is not a number`);
        }
        if (input % 1 !== 0) {
          throw new Error(`Field value for ${field.name} is not an integer`);
        }

        if (
          field.size !== undefined &&
          Math.abs(input) > maxInteger(field.size)
        ) {
          throw new Error(
            `Field value for ${field.name} does not fit as a` +
              ` ${field.size} bit integer`,
          );
        }
        break;
      }
      case "float":
        if (typeof input !== "number") {
          throw new Error(`Field value for ${field.name} is not a number`);
        }

        // NOTE: I don't think there's a need to validate size
        // of floating point numbers as they usually aren't used
        // absolute precision in mind.
        break;
      case "date":
        if (!(input instanceof Date)) {
          throw new Error(`Field value for ${field.name} is not a Date`);
        }
        break;
      case "blob":
        if (!(input instanceof Buffer)) {
          throw new Error(`Field value for ${field.name} is not a Buffer`);
        }
        break;
    }
  },
}));
