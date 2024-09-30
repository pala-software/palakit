import { Application, createPart } from "@palakit/core";
import {
  DocumentStore,
  DocumentHandle,
  Collection,
  Where,
  DataType,
} from "@palakit/db";
import { validate } from "@typeschema/main";
import {
  DataTypes,
  Model,
  ModelAttributes,
  Op,
  Options,
  Sequelize,
  WhereAttributeHash,
} from "sequelize";

export const createSequelizeDocumentStore = (options: Options) =>
  createPart(DocumentStore, [Application], ([application]) => {
    const sequelize = new Sequelize(options);
    let setSynchronized: () => void;
    const synchronized = new Promise<void>((resolve) => {
      setSynchronized = resolve;
    });

    const toDocument = <T extends Collection>(instance: Model) =>
      ({
        get: async () => {
          const { id, ...values } = instance.get();
          return { id: id.toString(), ...values };
        },
        update: async (values) => {
          await instance.update(values);
        },
        delete: async () => {
          await instance.destroy();
        },
      }) as DocumentHandle<T>;

    const transformWhere = <T extends Collection>(where: Where<T>) => {
      const transformed: WhereAttributeHash = {};
      if (where.and) {
        transformed.and = where.and.map((where) => transformWhere<T>(where));
      }
      if (where.or) {
        transformed.or = where.or.map((where) => transformWhere<T>(where));
      }
      for (const field of Object.keys(where)) {
        if (["and", "or"].includes(field)) {
          continue;
        }
        const condition = where[field as Exclude<keyof Where<T>, "and" | "or">];
        if (!condition) {
          continue;
        }
        transformed[field] = {};
        if ("equals" in condition) {
          transformed[field][Op.eq] = condition.equals;
        }
        if ("notEquals" in condition) {
          transformed[field][Op.ne] = condition.notEquals;
        }
        if ("is" in condition) {
          transformed[field][Op.is] = condition.is;
        }
        if ("isNot" in condition) {
          transformed[field][Op.not] = condition.isNot;
        }
        if ("in" in condition) {
          transformed[field][Op.in] = condition.in;
        }
        if ("notIn" in condition) {
          transformed[field][Op.notIn] = condition.notIn;
        }
        if ("like" in condition) {
          transformed[field][Op.like] = condition.like;
        }
        if ("notLike" in condition) {
          transformed[field][Op.notLike] = condition.notLike;
        }
        if ("gt" in condition) {
          transformed[field][Op.gt] = condition.gt;
        }
        if ("gte" in condition) {
          transformed[field][Op.gte] = condition.gte;
        }
        if ("lt" in condition) {
          transformed[field][Op.lt] = condition.lt;
        }
        if ("lte" in condition) {
          transformed[field][Op.lte] = condition.lte;
        }
      }
      return transformed;
    };

    const maxInteger = (bits: number) => 2 ** (bits - 1) - 1;

    return {
      connect: application.start.on(
        "SequelizeDocumentStore.connect",
        async () => {
          await sequelize.sync();
          setSynchronized();
        },
      ),
      createCollection: (options) => {
        const columns = Object.entries(options.fields).reduce(
          (obj, [fieldName, field]) => ({
            ...obj,
            [fieldName]: {
              ...(() => {
                switch (field.dataType) {
                  case DataType.STRING:
                    if (field.length === undefined) {
                      return { type: DataTypes.TEXT };
                    }
                    return { type: DataTypes.STRING(field.length) };
                  case DataType.BOOLEAN:
                    return { type: DataTypes.BOOLEAN };
                  case DataType.INTEGER:
                    return {
                      type: (() => {
                        switch (field.size) {
                          case 8:
                            return DataTypes.TINYINT;
                          case 16:
                            return DataTypes.SMALLINT;
                          case 24:
                            return DataTypes.MEDIUMINT;
                          default:
                          case 32:
                            return DataTypes.INTEGER;
                          case 64:
                            return DataTypes.BIGINT;
                        }
                      })(),
                    };
                  case DataType.FLOAT:
                    return {
                      type: (() => {
                        switch (field.size) {
                          default:
                          case 32:
                            return DataTypes.FLOAT;
                          case 64:
                            return DataTypes.DOUBLE;
                        }
                      })(),
                    };
                  case DataType.BLOB:
                    return { type: DataTypes.BLOB };
                }
              })(),
              allowNull: field.nullable ?? true,
              unique: field.unique ?? false,
              validate: {
                ...(field.schema && {
                  hasCorrectType: (input: unknown) => {
                    switch (field.dataType) {
                      case DataType.STRING:
                        if (typeof input !== "string") {
                          throw new Error(
                            `Field value for ${fieldName} is not a string`,
                          );
                        }
                        if (
                          field.length !== undefined &&
                          input.length > field.length
                        ) {
                          throw new Error(
                            `Field value for ${fieldName} has length more` +
                              " than allowed maximum",
                          );
                        }
                        break;
                      case DataType.BOOLEAN:
                        if (typeof input !== "boolean") {
                          throw new Error(
                            `Field value for ${fieldName} is not a boolean`,
                          );
                        }
                        break;
                      case DataType.INTEGER: {
                        if (typeof input !== "number" || Number.isNaN(input)) {
                          throw new Error(
                            `Field value for ${fieldName} is not a number`,
                          );
                        }
                        if (input % 1 !== 0) {
                          throw new Error(
                            `Field value for ${fieldName} is not an integer`,
                          );
                        }

                        if (
                          field.size !== undefined &&
                          Math.abs(input) > maxInteger(field.size)
                        ) {
                          throw new Error(
                            `Field value for ${fieldName} does not fit as a` +
                              ` ${field.size} bit integer`,
                          );
                        }
                        break;
                      }
                      case DataType.FLOAT:
                        if (typeof input !== "number") {
                          throw new Error(
                            `Field value for ${fieldName} is not a number`,
                          );
                        }

                        // NOTE: I don't think there's a need to validate size
                        // of floating point numbers as they usually aren't used
                        // absolute precision in mind.
                        break;
                      case DataType.BLOB:
                        if (!(input instanceof Buffer)) {
                          throw new Error(
                            `Field value for ${fieldName} is not a Buffer`,
                          );
                        }
                        break;
                    }
                  },
                  isValid: async (input: unknown) => {
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
                  },
                }),
              },
            } satisfies ModelAttributes[string],
          }),
          {},
        );
        const model = sequelize.define(options.name, columns, {
          timestamps: false,
        });

        return {
          create: async (values) => {
            await synchronized;
            const instance = await model.create(values);
            return toDocument(instance);
          },
          find: async (options) => {
            await synchronized;
            const instances = await model.findAll({
              where: options?.where ? transformWhere(options.where) : undefined,
              order: options?.order,
              limit: options?.limit,
              offset: options?.offset,
            });
            return instances.map(toDocument);
          },
          count: async (options) => {
            await synchronized;
            const count = await model.count({
              where: options?.where ? transformWhere(options.where) : undefined,
            });
            return count;
          },
        };
      },
    };
  });