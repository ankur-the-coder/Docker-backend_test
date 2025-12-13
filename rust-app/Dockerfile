# Build Stage
# *** FIX: Use the nightly compiler to support required dependency features ***
FROM rustlang/rust:nightly-slim as builder
WORKDIR /app
# Install OpenSSL dependency required for sqlx with native-tls feature
RUN apt-get update && apt-get install -y libssl-dev pkg-config
COPY . .
RUN cargo build --release

# Run Stage
FROM debian:bookworm-slim
WORKDIR /app
# Install OpenSSL library needed at runtime (different from libssl-dev)
RUN apt-get update && apt-get install -y libssl3
COPY --from=builder /app/target/release/rust-app .
CMD ["./rust-app"]