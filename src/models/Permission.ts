import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import { User } from './User.js';

export class Permission extends Model {
  declare id: number;
  declare role: 'admin' | 'manager' | 'viewer';
  declare tableName: string;
  declare canCreate: boolean;
  declare canRead: boolean;
  declare canUpdate: boolean;
  declare canDelete: boolean;
}

Permission.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  role: {
    type: DataTypes.ENUM('admin', 'manager', 'viewer'),
    allowNull: false,
  },
  tableName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  canCreate: { type: DataTypes.BOOLEAN, defaultValue: false },
  canRead: { type: DataTypes.BOOLEAN, defaultValue: true },
  canUpdate: { type: DataTypes.BOOLEAN, defaultValue: false },
  canDelete: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  sequelize,
  modelName: 'Permission'
});
