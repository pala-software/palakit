import { Application, createPart } from "@palakit/core";
import {
  DataType,
  DocumentStore,
  Collection,
  Where,
  DocumentHandle,
} from "@palakit/db";
import { validate } from "@typeschema/main";
import mongoose, {
  ConnectOptions,
  FilterQuery,
  SchemaDefinition,
} from "mongoose";

export const createMongooseDocumentStore = ({
  connectionString,
  connectOptions = {},
}: {
  connectionString: string;
  connectOptions?: ConnectOptions;
}) =>
  createPart(DocumentStore, [Application], ([application]) => {
    let setConnected: () => void;
    const connected = new Promise<void>((resolve) => {
      setConnected = resolve;
    });

    return {
      connect: application.start.on(
        "MongooseDocumentStore.connect",
        async () => {
          await mongoose.connect(connectionString, connectOptions);
          setConnected();
        },
      ),

      createCollection: (options) => {
        const Model = mongoose.model(
          options.name,
          new mongoose.Schema(
            Object.entries(options.fields).reduce<SchemaDefinition>(
              (obj, [name, field]) => ({
                ...obj,
                [name]: {
                  type: (() => {
                    switch (field.dataType) {
                      case DataType.STRING:
                        return String;
                      case DataType.INTEGER:
                      case DataType.FLOAT:
                        return Number;
                      case DataType.BOOLEAN:
                        return Boolean;
                      case DataType.BLOB:
                        return Blob;
                    }
                  })(),
                  allowNull: field.nullable ?? true,
                  unique: field.unique ?? false,
                  validate: async (value: unknown) => {
                    if (!field.schema) {
                      return true;
                    }

                    const result = await validate(field.schema, value);
                    if (!result.success) {
                      throw new Error(
                        "issues:\n" +
                          result.issues
                            .map(
                              ({ message, path }) =>
                                ` - ${message}` +
                                (path?.length ? ` (at ${path.join(".")})` : ""),
                            )
                            .join("\n"),
                      );
                    }

                    return true;
                  },
                },
              }),
              {},
            ),
            { minimize: false },
          ),
        );

        const toDocument = <T extends Collection>(m: mongoose.Document) =>
          ({
            get: async () => {
              const { _id, ...values } = m.toObject({
                versionKey: false,
                flattenObjectIds: true,
              });
              return {
                ...values,
                id: _id,
              } as T;
            },
            update: async (values: Partial<T>) => {
              const updatedDocument = await Model.findOneAndUpdate(
                { _id: m._id },
                values,
                { runValidators: true, new: true },
              );
              if (!updatedDocument) {
                throw new Error("Could not find update document");
              }
              m = updatedDocument;
            },
            delete: async () => {
              await m.deleteOne();
            },
          }) as DocumentHandle<T>;

        const toRegex = (likeExpression: string) =>
          new RegExp(
            `^${likeExpression
              .replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&")
              .replace(/%/g, ".*")
              .replace(/_/g, ".")}$`,
            "i",
          );

        const transformWhere = <T extends Collection>(where: Where<T>) => {
          const transformed: FilterQuery<object> = {};
          if (where.and) {
            transformed.and = transformWhere<T>(where.and);
          }
          if (where.or) {
            transformed.or = transformWhere<T>(where.or);
          }
          for (const fieldName of Object.keys(where)) {
            if (["and", "or"].includes(fieldName)) {
              continue;
            }
            const condition = where[fieldName];
            if (!condition) {
              continue;
            }
            const field = fieldName === "id" ? "_id" : fieldName;
            transformed[field] = {};
            if ("equals" in condition) {
              transformed[field]["$eq"] = condition.equals;
            }
            if ("notEquals" in condition) {
              transformed[field]["$ne"] = condition.notEquals;
            }
            if ("is" in condition && condition.is === null) {
              transformed[field]["$eq"] = null;
            }
            if ("isNot" in condition && condition.isNot === null) {
              transformed[field]["$ne"] = null;
            }
            if ("in" in condition) {
              transformed[field]["$in"] = condition.in;
            }
            if ("notIn" in condition) {
              transformed[field]["$nin"] = condition.notIn;
            }
            if ("like" in condition && condition.like) {
              transformed[field]["$regex"] = toRegex(condition.like);
            }
            if ("notLike" in condition && condition.notLike) {
              transformed[field]["$not"] = toRegex(condition.notLike);
            }
            if ("gt" in condition) {
              transformed[field]["$gt"] = condition.gt;
            }
            if ("gte" in condition) {
              transformed[field]["$gte"] = condition.gte;
            }
            if ("lt" in condition) {
              transformed[field]["$lt"] = condition.lt;
            }
            if ("lte" in condition) {
              transformed[field]["$lte"] = condition.lte;
            }
          }
          return transformed;
        };

        return {
          create: async (values) => {
            await connected;
            return toDocument(await new Model(values).save());
          },
          find: async (options) => {
            await connected;
            return (
              await Model.find(
                options && "where" in options && options.where
                  ? transformWhere(options.where)
                  : {},
                {},
                { limit: options?.limit, skip: options?.offset },
              ).sort(
                options?.order?.map((item) => [
                  item[0],
                  item[1].toLowerCase() as "asc" | "desc",
                ]),
              )
            ).map((i) => toDocument(i));
          },
          count: async (options) => {
            await connected;
            return await Model.countDocuments(
              options && "where" in options && options.where
                ? transformWhere(options.where)
                : {},
            );
          },
        };
      },
    };
  });
