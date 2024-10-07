import { Application, createPart } from "@palakit/core";
import {
  DataType,
  DocumentStore,
  Collection,
  Where,
  DocumentHandle,
  Shape,
  Field,
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

    const meta = new Map<Collection, { name: string }>();

    return {
      connect: application.start.on(
        "MongooseDocumentStore.connect",
        async () => {
          await mongoose.connect(connectionString, connectOptions);
          setConnected();
        },
      ),

      createCollection: <T extends Shape>(options: {
        name: string;
        fields: Record<string, Field>;
      }): Collection<T> => {
        const Model = mongoose.model(
          options.name,
          new mongoose.Schema(
            Object.entries(options.fields).reduce<SchemaDefinition>(
              (obj, [name, field]) => ({
                ...obj,
                [name]: {
                  ...(() => {
                    switch (field.dataType) {
                      case DataType.STRING:
                        return { type: String };
                      case DataType.INTEGER:
                      case DataType.FLOAT:
                        return { type: Number };
                      case DataType.BOOLEAN:
                        return { type: Boolean };
                      case DataType.DATE:
                        return { type: Date };
                      case DataType.BLOB:
                        return { type: Blob };
                      case DataType.REFERENCE:
                        return {
                          type: mongoose.Schema.Types.ObjectId,
                          ref: meta.get(field.targetCollection)?.name,
                        };
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

        const toDocument = <T extends Shape>(m: mongoose.Document) =>
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

        const transformWhere = <T extends Shape>(
          where: Where<T>,
        ): FilterQuery<object> => {
          if (where.and) {
            return {
              and: where.and.map((w) => transformWhere<T>(w)),
            };
          }

          if (where.or) {
            return {
              or: where.or.map((w) => transformWhere<T>(w)),
            };
          }

          const conditions: FilterQuery<object>[] = [];
          for (const field of Object.keys(where)) {
            if (["and", "or"].includes(field)) {
              continue;
            }

            const condition = where[field];
            if (!condition) {
              continue;
            }
            const key = field === "id" ? "_id" : field;
            if ("equals" in condition) {
              conditions.push({ [key]: { ["$eq"]: condition.equals } });
            }
            if ("notEquals" in condition) {
              conditions.push({ [key]: { ["$ne"]: condition.notEquals } });
            }
            if ("is" in condition && condition.is === null) {
              conditions.push({ [key]: { ["$eq"]: null } });
            }
            if ("isNot" in condition && condition.isNot === null) {
              conditions.push({ [key]: { ["$ne"]: null } });
            }
            if ("in" in condition) {
              conditions.push({ [key]: { ["$in"]: condition.in } });
            }
            if ("notIn" in condition) {
              conditions.push({ [key]: { ["$nin"]: condition.notIn } });
            }
            if ("like" in condition && condition.like) {
              conditions.push({
                [key]: { ["$regex"]: toRegex(condition.like) },
              });
            }
            if ("notLike" in condition && condition.notLike) {
              conditions.push({
                [key]: { ["$not"]: toRegex(condition.notLike) },
              });
            }
            if ("gt" in condition) {
              conditions.push({ [key]: { ["$gt"]: condition.gt } });
            }
            if ("gte" in condition) {
              conditions.push({ [key]: { ["$gte"]: condition.gte } });
            }
            if ("lt" in condition) {
              conditions.push({ [key]: { ["$lt"]: condition.lt } });
            }
            if ("lte" in condition) {
              conditions.push({ [key]: { ["$lte"]: condition.lte } });
            }
          }
          return { $and: conditions };
        };

        const collection: Collection<T> = {
          create: async (values) => {
            await connected;
            return toDocument<T>(await new Model(values).save());
          },
          find: async (options) => {
            await connected;
            return (
              await Model.find(
                options && "where" in options && options.where
                  ? transformWhere<T>(options.where)
                  : {},
                {},
                { limit: options?.limit, skip: options?.offset },
              ).sort(
                options?.order?.map((item) => [
                  item[0],
                  item[1].toLowerCase() as "asc" | "desc",
                ]),
              )
            ).map(toDocument<T>);
          },
          count: async (options) => {
            await connected;
            return await Model.countDocuments(
              options && "where" in options && options.where
                ? transformWhere<T>(options.where)
                : {},
            );
          },
        };

        meta.set(collection, { name: options.name });

        return collection;
      },
    };
  });
