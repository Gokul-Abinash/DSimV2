const config = {};
for (let i = 1; i <= 128; i++) {
  config[`Node${i}`] = "honest";
}

module.exports = config;