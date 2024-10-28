import {
  Application,
  createConfiguration,
  createFeature,
  createPart,
  Resolved,
} from "@palakit/core";
import Koa, { Middleware } from "koa";

export type KoaMiddleware<State, Context> = Middleware<State, Context>;

export type KoaHttpServerConfiguration = {
  port: number;
  hostname?: string;
};

export const KoaHttpServerConfiguration =
  createConfiguration<KoaHttpServerConfiguration>("KoaHttpServerConfiguration");

export const KoaHttpServer = createPart(
  "KoaHttpServer",
  [KoaHttpServerConfiguration, Application],
  ([config, app]) => {
    const koa = new Koa();

    return {
      start: app.start.on("KoaHttpServer.start", () => {
        koa.listen(config.port, config.hostname);
      }),
      use: <State, Context>(middleware: KoaMiddleware<State, Context>) => {
        koa.use(middleware);
      },
    };
  },
);

export type KoaHttpServer = Resolved<typeof KoaHttpServer>;

export const KoaHttpServerFeature = createFeature(
  [KoaHttpServer],
  KoaHttpServerConfiguration,
);
