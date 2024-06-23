import { AdapterResolver, Schema } from "@typeschema/main";
import { OutputFrom } from "@typeschema/core";

type AnyIfNever<T> = [T] extends [never] ? any : T;
type FromSchema<T extends Schema> = AnyIfNever<OutputFrom<AdapterResolver, T>>;

export type Request<Input = unknown> = {
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
  response: { type: "ok"; data: Output };
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
  InputSchema extends Schema,
  OutputSchema extends Schema,
> = {
  handler: (
    request: Request<FromSchema<InputSchema>>
  ) =>
    | Response<FromSchema<OutputSchema>>
    | Promise<Response<FromSchema<OutputSchema>>>;
  input?: InputSchema;
  output?: OutputSchema;
};

export type Operation<
  InputSchema extends Schema = Schema,
  OutputSchema extends Schema = Schema,
> = OperationOptions<InputSchema, OutputSchema> & { type: string };

export type QueryOperationOptions<
  InputSchema extends Schema,
  OutputSchema extends Schema,
> = OperationOptions<InputSchema, OutputSchema>;

export type QueryOperation<
  InputSchema extends Schema = Schema,
  OutputSchema extends Schema = Schema,
> = QueryOperationOptions<InputSchema, OutputSchema> & { type: "query" };

export const isQueryOperation = (
  operation: Operation
): operation is QueryOperation => operation.type === "query";

export type MutationOperationOptions<
  InputSchema extends Schema,
  OutputSchema extends Schema,
> = OperationOptions<InputSchema, OutputSchema>;

export type MutationOperation<
  InputSchema extends Schema = Schema,
  OutputSchema extends Schema = Schema,
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
  InputSchema extends Schema,
  OutputSchema extends Schema,
> = {
  handler: (
    request: Request<FromSchema<InputSchema>>
  ) =>
    | Response<Observable<FromSchema<OutputSchema>>>
    | Promise<Response<Observable<FromSchema<OutputSchema>>>>;
  input?: InputSchema;
  output?: OutputSchema;
};

export type SubscriptionOperation<
  InputSchema extends Schema = any,
  OutputSchema extends Schema = any,
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

export type ResourceServerAdapter = {
  start: () => void;
  addEndpoint: (endpoint: ResourceEndpoint) => void;
  generateClient?: () => Promise<void>;
};
