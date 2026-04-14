const mapDatabaseError = (error) => {
  const code = String(error?.code ?? "UNKNOWN");

  if (code === "ECONNREFUSED") {
    return {
      code,
      statusCode: 503,
      message: "MySQL server is not running or refused the connection.",
      hint: "Start MySQL and verify MYSQL_HOST and MYSQL_PORT."
    };
  }

  if (code === "ER_ACCESS_DENIED_ERROR") {
    return {
      code,
      statusCode: 401,
      message: "MySQL credentials are incorrect.",
      hint: "Check MYSQL_USER and MYSQL_PASSWORD in your .env file."
    };
  }

  if (code === "ENOTFOUND") {
    return {
      code,
      statusCode: 503,
      message: "MySQL host could not be resolved.",
      hint: "Verify MYSQL_HOST points to a reachable database server."
    };
  }

  if (code === "ETIMEDOUT") {
    return {
      code,
      statusCode: 504,
      message: "Timed out while connecting to MySQL.",
      hint: "Check network access, firewall rules, and MYSQL_PORT."
    };
  }

  if (code === "ER_BAD_DB_ERROR") {
    return {
      code,
      statusCode: 500,
      message: "The target MySQL database was not found.",
      hint: "Create the database or let app startup create it automatically."
    };
  }

  return {
    code,
    statusCode: 500,
    message: "MySQL connection failed.",
    hint: "Verify MySQL is running and all MYSQL_* environment variables are correct."
  };
};

module.exports = { mapDatabaseError };
