import { Schema, AdapterResolver } from "@typeschema/main";
import { OutputFrom } from "@typeschema/core";

type FallbackToAny<T> = [T] extends [never] ? any : T;
type FromResourceSchema<T extends ResourceSchema | null> =
  T extends ResourceSchema
    ? FallbackToAny<OutputFrom<AdapterResolver, T["schema"]>>
    : void;

export type Request<Input> = {
  input: Input;
};

export type BaseResponse = {
  response: { type: string; data?: unknown };
};

export const isBaseResponse = (value: unknown): value is BaseResponse =>
  value !== null &&
  typeof value === "object" &&
  "response" in value &&
  value.response !== null &&
  typeof value.response === "object" &&
  "type" in value.response &&
  typeof value.response.type === "string";

export type OkResponse<Output = unknown> = {
  response: Output extends unknown | undefined
    ? { type: "ok"; data?: Output }
    : { type: "ok"; data: Output };
};

export const isOkResponse = (value: unknown): value is OkResponse =>
  isBaseResponse(value) && value.response.type === "ok";

export type ErrorResponse<Output = unknown> = {
  response: { type: "error"; data: Output };
};

export const isErrorResponse = (value: unknown): value is ErrorResponse =>
  isBaseResponse(value) && value.response.type === "error";

export type Response<Output = unknown> =
  | OkResponse<Output>
  | ErrorResponse<Output>;

export const isResponse = (value: unknown): value is Response =>
  isOkResponse(value) || isErrorResponse(value);

export type OperationOptions<
  InputSchema extends ResourceSchema | null,
  OutputSchema extends ResourceSchema | null,
> = {
  input: InputSchema;
  output: OutputSchema;
  handler: (
    request: Request<FromResourceSchema<InputSchema>>
  ) =>
    | Response<FromResourceSchema<OutputSchema>>
    | Promise<Response<FromResourceSchema<OutputSchema>>>;
};

export type Operation<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = OperationOptions<InputSchema, OutputSchema> & { type: string };

export type QueryOperationOptions<
  InputSchema extends ResourceSchema | null,
  OutputSchema extends ResourceSchema | null,
> = OperationOptions<InputSchema, OutputSchema>;

export type QueryOperation<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = QueryOperationOptions<InputSchema, OutputSchema> & { type: "query" };

export const isQueryOperation = (
  operation: Operation
): operation is QueryOperation => operation.type === "query";

export type MutationOperationOptions<
  InputSchema extends ResourceSchema | null,
  OutputSchema extends ResourceSchema | null,
> = OperationOptions<InputSchema, OutputSchema>;

export type MutationOperation<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = MutationOperationOptions<InputSchema, OutputSchema> & { type: "mutation" };

export const isMutationOperation = (
  operation: Operation
): operation is MutationOperation => operation.type === "mutation";

export type Observable<Output = unknown> = (observer: {
  next: (output: Output) => void;
  complete: () => void;
  error: (error: unknown) => void;
}) => () => void;

export type SubscriptionOperationOptions<
  InputSchema extends ResourceSchema | null,
  OutputSchema extends ResourceSchema | null,
> = {
  input: InputSchema | null;
  output: OutputSchema | null;
  handler: (
    request: Request<FromResourceSchema<InputSchema>>
  ) =>
    | Response<Observable<FromResourceSchema<OutputSchema>>>
    | Promise<Response<Observable<FromResourceSchema<OutputSchema>>>>;
};

export type SubscriptionOperation<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = SubscriptionOperationOptions<InputSchema, OutputSchema> & {
  type: "subscription";
};

export const isSubscriptionOperation = (
  operation: Operation
): operation is SubscriptionOperation => operation.type === "subscription";

export type OperationRecord = {
  create?: MutationOperation;
  read?: QueryOperation;
  update?: MutationOperation;
  delete?: MutationOperation;
  [name: string]: Operation | undefined;
};

export type ResourceEndpoint<
  Operations extends OperationRecord = OperationRecord,
> = {
  name: string;
  operations: Operations;
};

export type ResourceSchema = {
  schema: Schema;
  name?: string;
};

export type ResourceServerAdapter = {
  start: () => void;
  addEndpoint: (endpoint: ResourceEndpoint) => void;
  generateClient?: () => Promise<void>;
};
