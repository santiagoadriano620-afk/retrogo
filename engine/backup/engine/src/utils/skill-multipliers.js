/**
 * Skill Multiplier Utils
 * Provides centralized access to vocation multipliers for skill progression
 */

module.exports = {
  /**
   * Get vocation multiplier for a specific skill type
   * @param {string} skillType - Skill type: 'MAGIC', 'MELEE', 'DISTANCE', 'SHIELDING'
   * @param {string} vocationName - Vocation name in uppercase: 'KNIGHT', 'PALADIN', etc.
   * @returns {number} Multiplier value (default: 1)
   */
  getVocationMultiplier(skillType, vocationName) {
    if (!CONFIG.VOCATION_MULTIPLIERS || !CONFIG.VOCATION_MULTIPLIERS[skillType]) {
      return 1;
    }
    return CONFIG.VOCATION_MULTIPLIERS[skillType][vocationName] || 1;
  },

  /**
   * Get skill config with defaults
   * @param {string} skillType - 'MAGIC', 'MELEE', 'DISTANCE', 'SHIELDING'
   * @returns {Object} Skill configuration with defaults
   */
  getSkillConfig(skillType) {
    return CONFIG.SKILLS && CONFIG.SKILLS[skillType]
      ? CONFIG.SKILLS[skillType]
      : {};
  },

  /**
   * Calculate total skill progression points
   * @param {number} basePoints - Base points for the action
   * @param {string} vocationName - Vocation name in uppercase
   * @param {string} skillType - Skill type for multiplier lookup
   * @param {Object} options - Additional options (bloodBonus, globalMultiplier)
   * @returns {number} Total points to add to skill
   */
  calculateSkillPoints(basePoints, vocationName, skillType, options = {}) {
    const skillConfig = this.getSkillConfig(skillType);
    const vocationMultiplier = this.getVocationMultiplier(skillType, vocationName);
    const globalMultiplier = skillConfig.GLOBAL_MULTIPLIER || options.globalMultiplier || 1;

    return basePoints * vocationMultiplier * globalMultiplier;
  }
};
