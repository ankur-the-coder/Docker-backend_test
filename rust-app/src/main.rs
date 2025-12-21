#[tokio::main(flavor = "multi_thread", worker_threads = 2)]
async fn main() {
    let database_url = std::env::var("DATABASE_URL").unwrap();

    let pool = MySqlPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .unwrap();

    let (job_tx, job_rx) = mpsc::channel::<Job>(5000);
    start_workers(Arc::new(tokio::sync::Mutex::new(job_rx)));

    let state = AppState { pool, job_tx };

    let app = Router::new()
        .route("/db/:id", get(get_user))
        .route("/calc", get(calc))
        .with_state(state);

    axum::serve(
        tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap(),
        app,
    )
    .await
    .unwrap();
}
