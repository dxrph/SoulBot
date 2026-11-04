const { roles } = require('./template');

const ranks = roles.filter((r) => r.group === 'rank');

// Free ranks are picked by the member; verified ones (verify: true in the template) need staff approval
const freeRanks = ranks.filter((r) => !r.verify);
const verifiedRanks = ranks.filter((r) => r.verify);
const rankByKey = (key) => ranks.find((r) => r.key === key);

module.exports = { freeRanks, verifiedRanks, rankByKey };
