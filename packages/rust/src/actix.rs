use crate::{render::render_catalog_html, spec::CatalogOptions};
use actix_web::{web, HttpResponse};
use serde_json::Value;
use std::sync::Arc;

struct CatalogData {
    html: String,
    scopes: Vec<(String, Value)>, // (id, document)
}

async fn html_handler(data: web::Data<Arc<CatalogData>>) -> HttpResponse {
    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(data.html.clone())
}

async fn scope_json_handler(
    path: web::Path<String>,
    data: web::Data<Arc<CatalogData>>,
) -> HttpResponse {
    let scope_id = path.into_inner();
    match data.scopes.iter().find(|(id, _)| id == &scope_id) {
        Some((_, doc)) => HttpResponse::Ok().json(doc),
        None => HttpResponse::NotFound().finish(),
    }
}

/// Returns an Actix-web `ServiceConfig` closure that registers the catalog
/// routes under `base_path`.
///
///   GET {base_path}              → catalog HTML
///   GET {base_path}/{id}.json    → OpenAPI spec for that scope
///
/// ```rust,ignore
/// App::new()
///     .service(web::resource("/users").to(list_users))
///     .configure(catalog.configure("/docs"))
/// ```
pub fn configure(opts: CatalogOptions, base_path: &str) -> impl Fn(&mut web::ServiceConfig) {
    let html = render_catalog_html(&opts);
    let scopes: Vec<(String, Value)> = opts
        .scopes
        .iter()
        .map(|s| (s.id.clone(), s.document.clone()))
        .collect();

    let data = web::Data::new(Arc::new(CatalogData { html, scopes }));
    let base = base_path.trim_end_matches('/').to_string();

    move |cfg: &mut web::ServiceConfig| {
        let d = data.clone();
        cfg.service(
            web::scope(&base)
                .app_data(d.clone())
                .route("", web::get().to(html_handler))
                .route("/{scope_id}.json", web::get().to(scope_json_handler)),
        );
    }
}
