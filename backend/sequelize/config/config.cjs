require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const common = {
  dialect: 'mysql',
  logging: process.env.SEQUELIZE_LOGGING === 'true' ? console.log : false,
  define: {
    underscored: true,
    freezeTableName: false,
    timestamps: true,
  },
  timezone: '+00:00',
};

module.exports = {
  development: {
    ...common,
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    username: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'jju_dev',
  },
  test: {
    ...common,
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    username: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE_TEST || 'jju_test',
  },
  production: {
    ...common,
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    dialectOptions: process.env.MYSQL_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : undefined,
  },
};
