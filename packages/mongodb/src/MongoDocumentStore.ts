import {
  Application,
  createConfiguration,
  createFeature,
  createPart,
  LocalRuntime,
} from "@palakit/core";
import {
  DocumentStore,
  Collection,
  Where,
  Shape,
  Field,
  DocumentHandle,
  DocumentStoreUtils,
} from "@palakit/db";
import {
  Document as MongoDocument,
  Filter,
  MongoClient,
  MongoClientOptions,
} from "mongodb";

export type MongoDocumentStoreConfiguration = {
  url: string;
  options?: MongoClientOptions;
};

type Document = MongoDocument & { _id?: string };

export const MongoDocumentStoreConfiguration =
  createConfiguration<MongoDocumentStoreConfiguration>(
    "MongoDocumentStoreConfiguration",
  );

export const MongoConnection = createPart(
  "MongoConnection",
  [MongoDocumentStoreConfiguration],
  ([config]) => new MongoClient(config.url, config.options),
);

export const MongoDocumentStore = createPart(
  DocumentStore,
  [MongoConnection, Application, LocalRuntime, DocumentStoreUtils],
  ([client, application, runtime, utils]) => {
    const db = client.db(undefined);
    const meta = new Map<Collection, { name: string }>();

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
    ): Filter<Document> => {
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

      const conditions: Filter<Document>[] = [];
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

    return {
      connect: application.start.on("MongoDocumentStore.connect", async () => {
        await client.connect();
      }),

      disconnect: runtime.createFunction(
        "MongoDocumentStore.disconnect",
        async () => {
          await client.close();
        },
      ),

      createCollection: (options) => {
        const col = db.collection<Document>(options.name);
        const fields: Record<string, Field> = {};

        const toDocument = <T extends Shape>(_id: string) =>
          ({
            get: async () => {
              const values: Document | null = await col.findOne({ _id });
              if (!values) {
                throw new Error("Could not find document");
              }

              for (const fieldName in fields) {
                await utils.validateFieldType(
                  { ...fields[fieldName], name: fieldName },
                  values[fieldName],
                );
                if (fields[fieldName].deserialize) {
                  values[fieldName] = await fields[fieldName].deserialize(
                    values[fieldName],
                  );
                }
                await utils.validateFieldSchema(
                  { ...fields[fieldName], name: fieldName },
                  values[fieldName],
                );
              }
              for (const fieldName in values) {
                if (fieldName === "_id") {
                  continue;
                }
                if (!(fieldName in fields)) {
                  throw new Error("Unexpected value in unknown field");
                }
              }

              values.id = values._id;
              delete values._id;
              return values as T;
            },
            update: async (values: Record<string, unknown>) => {
              for (const fieldName in values) {
                if (fieldName === "id") {
                  throw new Error("ID field cannot be updated");
                }
                if (!(fieldName in fields)) {
                  throw new Error("Unexpected value for unknown field");
                }

                await utils.validateFieldSchema(
                  { ...fields[fieldName], name: fieldName },
                  values[fieldName],
                );
                if (fields[fieldName].serialize) {
                  values[fieldName] = await fields[fieldName].serialize(
                    values[fieldName],
                  );
                }
                await utils.validateFieldType(
                  { ...fields[fieldName], name: fieldName },
                  values[fieldName],
                );
              }

              await col.updateOne({ _id }, { $set: values });
            },
            delete: async () => {
              await col.deleteOne({ _id });
            },
          }) as DocumentHandle<T>;

        const collection: Collection<Record<string, Field>> = {
          name: options.name,
          fields,
          addField: ({ name, ...field }) => {
            fields[name] = field as Field;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return collection as any;
          },
          removeField: (name) => {
            delete fields[name];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return collection as any;
          },
          sync: async () => {
            // Sync is not needed.
            return collection;
          },
          create: async (values: Record<string, unknown>) => {
            for (const fieldName in fields) {
              await utils.validateFieldSchema(
                { ...fields[fieldName], name: fieldName },
                values[fieldName],
              );
              if (fields[fieldName].serialize) {
                values[fieldName] = await fields[fieldName].serialize(
                  values[fieldName],
                );
              }
              await utils.validateFieldType(
                { ...fields[fieldName], name: fieldName },
                values[fieldName],
              );
            }
            for (const fieldName in values) {
              if (fieldName === "id") {
                continue;
              }
              if (!(fieldName in fields)) {
                throw new Error("Unexpected value for unknown field");
              }
            }

            const id = (values.id as string | undefined) ?? crypto.randomUUID();
            values._id = id;
            delete values.id;
            await col.insertOne(values, { forceServerObjectId: false });
            return toDocument(id);
          },
          find: async (options) => {
            const cursor = col
              .find(options?.where ? transformWhere(options.where) : {}, {
                limit: options?.limit,
                skip: options?.offset,
              })
              .project(
                // Exclude all the fields, returning only the _id field.
                Object.keys(fields).reduce((projection, key) => {
                  projection[key] = 0;
                  return projection;
                }, {} as Document),
              );
            if (options?.order) {
              cursor.sort(
                options.order.map<[string, "asc" | "desc"]>((item) => [
                  item[0],
                  item[1].toLowerCase() as "asc" | "desc",
                ]),
              );
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return cursor.map(({ _id }) => toDocument(_id)).toArray() as any;
          },
          count: async (options) => {
            return col.countDocuments(
              options?.where ? transformWhere(options.where) : {},
            );
          },
        };

        meta.set(collection, { name: options.name });

        return collection;
      },
    };
  },
);

export const MongoDocumentStoreFeature = createFeature(
  [MongoConnection, MongoDocumentStore, DocumentStoreUtils],
  MongoDocumentStoreConfiguration,
);
