import { resolveApplication } from "@palakit/core";
import { Application } from "@palakit/core/src/__mocks__/Application";
import { DataType, IntegerField, StringField } from "@palakit/db";
import { ConnectOptions } from "mongoose";
import {
  MongooseDocumentStore,
  MongooseDocumentStoreFeature,
} from "../MongooseDocumentStore";

jest.mock("mongoose");
const mockMongoose = jest.requireMock("mongoose");

describe("MongooseDocumentStore", () => {
  const mockConnectionString = "mock-connection-string";
  const mockConnectionOptions = { someKey: "someValue" } as ConnectOptions;
  const resolveApp = async () =>
    (
      await resolveApplication({
        name: "MockMongoApp",
        parts: [
          Application,
          ...MongooseDocumentStoreFeature.configure({
            connectionString: mockConnectionString,
            connectOptions: mockConnectionOptions,
          }),
        ],
      })
    ).resolve(MongooseDocumentStore);

  describe("connect", () => {
    it("can connect to mongoose with correct connection string and options", async () => {
      const ds = await resolveApp();
      expect(mockMongoose.connect).not.toHaveBeenCalled();
      ds.connect();
      expect(mockMongoose.connect).toHaveBeenCalledTimes(1);
      expect(mockMongoose.connect).toHaveBeenLastCalledWith(
        mockConnectionString,
        mockConnectionOptions,
      );
    });
  });

  describe("createCollection", () => {
    const mockCollectionName = "mock-collection-name";
    const mockFields = {
      mockStringField: { dataType: DataType.STRING } satisfies StringField,
      mockIntegerField: { dataType: DataType.INTEGER } satisfies IntegerField,
    };

    const createCollection = async () =>
      (await resolveApp()).createCollection({
        name: mockCollectionName,
        fields: mockFields,
      });

    it("can create a collection with correct name and fields", async () => {
      const col = await createCollection();
      expect(col.name).toEqual(mockCollectionName);
      expect(col.fields).toEqual(mockFields);
    });
  });
});
