
function hasSellerPerm(member) {
  const roleId = process.env.CONCESSION_ROLE_ID;
  const staffId = process.env.STAFF_ROLE_ID;
  if (!member) return false;
  return (roleId && member.roles.cache.has(roleId)) || (staffId && member.roles.cache.has(staffId));
}

module.exports = { hasSellerPerm };
