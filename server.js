const { app } = require("./src/app");
const { port } = require("./src/config/env");
const { initDatabase } = require("./src/db/database");
const { mapDatabaseError } = require("./src/db/database-errors");

const initializeDatabase = async () => {
  try {
    await initDatabase();
    console.log("MySQL database initialization successful.");
  } catch (error) {
    const mapped = mapDatabaseError(error);
    console.error(`MySQL initialization warning: ${mapped.message}`);
    console.error(`Details: ${mapped.code}`);
    console.error(`Hint: ${mapped.hint}`);
  }
};

const startServer = () => {
  app.listen(port, () => {
    console.log(`Empior server running at http://localhost:${port}`);
    void initializeDatabase();
  });
};

startServer();
