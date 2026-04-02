"use strict";

const path = require("path");
const dotenv = require("dotenv");
const { pathToFileURL } = require("url");
const { Sequelize } = require("sequelize");
const config = require("../config/config.cjs");

function getDbConfig() {
  const env = process.env.NODE_ENV || "development";
  return config[env];
}

module.exports = {
  async up() {
    dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
    const dbConfig = getDbConfig();
    const sequelize = new Sequelize(
      dbConfig.database,
      dbConfig.username,
      dbConfig.password,
      dbConfig
    );

    const schemaUrl = pathToFileURL(path.join(__dirname, "..", "models", "schema.js")).href;
    const schemaModule = await import(schemaUrl);
    schemaModule.default(sequelize);

    await sequelize.sync({ alter: false });
    await sequelize.close();
  },

  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query("SHOW TABLES");
    const tableNames = rows.map((r) => Object.values(r)[0]).filter((t) => t !== "SequelizeMeta");
    await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const tableName of tableNames) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.dropTable(tableName);
    }
    await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
  },
};

