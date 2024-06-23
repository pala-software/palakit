export type Request<Input = unknown> = {
  input?: Input;
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

export type OperationOptions<Input = unknown, Output = unknown> = {
  handler: (
    request: Request<Input>
  ) => Response<Output> | Promise<Response<Output>>;
  validateInput?: (input: Input) => true | string;
  validateOutput?: (output: Output) => boolean;
};

export type Operation<Input = any, Output = any> = OperationOptions<
  Input,
  Output
> & { type: string };

export type QueryOperationOptions<
  Input = unknown,
  Output = unknown
> = OperationOptions<Input, Output>;

export type QueryOperation<Input = any, Output = any> = QueryOperationOptions<
  Input,
  Output
> & { type: "query" };

export const isQueryOperation = (
  operation: Operation
): operation is QueryOperation => operation.type === "query";

export type MutationOperationOptions<
  Input = unknown,
  Output = unknown
> = OperationOptions<Input, Output>;

export type MutationOperation<
  Input = any,
  Output = any
> = MutationOperationOptions<Input, Output> & { type: "mutation" };

export const isMutationOperation = (
  operation: Operation
): operation is MutationOperation => operation.type === "mutation";

export type Observable<Output = unknown> = (observer: {
  next: (output: Output) => void;
  complete: () => void;
  error: (error: unknown) => void;
}) => () => void;

export type SubscriptionOperationOptions<
  Input = unknown,
  Output = unknown
> = OperationOptions<Input, Observable<Output>>;

export type SubscriptionOperation<
  Input = any,
  Output = any
> = SubscriptionOperationOptions<Input, Output> & { type: "subscription" };

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
  Operations extends OperationRecord = OperationRecord
> = {
  name: string;
  operations: Operations;
};

export type ResourceServerAdapter = {
  start: () => void;
  addEndpoint: (endpoint: ResourceEndpoint) => void;
  generateClient?: () => Promise<void>;
};
