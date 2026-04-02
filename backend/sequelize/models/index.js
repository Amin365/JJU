import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Sequelize } from 'sequelize';
import initSchema from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const env = process.env.NODE_ENV || 'development';

const configModule = await import(pathToFileURL(path.join(__dirname, '..', 'config', 'config.cjs')).href);
const config = configModule.default?.[env] || configModule[env];

const sequelize = new Sequelize(config.database, config.username, config.password, config);

const db = initSchema(sequelize);

export { sequelize, Sequelize };
export default db;
