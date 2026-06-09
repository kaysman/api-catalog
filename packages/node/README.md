# api-catalog — Node.js

Code-first OpenAPI catalog for Express and NestJS. Document routes inline where you define them; the package generates the spec and serves an interactive UI automatically.

```sh
npm install api-catalog
```

---

## Express

```ts
import express from "express";
import { ExpressApiCatalog } from "api-catalog/express";
import { s } from "api-catalog/spec";

const app = express();
const catalog = new ExpressApiCatalog(app, {
  title: "My API",
  version: "1.0.0",
  basePath: "/docs",
  serverUrl: "https://api.example.com",
});

// Register a schema once, reference it everywhere
catalog.spec.schema("User", s.object(
  { id: s.string({ format: "uuid" }), name: s.string(), email: s.string() },
  ["id", "name", "email"],
));

// GET /users — document and register in one call
catalog.get("/users", {
  summary: "List users",
  tags: ["Users"],
  parameters: [
    catalog.queryParam("limit",  s.integer({ minimum: 1, maximum: 100 }), { required: false }),
    catalog.queryParam("offset", s.integer({ minimum: 0 }), { required: false }),
  ],
  responses: {
    200: catalog.jsonResponse("User list", s.array(s.ref("User"))),
  },
}, listUsersHandler);

// POST /users
catalog.post("/users", {
  summary: "Create user",
  tags: ["Users"],
  requestBody: catalog.jsonBody(
    s.object({ name: s.string(), email: s.string() }, ["name", "email"]),
  ),
  responses: {
    201: catalog.jsonResponse("Created", s.ref("User")),
    422: catalog.jsonResponse("Validation error"),
  },
}, createUserHandler);

// GET /users/:id
catalog.get("/users/:id", {
  summary: "Get user by ID",
  tags: ["Users"],
  parameters: [catalog.pathParam("id", s.string({ format: "uuid" }))],
  responses: {
    200: catalog.jsonResponse("User", s.ref("User")),
    404: catalog.jsonResponse("Not found"),
  },
}, getUserHandler);

// Call mount() after all routes are registered
catalog.mount();
// → GET /docs          interactive UI
// → GET /docs/default.json  OpenAPI JSON

app.listen(3000);
```

### With Bearer auth

```ts
catalog.spec.bearerAuth();

catalog.get("/me", {
  summary: "Current user",
  security: [{ bearerAuth: [] }],
  responses: { 200: catalog.jsonResponse("User", s.ref("User")) },
}, meHandler);

catalog.mount();
```

---

## NestJS

No `@nestjs/swagger` needed — `api-catalog` ships its own decorators.

### 1. Annotate controllers

```ts
import { Controller, Get, Post, Body, Param, Query } from "@nestjs/common";
import {
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiResponse,
} from "api-catalog/nestjs";
import { s } from "api-catalog/spec";

@Controller("users")
export class UsersController {
  @Get()
  @ApiOperation({ summary: "List users", tags: ["Users"] })
  @ApiQuery({ name: "limit",  schema: s.integer(), required: false })
  @ApiQuery({ name: "offset", schema: s.integer(), required: false })
  @ApiResponse({ status: 200, description: "User list", schema: s.array(s.ref("User")) })
  findAll(@Query("limit") limit?: number) {
    // ...
  }

  @Post()
  @ApiOperation({ summary: "Create user", tags: ["Users"] })
  @ApiBody({
    schema: s.object(
      { name: s.string(), email: s.string() },
      ["name", "email"],
    ),
  })
  @ApiResponse({ status: 201, description: "Created",          schema: s.ref("User") })
  @ApiResponse({ status: 422, description: "Validation error" })
  create(@Body() dto: CreateUserDto) {
    // ...
  }

  @Get(":id")
  @ApiOperation({ summary: "Get user by ID", tags: ["Users"] })
  @ApiParam({ name: "id", schema: s.string({ format: "uuid" }) })
  @ApiResponse({ status: 200, description: "User",      schema: s.ref("User") })
  @ApiResponse({ status: 404, description: "Not found" })
  findOne(@Param("id") id: string) {
    // ...
  }
}
```

