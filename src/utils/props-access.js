// src/utils/props-access.js
const { db } = require('./properties');

function listAccessibleProps(userId, filterType = null) {
  const store = db(); const all = store.owned || [];
  return all.filter(p => {
    if (filterType && p.ptype !== filterType) return false;
    if (p.ownerId === userId) return true;
    const acc = p.access || [];
    return acc.some(a => a.userId === userId && (a.rights || []).length);
  });
}
module.exports = { listAccessibleProps };
