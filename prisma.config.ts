import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });

const url = process.env.DIRECT_URL;
console.log("Prisma config: DIRECT_URL =", url ? url.slice(0, 30) + "..." : "NOT SET");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: url!,
  },
});
