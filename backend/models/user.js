module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: { isEmail: true },
    },
    role: {
      type: DataTypes.ENUM('volunteer', 'coordinator', 'admin'),
      defaultValue: 'volunteer',
      allowNull: false,
    },
    profileImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // bcrypt hash, only used by the local auth provider (AUTH_PROVIDER=local)
    passwordHash: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  }, {
    // Never load the hash unless explicitly requested with User.scope('withPassword')
    defaultScope: {
      attributes: { exclude: ['passwordHash'] },
    },
    scopes: {
      withPassword: {
        attributes: { include: ['passwordHash'] },
      },
    },
    hooks: {}
  });

  // Defence in depth: never serialize the hash (res.json, EJS safeJson, sockets...)
  User.prototype.toJSON = function toJSON() {
    const values = { ...this.get() };
    delete values.passwordHash;
    return values;
  };

  User.associate = (models) => {
    User.hasMany(models.Reviews, {
      foreignKey: 'userId',
      as: 'reviews'
    });
  };

  return User;
};
