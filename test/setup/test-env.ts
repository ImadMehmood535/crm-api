// Runs in every int/e2e test worker before modules load: point the app at the *_test database.
process.loadEnvFile?.();
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
