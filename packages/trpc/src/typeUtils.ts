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
  ctx: object;
  meta: object;
  errorShape: unknown;
  transformer: unknown;
}>;

export type BuildProcedure<
  Type extends ProcedureType,
  Input,
  Output,
> = Procedure<
  Type,
  ProcedureParams<
    EmptyConfig,
    object,
    Input,
    Input,
    Type extends "subscription" ? Observable<Output, never> : Output,
    Type extends "subscription" ? Observable<Output, never> : Output,
    object
  >
>;

export type BuildRouter<Procedures extends ProcedureRouterRecord> = Router<{
  _config: EmptyConfig;
  router: true;
  procedures: Procedures;
  record: Procedures;
  queries: object;
  mutations: object;
  subscriptions: object;
}>;
