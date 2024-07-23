import { Schema, AdapterResolver } from "@typeschema/main";
import { OutputFrom } from "@typeschema/core";

type FallbackToAny<T> = [T] extends [never] ? any : T;
type FromInputSchema<T extends Schema | null> = T extends Schema
  ? FallbackToAny<OutputFrom<AdapterResolver, T>>
  : void;
type FromOutputSchema<T extends Schema | null> = T extends Schema
  ? FallbackToAny<OutputFrom<AdapterResolver, T>>
  : unknown;

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
  InputSchema extends Schema | null,
  OutputSchema extends Schema | null,
> = {
  input: InputSchema;
  output: OutputSchema;
  handler: (
    request: Request<FromInputSchema<InputSchema>>
  ) =>
    | Response<FromOutputSchema<OutputSchema>>
    | Promise<Response<FromOutputSchema<OutputSchema>>>;
};

export type Operation<
  InputSchema extends Schema | null = any,
  OutputSchema extends Schema | null = any,
> = OperationOptions<InputSchema, OutputSchema> & { type: string };

export type QueryOperationOptions<
  InputSchema extends Schema | null,
  OutputSchema extends Schema | null,
> = OperationOptions<InputSchema, OutputSchema>;

export type QueryOperation<
  InputSchema extends Schema | null = any,
  OutputSchema extends Schema | null = any,
> = QueryOperationOptions<InputSchema, OutputSchema> & { type: "query" };

export const isQueryOperation = (
  operation: Operation
): operation is QueryOperation => operation.type === "query";

export type MutationOperationOptions<
  InputSchema extends Schema | null,
  OutputSchema extends Schema | null,
> = OperationOptions<InputSchema, OutputSchema>;

export type MutationOperation<
  InputSchema extends Schema | null = any,
  OutputSchema extends Schema | null = any,
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
  InputSchema extends Schema | null,
  OutputSchema extends Schema | null,
> = {
  input: InputSchema | null;
  output: OutputSchema | null;
  handler: (
    request: Request<FromInputSchema<InputSchema>>
  ) =>
    | Response<Observable<FromOutputSchema<OutputSchema>>>
    | Promise<Response<Observable<FromOutputSchema<OutputSchema>>>>;
};

export type SubscriptionOperation<
  InputSchema extends Schema | null = any,
  OutputSchema extends Schema | null = any,
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
  name?: string;
  schema: Schema;
} | null;

export type ResourceServerAdapter = {
  start: () => void;
  addEndpoint: (endpoint: ResourceEndpoint) => void;
  generateClient?: () => Promise<void>;
};
