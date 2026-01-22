# Zenoh Setup Guide for macOS

This README provides a step-by-step guide to setting up and running Zenoh on macOS (tested on MacBook Pro). It covers prerequisites, cloning repositories, building the WebSocket bridge, running the Zenoh router (zenohd), and running basic examples for publishing, subscribing, putting data, and creating a queryable.

Zenoh is a distributed pub/sub/query protocol for robotics and IoT, with efficient routing. The WebSocket bridge enables JavaScript/TypeScript clients (like @eclipse-zenoh/zenoh-ts) to connect via WS.

Prerequisites
-------------

1. Install Rust:

   ```sh
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

   - Follow the prompts, then source your shell profile:

     ```sh
     source "$HOME/.cargo/env"
     ```

   - Verify:

     ```sh
     rustc --version
     ```

     (Rust 1.75+ recommended.)

2. Homebrew (for zenohd binary): Install from brew.sh if not already.

3. Git: For cloning repos (usually pre-installed on macOS).

Step 1: Install Zenoh Router (zenohd) via Homebrew
--------------------------------------------------

```sh
brew tap eclipse-zenoh/homebrew-zenoh
brew install zenoh
zenohd --version
```

Step 2: Clone Repositories
--------------------------

```sh
git clone https://github.com/eclipse-zenoh/zenoh.git
git clone https://github.com/eclipse-zenoh/zenoh-ts.git
```

Step 3: Build the WebSocket Bridge
----------------------------------

The bridge (zenoh-bridge-remote-api) enables WebSocket connections for JS/TS clients.

```sh
cd zenoh-ts/zenoh-bridge-remote-api
cargo build --release
```

Output: `./target/release/zenoh-bridge-remote-api`.

Step 4: Run the Zenoh Router (zenohd)
-------------------------------------

Run the core router first (handles routing; bridge connects to it).

```sh
zenohd
```

- Logs show ZID and endpoints (e.g., `tcp/localhost:7447`).
- For debug: `RUST_LOG=info zenohd`.
- Stop with Ctrl+C.

Step 5: Run the WebSocket Bridge
--------------------------------

Connect the bridge to zenohd for WS support (port 10000).

```sh
./target/release/zenoh-bridge-remote-api --connect tcp/localhost:7447 --ws-port 10000
```

- Logs show connection to zenohd and WS listening on 10000.
- Use this for JS/TS clients (locator: `ws://localhost:10000` or your IP).

Step 6: Run CLI Examples (from Zenoh Repo)
------------------------------------------

Navigate to the zenoh repo dir (e.g., `cd ~/path/to/zenoh`).

These use `cargo run` (compiles/runs on-the-fly; no separate build needed for dev).

```sh
cargo run --example z_pub -- -k 'test/data'
cargo run --example z_sub -- -k 'test/**'
cargo run --example z_put -- -k 'test/data'
cargo run --example z_queryable -- -k 'test/data'
```

To test:

- Run `z_sub` in one terminal.
- Run `z_pub` or `z_put` in another; data appears in sub.

For custom values in `z_put`, edit `examples/z_put.rs` (change the `session.put(...)` value).

Troubleshooting
---------------

- Build Errors: Run `rustup update`.
- Connection Issues: Check logs for ZIDs/links; ensure ports open (e.g., 7447, 10000).
- ROS Integration: `cargo install zenoh-bridge-ros2dds`, then `./zenoh-bridge-ros2dds --scope robot`.
- Docs: <https://zenoh.io/docs/getting-started/quick-start/>
