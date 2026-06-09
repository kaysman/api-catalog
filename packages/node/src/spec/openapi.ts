/** Minimal OpenAPI 3.x type definitions — covers everything the catalog builder needs. */

export type OpenApiVersion =
  | "3.0.0"
  | "3.0.1"
  | "3.0.2"
  | "3.0.3"
  | "3.1.0";

export interface OpenApiDocument {
  openapi: OpenApiVersion;
  info: InfoObject;
  servers?: ServerObject[];
  paths?: PathsObject;
  components?: ComponentsObject;
  tags?: TagObject[];
  externalDocs?: ExternalDocsObject;
  security?: SecurityRequirementObject[];
}

export interface InfoObject {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: ContactObject;
  license?: LicenseObject;
}

export interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
}

export interface LicenseObject {
  name: string;
  url?: string;
}

export interface ServerObject {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariableObject>;
}

export interface ServerVariableObject {
  enum?: string[];
  default: string;
  description?: string;
}

export type PathsObject = Record<string, PathItemObject>;

export interface PathItemObject {
  summary?: string;
  description?: string;
  get?: OperationObject;
  put?: OperationObject;
  post?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  patch?: OperationObject;
  trace?: OperationObject;
  servers?: ServerObject[];
  parameters?: Array<ParameterObject | ReferenceObject>;
}

export interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: ExternalDocsObject;
  operationId?: string;
  parameters?: Array<ParameterObject | ReferenceObject>;
  requestBody?: RequestBodyObject | ReferenceObject;
  responses?: ResponsesObject;
  deprecated?: boolean;
  security?: SecurityRequirementObject[];
  servers?: ServerObject[];
}

export interface ParameterObject {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  schema?: SchemaObject | ReferenceObject;
  example?: unknown;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  content?: Record<string, MediaTypeObject>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

export interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content: Record<string, MediaTypeObject>;
}

export type ResponsesObject = Record<string | number, ResponseObject | ReferenceObject>;

export interface ResponseObject {
  description: string;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  content?: Record<string, MediaTypeObject>;
  links?: Record<string, LinkObject | ReferenceObject>;
}

export interface MediaTypeObject {
  schema?: SchemaObject | ReferenceObject;
  example?: unknown;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  encoding?: Record<string, EncodingObject>;
}

export interface SchemaObject {
  type?: "string" | "number" | "integer" | "boolean" | "array" | "object" | "null";
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  example?: unknown;
  enum?: unknown[];
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  // string
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  // number / integer
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  multipleOf?: number;
  // array
  items?: SchemaObject | ReferenceObject;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  // object
  properties?: Record<string, SchemaObject | ReferenceObject>;
  additionalProperties?: boolean | SchemaObject | ReferenceObject;
  required?: string[];
  minProperties?: number;
  maxProperties?: number;
  // composition
  allOf?: Array<SchemaObject | ReferenceObject>;
  anyOf?: Array<SchemaObject | ReferenceObject>;
  oneOf?: Array<SchemaObject | ReferenceObject>;
  not?: SchemaObject | ReferenceObject;
  // discriminator
  discriminator?: DiscriminatorObject;
  // inline $ref
  $ref?: string;
}

export interface ReferenceObject {
  $ref: string;
  summary?: string;
  description?: string;
}

export interface DiscriminatorObject {
  propertyName: string;
  mapping?: Record<string, string>;
}

export interface ComponentsObject {
  schemas?: Record<string, SchemaObject | ReferenceObject>;
  responses?: Record<string, ResponseObject | ReferenceObject>;
  parameters?: Record<string, ParameterObject | ReferenceObject>;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  requestBodies?: Record<string, RequestBodyObject | ReferenceObject>;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  securitySchemes?: Record<string, SecuritySchemeObject | ReferenceObject>;
  links?: Record<string, LinkObject | ReferenceObject>;
}

export interface SecuritySchemeObject {
  type: "apiKey" | "http" | "mutualTLS" | "oauth2" | "openIdConnect";
  description?: string;
  name?: string;
  in?: "query" | "header" | "cookie";
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlowsObject;
  openIdConnectUrl?: string;
}

export interface OAuthFlowsObject {
  implicit?: OAuthFlowObject;
  password?: OAuthFlowObject;
  clientCredentials?: OAuthFlowObject;
  authorizationCode?: OAuthFlowObject;
}

export interface OAuthFlowObject {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface TagObject {
  name: string;
  description?: string;
  externalDocs?: ExternalDocsObject;
}

export interface ExternalDocsObject {
  description?: string;
  url: string;
}

export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
}

export interface HeaderObject extends Omit<ParameterObject, "name" | "in"> {}

export interface LinkObject {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, unknown>;
  requestBody?: unknown;
  description?: string;
  server?: ServerObject;
}

export interface EncodingObject {
  contentType?: string;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

export type SecurityRequirementObject = Record<string, string[]>;

export type HttpMethod =
  | "get"
  | "put"
  | "post"
  | "delete"
  | "options"
  | "head"
  | "patch"
  | "trace";
