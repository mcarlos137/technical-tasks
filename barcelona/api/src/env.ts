// Loads ./.env (if present) before any module reads process.env. Import this first.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: rely on the real environment.
}
