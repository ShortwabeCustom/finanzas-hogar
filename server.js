#!/usr/bin/env node

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const hostname = "127.0.0.1";
const port = parseInt(process.env.PORT || "4000", 10);

const app = next({ dev, dir: path.join(__dirname) });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal server error");
    }
  }).listen(port, hostname, () => {
    console.log(
      `[finanzas-hogar] Ready on http://${hostname}:${port} (NODE_ENV=${process.env.NODE_ENV})`
    );
    if (!dev) {
      console.log("[finanzas-hogar] Production mode - using compiled build");
    }
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[finanzas-hogar] SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[finanzas-hogar] SIGINT received, shutting down gracefully...");
  process.exit(0);
});