### 2. Mount in `main.ts`

```ts
import { NestFactory } from "@nestjs/core";
import { ApiCatalogAdapter } from "api-catalog/nestjs";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Call after create(), before listen()
  ApiCatalogAdapter.setup("/docs", app, {
    title: "My API",
    version: "1.0.0",
    serverUrl: "https://api.example.com",
  });

  await app.listen(3000);
  // → GET /docs              interactive UI
  // → GET /docs/default.json OpenAPI JSON
}

bootstrap();
```

Only methods decorated with `@ApiOperation` appear in the catalog. Undocumented routes are excluded.

---

## Manual usage (SpecBuilder)

Use `SpecBuilder` directly when you want full control over the document — useful for building a spec from an external source or merging multiple specs.

```ts
import { mountApiCatalog } from "api-catalog";
import { SpecBuilder, s } from "api-catalog/spec";

const spec = new SpecBuilder()
  .title("My API")
  .version("2.0.0")
  .server("https://api.example.com", "Production")
  .bearerAuth()
  .schema("User", s.object({ id: s.string(), name: s.string() }, ["id"]))
  .get("/users", { summary: "List users", responses: { 200: { description: "OK" } } })
  .post("/users", { summary: "Create user", responses: { 201: { description: "Created" } } })
  .build();

mountApiCatalog(app, {
  basePath: "/docs",
  title: "My API",
  scopes: [{ id: "default", label: "My API", document: spec }],
});
```

### Multiple scopes

```ts
mountApiCatalog(app, {
  basePath: "/docs",
  title: "Platform",
  scopes: [
    { id: "tenant",   label: "Tenant API",   document: tenantSpec },
    { id: "platform", label: "Platform API", document: platformSpec },
  ],
});
// → GET /docs/tenant.json
// → GET /docs/platform.json
```

---

## Schema helpers (`s`)

```ts
import { s } from "api-catalog/spec";

s.string()                              // { type: "string" }
s.string({ format: "uuid" })           // { type: "string", format: "uuid" }
s.integer({ minimum: 0 })
s.number()
s.boolean()
s.array(s.ref("User"))                 // { type: "array", items: { $ref: "..." } }
s.object({ name: s.string(), age: s.integer() }, ["name"])
s.ref("User")                          // { $ref: "#/components/schemas/User" }
s.nullable(s.string())                 // { type: "string", nullable: true }
s.enum(["active", "inactive"])
s.oneOf([s.ref("Cat"), s.ref("Dog")])
s.anyOf([s.string(), s.integer()])
s.allOf([s.ref("Base"), s.object({ extra: s.string() })])
```

---

## Helper methods on `ExpressApiCatalog`

| Method | Returns | Notes |
|--------|---------|-------|
| `queryParam(name, schema, opts?)` | `ParameterObject` | `required: false` by default |
| `pathParam(name, schema, opts?)` | `ParameterObject` | `required: true` always |
| `headerParam(name, schema, opts?)` | `ParameterObject` | |
| `jsonBody(schema, description?)` | `RequestBodyObject` | `required: true`, `application/json` |
| `jsonResponse(description, schema?)` | `ResponseObject` | `application/json` when schema present |

---

## Subpath exports

| Import | Contents |
|--------|----------|
| `api-catalog` | `mountApiCatalog`, `renderCatalogHtml`, OpenAPI types |
| `api-catalog/express` | `ExpressApiCatalog`, `ExpressCatalogOptions` |
| `api-catalog/nestjs` | `ApiOperation`, `ApiQuery`, `ApiParam`, `ApiHeader`, `ApiBody`, `ApiResponse`, `ApiCatalogAdapter` |
| `api-catalog/spec` | `SpecBuilder`, `s`, all OpenAPI type definitions |

---

## Peer dependencies

`express` is required for Express usage. `@nestjs/common` and `@nestjs/core` are optional — only needed for the NestJS adapter.

```sh
npm install express
npm install @nestjs/common @nestjs/core  # only for NestJS
```
