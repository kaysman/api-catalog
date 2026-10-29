// Shared fixture for the framework integration tests.
#![allow(dead_code)]

use api_catalog::{route, spec::Schema, Catalog};

pub fn catalog() -> Catalog {
    Catalog::builder()
        .title("Users API")
        .version("1.0.0")
        .route(
            route!(GET "/users/:id")
                .summary("Get user")
                .path_param("id", Schema::string())
                .response_empty(404, "Not found"),
        )
        .build()
}
