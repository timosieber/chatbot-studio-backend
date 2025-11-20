import { buildServer } from "./server.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

try {
  logger.info("Initializing server...");
  const app = buildServer();

  app.listen(env.PORT, () => {
    logger.info(`🚀 Backend läuft auf Port ${env.PORT}`);
  });
} catch (error) {
  logger.fatal({ err: error }, "Failed to start server");
  // eslint-disable-next-line no-console
  console.error("FATAL ERROR:", error);
  process.exit(1);
}
