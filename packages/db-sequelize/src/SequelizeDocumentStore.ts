import { Application, createPart } from "@pala/core";
import { DocumentStore, Document, Collection, Where } from "@pala/db";
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
      Object.defineProperties(
        {
          save: async () => {
            await instance.save();
          },
          delete: async () => {
            await instance.destroy();
          },
        },
        Object.keys(instance.dataValues).reduce(
          (obj, key) => ({
            ...obj,
            [key]: {
              get: () => {
                return instance.get(key);
              },
              set: (value: unknown) => {
                instance.set(key, value);
              },
            },
          }),
          {}
        )
      ) as Document<T>;

    const transformWhere = <T extends Collection>(where: Where<T>) => {
      const transformed: WhereAttributeHash = {};
      if (where.and) {
        transformed.and = transformWhere<T>(where.and);
      }
      if (where.or) {
        transformed.or = transformWhere<T>(where.or);
      }
      for (const field of Object.keys(where)) {
        if (["and", "or"].includes(field)) {
          continue;
        }
        const condition = where[field];
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

    return {
      connect: application.start.on(
        "SequelizeDocumentStore.connect",
        async () => {
          await sequelize.sync();
          setSynchronized();
        }
      ),
      createCollection: (options) => {
        let columns = Object.entries(options.fields).reduce(
          (obj, [name, field]) => ({
            ...obj,
            [name]: {
              type: (() => {
                switch (field.type) {
                  case "text":
                    return DataTypes.STRING;
                  case "number":
                    return DataTypes.NUMBER;
                  case "boolean":
                    return DataTypes.BOOLEAN;
                }
              })(),
              allowNull: field.nullable ?? true,
              unique: field.unique ?? false,
            } satisfies ModelAttributes[string],
          }),
          {}
        );
        const model = sequelize.define(options.name, columns);

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
