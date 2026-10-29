mod common;

#[test]
fn exposes_the_spec_and_page_without_a_framework() {
    let catalog = common::catalog();
    assert_eq!(catalog.openapi()["info"]["title"], "Users API");
    assert!(catalog.openapi()["paths"]["/users/{id}"]["get"].is_object());

    let html = catalog.html();
    assert!(html.starts_with("<!DOCTYPE html>"));
    assert!(html.contains("<title>Users API</title>"));
}
