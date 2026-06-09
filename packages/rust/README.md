# api-catalog — Rust

Code-first OpenAPI catalog for Axum and Actix-web. Document routes inline with a fluent builder; the crate generates the OpenAPI spec and serves an interactive UI at startup.

```toml
[dependencies]
api-catalog = { version = "0.1", features = ["axum"] }
# or
api-catalog = { version = "0.1", features = ["actix"] }
```

---

## Feature flags

| Feature | Enables |
|---------|---------|
| `axum` | `Catalog::into_axum_router()` — returns an `axum::Router` |
| `actix` | `Catalog::configure()` — returns an Actix-web `ServiceConfig` closure |

Both features can be enabled at the same time.

---

## Axum

```rust
use api_catalog::{Catalog, route, spec::Schema};
use axum::{Router, routing::get};

#[tokio::main]
async fn main() {
    let catalog = Catalog::builder()
        .title("My API")
        .version("1.0.0")
        .server("https://api.example.com")
        // Register a reusable schema
        .schema("User", Schema::object_required(
            vec![
                ("id",    Schema::string_with(json!({ "format": "uuid" }))),
                ("name",  Schema::string()),
                ("email", Schema::string()),
            ],
            vec!["id", "name", "email"],
        ))
        // Document routes with the route! macro
        .route(route!(GET "/users")
            .summary("List users")
            .tag("Users")
            .query("limit",  Schema::integer())
            .query("offset", Schema::integer())
            .response(200, "User list", Schema::array(Schema::object_ref("User"))))
        .route(route!(POST "/users")
            .summary("Create user")
            .tag("Users")
            .body(Schema::object_required(
                vec![("name", Schema::string()), ("email", Schema::string())],
                vec!["name", "email"],
            ))
            .response(201, "Created",          Schema::object_ref("User"))
            .response_empty(422, "Validation error"))
        .route(route!(GET "/users/:id")
            .summary("Get user by ID")
            .tag("Users")
            .path_param("id", Schema::string_with(json!({ "format": "uuid" })))
            .response(200, "User",      Schema::object_ref("User"))
            .response_empty(404, "Not found"))
        .build();

    let app = Router::new()
        .route("/users",    get(list_users).post(create_user))
        .route("/users/:id", get(get_user))
        .nest("/docs", catalog.into_axum_router());
    //         ↑ GET /docs           → interactive UI
    //           GET /docs/default.json → OpenAPI JSON

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

---

## Actix-web

```rust
use api_catalog::{Catalog, route, spec::Schema};
use actix_web::{web, App, HttpServer};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let catalog = Catalog::builder()
        .title("My API")
        .route(route!(GET "/users")
            .summary("List users")
            .response(200, "User list", Schema::array(Schema::object_ref("User"))))
        .route(route!(POST "/users")
            .summary("Create user")
            .body(Schema::object(vec![
                ("name",  Schema::string()),
                ("email", Schema::string()),
            ]))
            .response(201, "Created", Schema::object_ref("User")))
        .build();

    HttpServer::new(move || {
        App::new()
            .service(web::resource("/users").route(web::get().to(list_users)))
            .configure(catalog.clone().configure("/docs"))
        //                                              ↑ GET /docs           → UI
        //                                                GET /docs/default.json → JSON
    })
    .bind("0.0.0.0:3000")?
    .run()
    .await
}
```

---

## `route!` macro

`route!(METHOD "path")` is shorthand for `RouteDoc::new("METHOD", "path")`. Chain documentation methods on the result:

```rust
route!(GET "/users/:id")
    .summary("Get user by ID")
    .description("Returns 404 if the user does not exist.")
    .tag("Users")
    .path_param("id", Schema::string())
    .query("include_deleted", Schema::boolean())
    .response(200, "User",      Schema::object_ref("User"))
    .response_empty(404, "Not found")
    .deprecated()
```

### Route methods

| Method | Notes |
|--------|-------|
| `.summary(s)` | Short one-line description |
| `.description(s)` | Long description (Markdown) |
| `.tag(s)` | Assign to a tag group |
| `.deprecated()` | Mark as deprecated |
| `.query(name, schema)` | Optional query parameter |
| `.query_required(name, schema)` | Required query parameter |
| `.path_param(name, schema)` | Path parameter (always required) |
| `.body(schema)` | Required JSON request body |
| `.body_optional(schema)` | Optional JSON request body |
| `.response(status, desc, schema)` | Response with a JSON body |
| `.response_empty(status, desc)` | Response with no body |

---

## Schema builders

`Schema` wraps `serde_json::Value` so it serialises directly into the OpenAPI document.

```rust
use api_catalog::spec::Schema;
use serde_json::json;

Schema::string()
Schema::string_with(json!({ "format": "uuid" }))
Schema::integer()
Schema::integer_with(json!({ "minimum": 0, "maximum": 100 }))
Schema::number()
Schema::boolean()
Schema::array(Schema::object_ref("User"))
Schema::object(vec![
    ("name",  Schema::string()),
    ("email", Schema::string()),
])
Schema::object_required(
    vec![("id", Schema::string()), ("name", Schema::string())],
    vec!["id", "name"],
)
Schema::object_ref("User")     // { "$ref": "#/components/schemas/User" }
Schema::string().nullable()    // adds "nullable": true
```

---

## Served endpoints

When mounted at `/docs`:

| Endpoint | Response |
|----------|----------|
| `GET /docs` | Catalog HTML (interactive UI, try-it console) |
| `GET /docs/default.json` | OpenAPI 3.0.3 JSON document |

The HTML is embedded in the binary at compile time — no static files to deploy.
