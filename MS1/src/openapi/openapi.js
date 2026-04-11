const path = require("path");
const YAML = require("yamljs");
const swaggerUi = require("swagger-ui-express");

function setupOpenApi(app) {
  const specPath = path.join(__dirname, "openapi.yaml");
  const spec = YAML.load(specPath);

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(spec));
}

module.exports = {
  setupOpenApi
};
