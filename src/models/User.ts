import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import bcrypt from 'bcryptjs';

export class User extends Model {
  declare id: number;
  declare email: string;
  declare password: string;
  declare role: 'admin' | 'manager' | 'viewer';

  public comparePassword(password: string): boolean {
    return bcrypt.compareSync(password, this.password);
  }
}

User.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('admin', 'manager', 'viewer'),
    defaultValue: 'admin',
  }
}, {
  sequelize,
  modelName: 'User',
  hooks: {
    beforeCreate: (user: User) => {
      console.log('beforeCreate Hook - Password present:', !!user.password);
      if (user.password) {
        user.password = bcrypt.hashSync(user.password, 10);
      }
    },
    beforeUpdate: (user: User) => {
      if (user.changed('password')) {
        console.log('beforeUpdate Hook - Hashing new password');
        user.password = bcrypt.hashSync(user.password, 10);
      }
    }
  }
});
