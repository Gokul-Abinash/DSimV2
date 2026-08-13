const config = {};
for (let i = 1; i <= 64; i++) {
  config[`Node${i}`] = "honest";
}

module.exports = config;