import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Project } from './Project.js';

export class SchemaMetadata extends Model {
  declare id: number;
  declare projectId: number;
  declare tableName: string;
  declare fields: any; // JSON array of fields {name, type, relation?, etc.}
}

SchemaMetadata.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  projectId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Project,
      key: 'id',
    }
  },
  tableName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fields: {
    type: DataTypes.JSON, // Stores: [{ name: '...', type: '...', ... }]
    allowNull: false,
  }
}, {
  sequelize,
  modelName: 'SchemaMetadata',
  indexes: [
    {
      unique: true,
      fields: ['projectId', 'tableName']
    }
  ]
});

SchemaMetadata.belongsTo(Project, { foreignKey: 'projectId' });
Project.hasMany(SchemaMetadata, { foreignKey: 'projectId' });
