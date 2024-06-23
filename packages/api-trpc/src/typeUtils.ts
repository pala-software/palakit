import {
  Procedure,
  ProcedureParams,
  ProcedureRouterRecord,
  ProcedureType,
  RootConfig,
  Router,
} from "@trpc/server";
import { Observable } from "@trpc/server/observable";

type EmptyConfig = RootConfig<{
  ctx: {};
  meta: {};
  errorShape: unknown;
  transformer: unknown;
}>;

export type BuildProcedure<
  Type extends ProcedureType,
  Input,
  Output
> = Procedure<
  Type,
  ProcedureParams<
    EmptyConfig,
    {},
    Input,
    Input,
    Type extends "subscription" ? Observable<Output, never> : Output,
    Type extends "subscription" ? Observable<Output, never> : Output,
    {}
  >
>;

export type BuildRouter<Procedures extends ProcedureRouterRecord> = Router<{
  _config: EmptyConfig;
  router: true;
  procedures: Procedures;
  record: Procedures;
  queries: {};
  mutations: {};
  subscriptions: {};
}>;
