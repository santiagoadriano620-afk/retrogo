module.exports = {
  // ═══════════════════════════════════════════════════════════════════════════
  // Security & Encryption
  // ═══════════════════════════════════════════════════════════════════════════

  HMAC: {
    SHARED_SECRET: process.env.HMAC_SECRET || null,
  },
  TLS: {
    CERT: null,
    KEY: null,
  },
  ENCRYPTION: {
    ENABLED: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Login Server
  // ═══════════════════════════════════════════════════════════════════════════

  LOGIN: {
    PORT: 8000,
    HOST: "0.0.0.0",
    TOKEN_VALID_MS: 60000,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Database
  // ═══════════════════════════════════════════════════════════════════════════

  DATABASE: {
    URL: "sqlite://./data/database.sqlite",
    DEFAULT_CHARACTER: { ENABLED: false },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Game Server
  // ═══════════════════════════════════════════════════════════════════════════

  SERVER: {
    PRODUCTION: false,
    COMPRESSION: { ENABLED: true, THRESHOLD: 1024, LEVEL: 1 },
    ON_ALREADY_ONLINE: "replace",
    EXTERNAL_HOST: "ws://192.168.1.11:2223",
    VERSION: "0.0.0",
    CLIENT_VERSION: "740",
    DATE: "2022-03-24",
    PORT: 2223,
    HOST: "0.0.0.0",
    ALLOW_MAXIMUM_CONNECTIONS: 250,
    MS_TICK_INTERVAL: 50,
    MS_SHUTDOWN_SCHEDULE: 1000,
    MAX_PACKET_SIZE: 1024,
    PING_INTERVAL: 5,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // World
  // ═══════════════════════════════════════════════════════════════════════════

  WORLD: {
    GLOBAL_COOLDOWN_MS: 1000,
    WORLD_FILE: "map.otbm",
    IDLE: { WARN_SECONDS: 300, KICK_SECONDS: 60 },
    CHUNK: { WIDTH: 9, HEIGHT: 7, DEPTH: 8 },
    CLOCK: { SPEED: 6, START: "08:00" },
    SPAWNS: { ENABLED: true },
    NPCS: { ENABLED: true },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Combat & PvP
  // ═══════════════════════════════════════════════════════════════════════════

  COMBAT: {
    USE_CLASSIC_FORMULAS: true,
  },
  PVP: {
    ENABLED: true,
    DAMAGE_MULTIPLIER: 0.5,
    LEVEL_DIFF_REDUCTION: 0.01,
    LEVEL_DIFF_CAP: 0.5,
    WHITE_SKULL_DURATION: 900000,
    WHITE_SKULL_DURATION_NO_KILL: 60000,
    PZ_LOCK_AFTER_KILL: 60000,
    RED_SKULL_DAILY: 3,
    RED_SKULL_WEEKLY: 5,
    RED_SKULL_MONTHLY: 10,
    RED_SKULL_DURATION: 2592000000,
    BLACK_SKULL_MULTIPLIER: 2,
    BLACK_SKULL_DURATION: 3888000000,
    ORANGE_SKULL_DURATION: 604800000,
    FRAG_DECAY_INTERVAL: 3600000,
    BLACK_SKULL_PVP_DAMAGE_MULTIPLIER: 1,
    RED_SKULL_DROP_ALL: true,
    LOSE_ITEMS_ON_PVP: true,
    LOSE_EQUIPMENT_ON_PVP: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Skills & Progression
  // ═══════════════════════════════════════════════════════════════════════════

  // Vocation multipliers - centralized to avoid duplication
  VOCATION_MULTIPLIERS: {
    MAGIC: { SORCERER: 3, DRUID: 3, PALADIN: 2, KNIGHT: 1, ADMIN: 10, NONE: 1 },
    MELEE: { KNIGHT: 3, PALADIN: 2, SORCERER: 1, DRUID: 1, ADMIN: 10, NONE: 1 },
    DISTANCE: { PALADIN: 3, KNIGHT: 1, SORCERER: 1, DRUID: 1, ADMIN: 10, NONE: 1 },
    SHIELDING: { KNIGHT: 3, PALADIN: 2, SORCERER: 1, DRUID: 1, ADMIN: 10, NONE: 1 },
  },

  SKILLS: {
    MAGIC: {
      BASE_POINTS_PER_CAST: 1,
      GLOBAL_MULTIPLIER: 10,
    },
    MELEE: {
      BASE_POINTS_PER_HIT: 1,
      BLOOD_HIT_BONUS: 2,
      GLOBAL_MULTIPLIER: 5,
    },
    DISTANCE: {
      BASE_POINTS_PER_HIT: 1,
      BLOOD_HIT_BONUS: 2,
      GLOBAL_MULTIPLIER: 5,
    },
    SHIELDING: {
      BASE_POINTS_PER_BLOCK: 1,
      GLOBAL_MULTIPLIER: 5,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Training Weapons
  // ═══════════════════════════════════════════════════════════════════════════

  TRAINING: {
    EXPIRY_HOURS: 12,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Gameplay
  // ═══════════════════════════════════════════════════════════════════════════

  RATES: {
    EXPERIENCE: 1,
    SKILL: 1,
    LOOT: 1,
    MAGIC: 1,
    SPAWN: 1,
  },
  DEATH: {
    LOSE_PERCENT: 10,
  },
  BLESSINGS: {
    STORAGE_KEYS: [101, 102, 103, 104, 105],
    XP_REDUCTION: [0, 8, 16, 24, 32, 40],
    XP_REDUCTION_PROMO: [0, 38, 46, 54, 62, 70],
  },
  GUILD: {
    CREATE_LEVEL: 20,
    CREATE_PREMIUM: true,
    PROOF_ITEM: 2672,
    QUEST_STORAGE: 2001,
  },
  GAME: {
    FREE_PREMIUM: false,
    travelOnlyPremium: true,
    KICK_IDLE_MINUTES: 15,
    ALLOW_CHANGE_OUTFIT: true,
    STAMINA_SYSTEM: false,
    WORLD_LIGHT: true,
    ONE_CHAR_PER_IP: false,
  },
  HOUSE: {
    PRICE_PER_SQM: 100,
    RENT_PERIOD_DAYS: 7,
    MAX_PER_PLAYER: 1,
  },
  SUMMONS: {
    MAX_PER_PLAYER: 2,
    SHARE_EXPERIENCE: true,
    EXPERIENCE_PERCENT_TO_MASTER: 100,
    DESPAWN_ON_MASTER_LOGOUT: true,
  },
  PARTY: {
    ENABLED: true,
    MAX_MEMBERS: 50,
    BONUS_MEMBERS_CAP: 4,
    EXPERIENCE_SHARE_RANGE: 10,
    BONUS_EXPERIENCE_PER_MEMBER: 0,
    BONUS_LOOT_PER_MEMBER: 0,
    VOCATION_BONUS_EXPERIENCE: {
      KNIGHT_PALADIN: 0,
      KNIGHT_SORCERER: 0,
      KNIGHT_DRUID: 0,
      PALADIN_SORCERER: 0,
      PALADIN_DRUID: 0,
      SORCERER_DRUID: 0,
    },
    VOCATION_BONUS_LOOT: {
      KNIGHT_PALADIN: 0,
      KNIGHT_SORCERER: 0,
      KNIGHT_DRUID: 0,
      PALADIN_SORCERER: 0,
      PALADIN_DRUID: 0,
      SORCERER_DRUID: 0,
    },
    FULL_VOCATION_BONUS_EXPERIENCE: 0,
    FULL_VOCATION_BONUS_LOOT: 0,
    LEVEL_DIFFERENCE_RULE: 0.9,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Referral Program
  // ═══════════════════════════════════════════════════════════════════════════

  REFERRAL: {
    ENABLED: true,
    LEVEL_REQUIRED: 20,
    REWARD_PREMIUM_POINTS: 10,
    CODE_LENGTH: 5,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Logging & Performance
  // ═══════════════════════════════════════════════════════════════════════════

  LOGGING: {
    INTERVAL: 20,
    NETWORK_TELEMETRY: true,
  },
  PERFORMANCE: {
    WORKER_POOL: {
      ENABLED: true,
      MAX_WORKERS: Math.max(1, require("os").cpus().length - 1),
      PATHFINDING: true,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Dev
  // ═══════════════════════════════════════════════════════════════════════════

  devMode: false,

  // ═══════════════════════════════════════════════════════════════════════════
  // Admin Panel Config
  // ═══════════════════════════════════════════════════════════════════════════

  ADMIN: {
    PORT: 2224,
    HOST: "127.0.0.1",
    SECRET: process.env.ADMIN_SECRET || null,
    PANEL_PORT: 3000,
  },
};
