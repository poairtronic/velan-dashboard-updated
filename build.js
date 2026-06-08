const { build } = require('vite');

build({}).catch((err) => {
  console.error(err);
  process.exit(1);
});
