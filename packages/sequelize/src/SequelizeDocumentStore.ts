import {
  Application,
  createConfiguration,
  createFeature,
  createPart,
  LocalRuntime,
} from "@palakit/core";
import {
  Collection,
  DocumentHandle,
  DocumentStore,
  DocumentStoreUtils,
  Field,
  Shape,
  Where,
} from "@palakit/db";
import {
  DataTypes,
  Model,
  ModelAttributes,
  ModelStatic,
  Op,
  Options,
  Sequelize,
  WhereOptions,
} from "sequelize";

export type SequelizeDocumentStoreConfiguration = Options;

export const SequelizeDocumentStoreConfiguration =
  createConfiguration<SequelizeDocumentStoreConfiguration>(
    "SequelizeDocumentStoreConfiguration",
  );

export const SequelizeConnection = createPart(
  "SequelizeConnection",
  [SequelizeDocumentStoreConfiguration],
  ([config]) => new Sequelize(config),
);

export const SequelizeDocumentStore = createPart(
  DocumentStore,
  [SequelizeConnection, Application, LocalRuntime, DocumentStoreUtils],
  ([sequelize, application, runtime, utils]) => {
    const meta = new Map<Collection, { model: ModelStatic<Model> }>();

    const toDocument = <T extends Shape>(instance: Model) =>
      ({
        get: async () => {
          return instance.get();
        },
        update: async (values) => {
          await instance.update(values);
        },
        delete: async () => {
          await instance.destroy();
        },
      }) as DocumentHandle<T>;

    const transformWhere = <T extends Shape>(where: Where<T>): WhereOptions => {
      if (where.and) {
        return {
          [Op.and]: where.and.map((where) => transformWhere<T>(where)),
        };
      }

      if (where.or) {
        return {
          [Op.and]: where.or.map((where) => transformWhere<T>(where)),
        };
      }

      const conditions: WhereOptions[] = [];
      for (const field of Object.keys(where)) {
        if (["and", "or"].includes(field)) {
          continue;
        }
        const condition = where[field as Exclude<keyof Where<T>, "and" | "or">];
        if (!condition) {
          continue;
        }
        if ("equals" in condition) {
          conditions.push({ [field]: { [Op.eq]: condition.equals } });
        }
        if ("notEquals" in condition) {
          conditions.push({ [field]: { [Op.ne]: condition.notEquals } });
        }
        if ("is" in condition) {
          conditions.push({ [field]: { [Op.is]: condition.is } });
        }
        if ("isNot" in condition) {
          conditions.push({ [field]: { [Op.not]: condition.isNot } });
        }
        if ("in" in condition) {
          conditions.push({ [field]: { [Op.in]: condition.in } });
        }
        if ("notIn" in condition) {
          conditions.push({ [field]: { [Op.notIn]: condition.notIn } });
        }
        if ("like" in condition) {
          conditions.push({ [field]: { [Op.like]: condition.like } });
        }
        if ("notLike" in condition) {
          conditions.push({ [field]: { [Op.notLike]: condition.notLike } });
        }
        if ("gt" in condition) {
          conditions.push({ [field]: { [Op.gt]: condition.gt } });
        }
        if ("gte" in condition) {
          conditions.push({ [field]: { [Op.gte]: condition.gte } });
        }
        if ("lt" in condition) {
          conditions.push({ [field]: { [Op.lt]: condition.lt } });
        }
        if ("lte" in condition) {
          conditions.push({ [field]: { [Op.lte]: condition.lte } });
        }
      }
      return { [Op.and]: conditions };
    };

    const toColumns = (fields: Record<string, Field>) =>
      Object.entries(fields).reduce<ModelAttributes>(
        (obj, [fieldName, field]) => ({
          ...obj,
          [fieldName]: {
            ...(() => {
              switch (field.dataType) {
                case "string":
                  if (field.length === undefined) {
                    return { type: DataTypes.TEXT };
                  }
                  return { type: DataTypes.STRING(field.length) };
                case "boolean":
                  return { type: DataTypes.BOOLEAN };
                case "integer":
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
                case "float":
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
                case "date":
                  return { type: DataTypes.DATE };
                case "blob":
                  return { type: DataTypes.BLOB };
                case "reference":
                  return {
                    type: DataTypes.INTEGER,
                    references: {
                      model: meta.get(field.targetCollection)?.model,
                      key: "id",
                    },
                    get() {
                      return this.getDataValue(fieldName).toString();
                    },
                    set(value: string) {
                      this.setDataValue(fieldName, +value);
                    },
                  };
              }
            })(),
            allowNull: field.nullable ?? true,
            unique: field.unique ?? false,
            validate: {
              isValid: (input: unknown) =>
                utils.validateField({ ...field, name: fieldName }, input),
            },
          } satisfies ModelAttributes[string],
        }),
        {
          id: {
            type: DataTypes.UUIDV4,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
          },
        },
      );

    return {
      connect: application.start.on(
        "SequelizeDocumentStore.connect",
        async () => {
          await sequelize.authenticate();
        },
      ),
      disconnect: runtime.createFunction(
        "SequelizeDocumentStore.disconnect",
        async () => {
          await sequelize.close();
        },
      ),
      createCollection: (options) => {
        const fields: Record<string, Field> = {};
        let model: ModelStatic<Model>;

        const collection: Collection<Record<string, Field>> = {
          name: options.name,
          fields,
          addField: ({ name, ...field }) => {
            fields[name] = field as Field;
            updateModel();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return collection as any;
          },
          removeField: (name) => {
            delete fields[name];
            updateModel();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return collection as any;
          },
          sync: async () => {
            await model.sync();
            return collection;
          },
          create: async (values) => {
            const instance = await model.create(values);
            return toDocument(instance);
          },
          find: async (options) => {
            const instances = await model.findAll({
              where: options?.where ? transformWhere(options.where) : undefined,
              order: options?.order,
              limit: options?.limit,
              offset: options?.offset,
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return instances.map(toDocument) as any;
          },
          count: async (options) => {
            const count = await model.count({
              where: options?.where ? transformWhere(options.where) : undefined,
            });
            return count;
          },
        };

        const updateModel = () => {
          model = sequelize.define(options.name, toColumns(fields), {
            timestamps: false,
          });
          meta.set(collection as Collection, { model });
        };
        updateModel();

        return collection;
      },
    };
  },
);

export const SequelizeDocumentStoreFeature = createFeature(
  [SequelizeConnection, SequelizeDocumentStore, DocumentStoreUtils],
  SequelizeDocumentStoreConfiguration,
);
