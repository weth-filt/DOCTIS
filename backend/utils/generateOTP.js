const { randomInt } = require("node:crypto");
module.exports = () => String(randomInt(100000, 1000000));
