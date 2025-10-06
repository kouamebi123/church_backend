const cluster = require('cluster');
const os = require('os');

if (cluster.isMaster) {
  const numCPUs = process.env.WEB_CONCURRENCY
    ? parseInt(process.env.WEB_CONCURRENCY, 10)
    : os.cpus().length;

  console.log(`Master ${process.pid} is running. Spawning ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.error(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    cluster.fork();
  });
} else {
  require('./server');
}
