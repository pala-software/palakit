import { createPart } from "@palakit/core";
import { Collection, DocumentStore } from "@palakit/db";
import { AdapterFactory } from "oidc-provider";

const models = [
  "Session",
  "AccessToken",
  "AuthorizationCode",
  "RefreshToken",
  "DeviceCode",
  "ClientCredentials",
  "Client",
  "InitialAccessToken",
  "RegistrationAccessToken",
  "Interaction",
  "ReplayDetection",
  "PushedAuthorizationRequest",
  "Grant",
  "BackchannelAuthenticationRequest",
] as const;

const grantable = [
  "AccessToken",
  "AuthorizationCode",
  "RefreshToken",
  "DeviceCode",
  "BackchannelAuthenticationRequest",
] satisfies (typeof models)[number][];

export const OidcProviderDatabaseAdapter = createPart(
  "OidcProviderDatabaseAdapter",
  [DocumentStore],
  ([db]): AdapterFactory => {
    const collections = new Map<
      string,
      Collection<{
        grantId?: { dataType: "string"; nullable: false };
        userCode?: { dataType: "string"; nullable: false };
        uid?: { dataType: "string"; nullable: false };
        data: { dataType: "string"; nullable: false };
        expiresAt: { dataType: "date"; nullable: false };
        consumedAt: { dataType: "date"; nullable: true };
      }>
    >();
    for (const name of models) {
      const collection = db
        .createCollection({ name: "oidc" + name })
        .addField({ name: "data", dataType: "string", nullable: false })
        .addField({
          name: "expiresAt",
          dataType: "date",
          nullable: false,
        })
        .addField({
          name: "consumedAt",
          dataType: "date",
          nullable: true,
        });

      if ((grantable as string[]).includes(name)) {
        collection.addField({
          name: "grantId",
          dataType: "string",
          nullable: false,
        });
      }
      if (name === "DeviceCode") {
        collection.addField({
          name: "userCode",
          dataType: "string",
          nullable: false,
        });
      }
      if (name === "Session") {
        collection.addField({
          name: "uid",
          dataType: "string",
          nullable: false,
        });
      }

      collections.set(name, collection);
    }

    db.connect.after("OidcProviderDatabaseAdapter.dbConnected", async () => {
      for (const collection of collections.values()) {
        await collection.sync();
      }
    });

    return (name) => {
      const collection = collections.get(name);
      if (!collection) {
        throw new Error("Could not find collection");
      }

      return {
        upsert: async (id, data, expiresIn) => {
          const values = {
            data: JSON.stringify(data),
            expiresAt: new Date(Date.now() + expiresIn * 1000),
            ...(data.grantId && { grantId: data.grantId }),
            ...(data.userCode && { userCode: data.userCode }),
            ...(data.uid && { uid: data.uid }),
          };

          const [document] = await collection.find({
            where: { id: { equals: id } },
            limit: 1,
          });
          if (document) {
            await document.update(values);
          } else {
            await collection.create({ id, ...values });
          }
        },

        find: async (id) => {
          const [document] = await collection.find({
            where: { id: { equals: id } },
            limit: 1,
          });
          if (!document) {
            return undefined;
          }

          const values = await document.get();
          return {
            ...JSON.parse(values.data),
            ...(values.consumedAt && { consumed: true }),
          };
        },

        findByUserCode: async (userCode) => {
          const [document] = await collection.find({
            where: { userCode: { equals: userCode } },
            limit: 1,
          });
          if (!document) {
            return undefined;
          }

          const values = await document.get();
          return {
            ...JSON.parse(values.data),
            ...(values.consumedAt && { consumed: true }),
          };
        },

        findByUid: async (uid) => {
          const [document] = await collection.find({
            where: { uid: { equals: uid } },
            limit: 1,
          });
          if (!document) {
            return undefined;
          }

          const values = await document.get();
          return {
            ...JSON.parse(values.data),
            ...(values.consumedAt && { consumed: true }),
          };
        },

        destroy: async (id) => {
          const [document] = await collection.find({
            where: { id: { equals: id } },
            limit: 1,
          });
          if (document) {
            await document.delete();
          }
        },

        consume: async (id) => {
          const [document] = await collection.find({
            where: { id: { equals: id } },
            limit: 1,
          });
          if (document) {
            await document.update({ consumedAt: new Date() });
          }
        },

        revokeByGrantId: async (grantId) => {
          const [document] = await collection.find({
            where: { grantId: { equals: grantId } },
            limit: 1,
          });
          if (document) {
            await document.delete();
          }
        },
      };
    };
  },
);
