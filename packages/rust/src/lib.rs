/*!
# api-catalog

Universal OpenAPI catalog crate — code-first route docs for Axum and Actix-web.
Write your routes with inline documentation; the crate assembles the OpenAPI spec
and serves the interactive catalog UI automatically.

## Quick start (Axum)

```rust,ignore
use api_catalog::{Catalog, route, spec::Schema};
use axum::{Router, routing::get};

let catalog = Catalog::builder()
    .title("My API")
    .route(route!(GET "/users")
        .summary("List users")
        .query("limit", Schema::integer())
        .response(200, "User list", Schema::array(Schema::object_ref("User"))))
    .route(route!(POST "/users")
        .summary("Create user")
        .body(Schema::object(vec![
            ("name",  Schema::string()),
            ("email", Schema::string()),
        ]))
        .response(201, "Created", Schema::object_ref("User")))
    .build();

let app = Router::new()
    .route("/users", get(list_users).post(create_user))
    .nest("/docs", catalog.into_axum_router());
```

## Quick start (Actix-web)

```rust,ignore
use api_catalog::{Catalog, route, spec::Schema};
use actix_web::{web, App, HttpServer};

let catalog = Catalog::builder()
    .title("My API")
    .route(route!(GET "/users").summary("List users"))
    .build();

HttpServer::new(move || {
    App::new()
        .service(web::resource("/users").to(list_users))
        .configure(catalog.clone().configure("/docs"))
})
.bind("0.0.0.0:3000")?
.run()
.await
```
*/

pub mod spec;
pub mod render;

#[cfg(feature = "axum")]
pub mod axum;

#[cfg(feature = "actix")]
pub mod actix;

pub use spec::{CatalogOptions, CatalogScope, RouteDoc, Schema, SpecBuilder};

/// Top-level handle returned by `Catalog::builder().build()`.
#[derive(Clone)]
pub struct Catalog {
    opts: CatalogOptions,
}

impl Catalog {
    pub fn builder() -> CatalogBuilder {
        CatalogBuilder::new()
    }

    /// Serve the catalog with Axum. Mount the returned router under a path:
    ///   `Router::new().nest("/docs", catalog.into_axum_router())`
    #[cfg(feature = "axum")]
    pub fn into_axum_router(self) -> ::axum::Router {
        crate::axum::into_axum_router(self.opts)
    }

    /// Serve the catalog with Actix-web:
    ///   `App::new().configure(catalog.configure("/docs"))`
    #[cfg(feature = "actix")]
    pub fn configure(self, base_path: &str) -> impl Fn(&mut ::actix_web::web::ServiceConfig) {
        crate::actix::configure(self.opts, base_path)
    }
}

// ── CatalogBuilder ────────────────────────────────────────────────────────────

/// Fluent builder for `Catalog`. Returned by `Catalog::builder()`.
pub struct CatalogBuilder {
    title: String,
    version: String,
    server_url: Option<String>,
    spec_builder: SpecBuilder,
}

impl CatalogBuilder {
    fn new() -> Self {
        CatalogBuilder {
            title: "API".to_string(),
            version: "1.0.0".to_string(),
            server_url: None,
            spec_builder: SpecBuilder::new(),
        }
    }

    pub fn title(mut self, t: &str) -> Self {
        self.title = t.to_string();
        self.spec_builder = self.spec_builder.title(t);
        self
    }

    pub fn version(mut self, v: &str) -> Self {
        self.version = v.to_string();
        self.spec_builder = self.spec_builder.version(v);
        self
    }

    pub fn server(mut self, url: &str) -> Self {
        self.server_url = Some(url.to_string());
        self.spec_builder = self.spec_builder.server(url);
        self
    }

    pub fn tag(mut self, name: &str, description: &str) -> Self {
        self.spec_builder = self.spec_builder.tag(name, description);
        self
    }

    pub fn schema(mut self, name: &str, schema: Schema) -> Self {
        self.spec_builder = self.spec_builder.schema(name, schema);
        self
    }

    /// Register a route with documentation. Use the `route!` macro to create
    /// a `RouteDoc`, then chain `.summary()`, `.query()`, `.response()`, etc.
    pub fn route(mut self, doc: RouteDoc) -> Self {
        self.spec_builder = self.spec_builder.route(doc);
        self
    }

    pub fn build(self) -> Catalog {
        let document = self.spec_builder.build();
        Catalog {
            opts: CatalogOptions {
                title: self.title.clone(),
                server_url: self.server_url,
                scopes: vec![CatalogScope {
                    id: "default".to_string(),
                    label: self.title,
                    document,
                }],
            },
        }
    }
}
