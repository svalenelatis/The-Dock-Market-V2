/**
 * Pure utility for building audit record objects.
 * No side effects, no database access — just object construction.
 */

/**
 * Builds an audit record object for tracking admin actions.
 * This is a pure function that returns a shaped object with a timestamp.
 * It does NOT persist to the database.
 *
 * @param {string} adminId - UUID of the acting admin
 * @param {string} action - 'CREATE' | 'UPDATE' | 'DELETE'
 * @param {string} entityType - 'item' | 'city' | 'city_tag' | 'random_event' | 'admin_user'
 * @param {string} entityId - UUID of the affected entity
 * @param {object} [details] - Optional payload/changes object
 * @returns {{ admin_id: string, action: string, entity_type: string, entity_id: string, details: object|null, timestamp: string }}
 */
function buildAuditRecord(adminId, action, entityType, entityId, details) {
  return {
    admin_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details || null,
    timestamp: new Date().toISOString(),
  }
}

module.exports = {
  buildAuditRecord,
}
