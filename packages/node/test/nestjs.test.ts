import "reflect-metadata";
import type { AddressInfo } from "node:net";
import { Controller, Get, Module, Param, Post, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiCatalogAdapter,
  ApiOperation,
  ApiParam,
  ApiResponse,
  type ApiCatalogAdapterOptions,
} from "../src/adapters/nestjs.js";
import { s } from "../src/spec/index.js";

@Controller("users")
class UsersController {
  @Get(":id")
  @ApiOperation({ summary: "Get user", tags: ["Users"] })
  @ApiParam({ name: "id", schema: s.string() })
  @ApiResponse({ status: 200, description: "User", schema: s.ref("User") })
  findOne(@Param("id") id: string) {
    return { id };
  }

  @Post()
  @ApiOperation({ summary: "Create user", tags: ["Users"] })
  @ApiResponse({ status: 201, description: "Created" })
  create() {
    return {};
  }

  @Get("internal")
  undocumented() {
    return {};
  }
}

@Controller(["teams", "groups"])
class TeamsController {
  @Get()
  @ApiOperation({ summary: "List teams" })
  findAll() {
    return [];
  }
}

@Module({ controllers: [UsersController, TeamsController] })
class AppModule {}

let app: INestApplication | undefined;

async function start(
  opts: ApiCatalogAdapterOptions = {},
  configure?: (app: INestApplication) => void,
) {
  app = await NestFactory.create(AppModule, { logger: false });
  configure?.(app);
  ApiCatalogAdapter.setup("/docs", app, { title: "Nest API", enabled: true, ...opts });
  await app.listen(0, "127.0.0.1");
  const { port } = app.getHttpServer().address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

async function spec(base: string): Promise<any> {
  const res = await fetch(`${base}/docs/default.json`);
  expect(res.status).toBe(200);
  return res.json();
}

afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.unstubAllEnvs();
});

describe("ApiCatalogAdapter", () => {
  it("collects decorated handlers into the spec", async () => {
    const doc = await spec(await start());
    expect(doc.info.title).toBe("Nest API");
    expect(doc.paths["/users/{id}"].get).toMatchObject({
      summary: "Get user",
      tags: ["Users"],
      parameters: [{ name: "id", in: "path", required: true }],
    });
    expect(doc.paths["/users"].post.summary).toBe("Create user");
  });

  it("documents every path of a controller declared with an array", async () => {
    const doc = await spec(await start());
    expect(doc.paths["/teams"].get.summary).toBe("List teams");
    expect(doc.paths["/groups"].get.summary).toBe("List teams");
  });

  it("applies the app's global prefix to documented paths", async () => {
    const base = await start({}, (a) => a.setGlobalPrefix("api/v1"));
    const doc = await spec(base);
    expect(doc.paths["/api/v1/users/{id}"]).toBeDefined();
    expect(doc.paths["/users/{id}"]).toBeUndefined();
    // The documented route really lives there.
    expect((await fetch(`${base}/api/v1/users/7`)).status).toBe(200);
  });

  it("declares security schemes and a document-level requirement", async () => {
    const doc = await spec(
      await start({
        securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
        security: [{ bearerAuth: [] }],
      }),
    );
    expect(doc.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
    expect(doc.security).toEqual([{ bearerAuth: [] }]);
  });

  it("serves the catalog UI", async () => {
    const res = await fetch(`${await start()}/docs`);
    expect(await res.text()).toContain("<title>Nest API</title>");
  });

  it("stays off in production unless ENABLE_API_DOCS is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const base = await start({ enabled: undefined });
    expect((await fetch(`${base}/docs`)).status).toBe(404);
  });

  it("can be opted into in production with ENABLE_API_DOCS=true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_API_DOCS", "true");
    const base = await start({ enabled: undefined });
    expect((await fetch(`${base}/docs`)).status).toBe(200);
  });
});
