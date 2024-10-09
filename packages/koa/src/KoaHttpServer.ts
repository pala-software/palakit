import {
  Application,
  createConfiguration,
  createFeature,
  createPart,
} from "@palakit/core";
import Koa, { Middleware } from "koa";

export type KoaHttpServerConfiguration = {
  port: number;
  hostname?: string;
};

export const KoaHttpServerConfiguration =
  createConfiguration<KoaHttpServerConfiguration>("KoaHttpServerConfiguration");

export const KoaHttpServer = createPart(
  "HttpServer",
  [KoaHttpServerConfiguration, Application],
  ([config, app]) => {
    const koa = new Koa();

    return {
      start: app.start.on("KoaHttpServer.start", () => {
        koa.listen(config.port, config.hostname);
      }),
      use: <State, Context>(middleware: Middleware<State, Context>) => {
        koa.use(middleware);
      },
    };
  },
);

export const KoaHttpServerFeature = createFeature(
  [KoaHttpServer],
  KoaHttpServerConfiguration,
);
