import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Project extends Model {
  declare id: number;
  declare name: string;
  declare dbHost: string;
  declare dbPort: number;
  declare dbUser: string;
  declare dbPass: string;
  declare dbName: string;
  declare dbDialect: 'mysql' | 'postgres' | 'sqlite';
  declare dbUrl?: string;
}

Project.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dbHost: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dbPort: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  dbUser: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dbPass: {
    type: DataTypes.STRING, // Should be encrypted in production
    allowNull: false,
  },
  dbName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dbDialect: {
    type: DataTypes.ENUM('mysql', 'postgres', 'sqlite'),
    defaultValue: 'mysql',
  },
  dbUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
}, {
  sequelize,
  modelName: 'Project'
});
