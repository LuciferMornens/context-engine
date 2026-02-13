const express = require("express");
const { Pool } = require("pg");

/** Maximum number of retry attempts */
const MAX_RETRIES = 3;

/**
 * Create an Express application with middleware.
 * @param {object} config - Application configuration
 * @returns {object} Express app instance
 */
function createApp(config) {
  const app = express();
  app.use(express.json());
  return app;
}

class RequestHandler {
  constructor(db) {
    this.db = db;
  }

  handleGet(req, res) {
    const data = this.db.query("SELECT *");
    res.json(data);
  }

  handlePost(req, res) {
    this.db.insert(req.body);
    res.status(201).end();
  }
}

module.exports = { createApp, RequestHandler };
