import { Pool } from "pg";
import { buildApp } from "./app.js";
import { PostgresMatchRepository } from "./repositories/postgres-match-repository.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be configured for the API server.");
}

const pool = new Pool({ connectionString: databaseUrl });
const app = await buildApp({
  matchRepository: new PostgresMatchRepository(pool),
});
app.addHook("onClose", async () => pool.end());
await app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
