import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Sequelize } from "sequelize";
import initSchema from "../sequelize/models/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

export const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE,
  process.env.MYSQL_USER,
  process.env.MYSQL_PASSWORD,
  {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    dialect: "mysql",
    logging: process.env.SEQUELIZE_LOGGING === "true" ? console.log : false,
    define: {
      underscored: true,
      freezeTableName: false,
      timestamps: true,
    },
    timezone: "+00:00",
  }
);

export const models = initSchema(sequelize);

export const connectMySQL = async () => {
  await sequelize.authenticate();
  console.log("✅ Connected to MySQL successfully");
};

