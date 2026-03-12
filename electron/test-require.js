const e = require('electron');
console.log('typeof:', typeof e);
if (typeof e === 'object' && e !== null) {
  console.log('has app:', !!e.app);
  console.log('app type:', typeof e.app);
} else {
  console.log('value:', String(e).slice(0, 80));
}
setTimeout(() => process.exit(0), 200);
