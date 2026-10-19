// Which roles to add and remove so that, among `all`, the member ends up with exactly `wanted`
function diffRoles(all, wanted, has) {
  return {
    remove: all.filter((r) => has(r) && !wanted.includes(r)),
    add: wanted.filter((r) => !has(r)),
  };
}

module.exports = { diffRoles };
