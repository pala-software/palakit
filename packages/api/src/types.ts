import { Schema, InferIn, Infer } from "@typeschema/main";
import { Function } from "@pala/core";

export type ResourceSchema = {
  schema: Schema;
  name?: string;
};

export type InputFromResourceSchema<T extends ResourceSchema | null> =
  T extends ResourceSchema ? InferIn<T["schema"]> : void;
export type OutputFromResourceSchema<T extends ResourceSchema | null> =
  T extends ResourceSchema ? Infer<T["schema"]> : void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Request<Input = any> = {
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

export type ErrorResponse = {
  response: { type: "error"; data?: string };
};

export const isErrorResponse = (value: unknown): value is ErrorResponse =>
  isBaseResponse(value) && value.response.type === "error";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Response<Output = any> = OkResponse<Output> | ErrorResponse;

export const isResponse = (value: unknown): value is Response =>
  isOkResponse(value) || isErrorResponse(value);

export type OperationOptions<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = {
  input: InputSchema;
  output: OutputSchema;
  handler: (request: Request) => Response | Promise<Response>;
};

export type TypedOperationOptions<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = OperationOptions<InputSchema, OutputSchema> & {
  type: string;
};

export type Operation<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = {
  type: string;
  input: InputSchema;
  output: OutputSchema;
  handler: Function<[Request], Response | Promise<Response>>;
};

export type QueryOperationOptions<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = {
  input: InputSchema;
  output: OutputSchema;
  handler: (
    request: Request<OutputFromResourceSchema<InputSchema>>,
  ) =>
    | Response<InputFromResourceSchema<OutputSchema>>
    | Promise<Response<InputFromResourceSchema<OutputSchema>>>;
};

export type TypedQueryOperationOptions<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = QueryOperationOptions<InputSchema, OutputSchema> & {
  type: "query";
};

export type QueryOperation<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = {
  type: "query";
  input: InputSchema;
  output: OutputSchema;
  handler: Function<
    [Request<OutputFromResourceSchema<InputSchema>>],
    | Response<InputFromResourceSchema<OutputSchema>>
    | Promise<Response<InputFromResourceSchema<OutputSchema>>>
  >;
};

export const isQueryOperation = (
  operation: Operation,
): operation is QueryOperation => operation.type === "query";

export type MutationOperationOptions<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = {
  input: InputSchema;
  output: OutputSchema;
  handler: (
    request: Request<OutputFromResourceSchema<InputSchema>>,
  ) =>
    | Response<InputFromResourceSchema<OutputSchema>>
    | Promise<Response<InputFromResourceSchema<OutputSchema>>>;
};

export type TypedMutationOperationOptions<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = MutationOperationOptions<InputSchema, OutputSchema> & {
  type: "mutation";
};

export type MutationOperation<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = {
  type: "mutation";
  input: InputSchema;
  output: OutputSchema;
  handler: Function<
    [Request<OutputFromResourceSchema<InputSchema>>],
    | Response<InputFromResourceSchema<OutputSchema>>
    | Promise<Response<InputFromResourceSchema<OutputSchema>>>
  >;
};

export const isMutationOperation = (
  operation: Operation,
): operation is MutationOperation => operation.type === "mutation";

export type Observable<Output = unknown> = (observer: {
  next: (output: Output) => void;
  complete: () => void;
  error: (error: unknown) => void;
}) => () => void;

export type SubscriptionOperationOptions<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = {
  input: InputSchema | null;
  output: OutputSchema | null;
  handler: (
    request: Request<OutputFromResourceSchema<InputSchema>>,
  ) =>
    | Response<Observable<OutputFromResourceSchema<OutputSchema>>>
    | Promise<Response<Observable<OutputFromResourceSchema<OutputSchema>>>>;
};

export type TypedSubscriptionOperationOptions<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = SubscriptionOperationOptions<InputSchema, OutputSchema> & {
  type: "subscription";
};

export type SubscriptionOperation<
  InputSchema extends ResourceSchema | null = ResourceSchema | null,
  OutputSchema extends ResourceSchema | null = ResourceSchema | null,
> = {
  type: "subscription";
  input: InputSchema | null;
  output: OutputSchema | null;
  handler: Function<
    [Request<OutputFromResourceSchema<InputSchema>>],
    | Response<Observable<OutputFromResourceSchema<OutputSchema>>>
    | Promise<Response<Observable<OutputFromResourceSchema<OutputSchema>>>>
  >;
};

export const isSubscriptionOperation = (
  operation: Operation,
): operation is SubscriptionOperation => operation.type === "subscription";

export type TypedOperationOptionRecord = Record<string, TypedOperationOptions>;

export type OperationRecord = Record<string, Operation>;

export type OperationRecordFromOptions<T extends TypedOperationOptionRecord> = {
  [K in keyof T]: T[K] extends TypedQueryOperationOptions<
    infer InputSchema,
    infer OutputSchema
  >
    ? QueryOperation<InputSchema, OutputSchema>
    : T[K] extends TypedMutationOperationOptions<
          infer InputSchema,
          infer OutputSchema
        >
      ? MutationOperation<InputSchema, OutputSchema>
      : T[K] extends TypedSubscriptionOperationOptions<
            infer InputSchema,
            infer OutputSchema
          >
        ? SubscriptionOperation<InputSchema, OutputSchema>
        : never;
};

export type ResourceEndpointOptions<
  Operations extends TypedOperationOptionRecord = TypedOperationOptionRecord,
> = {
  name: string;
  operations: Operations;
};

export type ResourceEndpoint<
  Operations extends OperationRecord = OperationRecord,
> = {
  name: string;
  operations: Operations;
  operation: {
    before: (
      hookName: string,
      hook: (data: { operation: string; request: Request }) => Request,
    ) => void;
    after: (
      hookName: string,
      hook: (data: {
        operation: string;
        request: Request;
        response: Response;
      }) => Response,
    ) => void;
  };
};

export type ResourceEndpointFromOptions<T extends ResourceEndpointOptions> = {
  name: string;
  operations: OperationRecordFromOptions<T["operations"]>;
  operation: {
    before: (
      hookName: string,
      hook: (data: { operation: string; request: Request }) => Request,
    ) => void;
    after: (
      hookName: string,
      hook: (data: {
        operation: string;
        request: Request;
        response: Response;
      }) => Response,
    ) => void;
  };
};

export type ResourceServerAdapter = {
  start: () => void;
  addEndpoint: (endpoint: ResourceEndpoint) => void;
  generateClient?: () => Promise<void>;
};
