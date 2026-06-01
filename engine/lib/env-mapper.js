/**
 * Environment Variable to Config Mapper
 * Consolidates all environment variable overrides in a single, maintainable location
 */

const ENV_MAPPING = {
  // Security
  HMAC_SECRET: {
    path: ['HMAC', 'SHARED_SECRET'],
    type: 'string'
  },

  // Server - Login
  LOGIN_PORT: {
    path: ['LOGIN', 'PORT'],
    type: 'int'
  },
  LOGIN_HOST: {
    path: ['LOGIN', 'HOST'],
    type: 'string'
  },

  // Server - Game
  GAME_PORT: {
    path: ['SERVER', 'PORT'],
    type: 'int'
  },
  GAME_HOST: {
    path: ['SERVER', 'HOST'],
    type: 'string'
  },
  EXTERNAL_HOST: {
    path: ['SERVER', 'EXTERNAL_HOST'],
    type: 'string'
  },

  // TLS/SSL
  TLS_CERT: {
    path: ['TLS', 'CERT'],
    type: 'string',
    initParent: true
  },
  TLS_KEY: {
    path: ['TLS', 'KEY'],
    type: 'string',
    initParent: true
  },

  // Environment
  DEV_MODE: {
    path: ['devMode'],
    type: 'boolean'
  },

  // Admin
  ADMIN_PORT: {
    path: ['ADMIN', 'PORT'],
    type: 'int'
  },
  ADMIN_HOST: {
    path: ['ADMIN', 'HOST'],
    type: 'string'
  },
  ADMIN_SECRET: {
    path: ['ADMIN', 'SECRET'],
    type: 'string'
  },
  ADMIN_PANEL_PORT: {
    path: ['ADMIN', 'PANEL_PORT'],
    type: 'int'
  },

  // Rates
  RATE_EXPERIENCE: {
    path: ['RATES', 'EXPERIENCE'],
    type: 'float'
  },
  RATE_SKILL: {
    path: ['RATES', 'SKILL'],
    type: 'float'
  },
  RATE_LOOT: {
    path: ['RATES', 'LOOT'],
    type: 'float'
  },
  RATE_MAGIC: {
    path: ['RATES', 'MAGIC'],
    type: 'float'
  },
  RATE_SPAWN: {
    path: ['RATES', 'SPAWN'],
    type: 'float'
  }
};

/**
 * Set a value in a nested object using a path array
 * @param {Object} obj - Target object
 * @param {Array<string>} path - Path to property (e.g., ['CONFIG', 'HMAC', 'SHARED_SECRET'])
 * @param {*} value - Value to set
 * @param {boolean} initParent - Initialize parent if not exists
 */
function setNestedProperty(obj, path, value, initParent = false) {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!current[key]) {
      if (!initParent) return; // Skip if parent doesn't exist and not init
      current[key] = {};
    }
    current = current[key];
  }
  current[path[path.length - 1]] = value;
}

/**
 * Parse value based on type specification
 * @param {string} value - Raw environment variable value
 * @param {string} type - Type: 'string', 'int', 'float', 'boolean'
 * @returns {*} Parsed value
 */
function parseValue(value, type) {
  switch (type) {
    case 'int':
      return parseInt(value, 10);
    case 'float':
      return parseFloat(value);
    case 'boolean':
      return value === 'true' || value === '1';
    case 'string':
    default:
      return value;
  }
}

/**
 * Map environment variables to config object
 * @param {Object} config - Configuration object to update
 * @returns {Object} Updated configuration
 */
function mapEnvironmentToConfig(config) {
  Object.entries(ENV_MAPPING).forEach(([envKey, spec]) => {
    if (envKey in process.env) {
      const rawValue = process.env[envKey];
      const parsedValue = parseValue(rawValue, spec.type);
      setNestedProperty(config, spec.path, parsedValue, spec.initParent);
    }
  });
  return config;
}

module.exports = {
  mapEnvironmentToConfig,
  ENV_MAPPING
};
