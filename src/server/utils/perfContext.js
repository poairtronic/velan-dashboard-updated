const { AsyncLocalStorage } = require('async_hooks');
const perfLocalStorage = new AsyncLocalStorage();
module.exports = perfLocalStorage;
