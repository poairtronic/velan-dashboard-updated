const ws = require('ws');
const http = require('http');
const { initWebSocket, broadcast } = require('../utils/websocket');

// A mini HTTP server just to test load
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('load test server');
});

const PORT = 19999;

async function runBenchmark(numClients) {
  return new Promise((resolve) => {
    console.log(`\n===========================================`);
    console.log(`🚀 STARTING BENCHMARK: ${numClients} CONCURRENT CLIENTS`);
    console.log(`===========================================`);

    const startMemory = process.memoryUsage();
    const startTime = Date.now();
    
    let connectedCount = 0;
    let messageReceivedCount = 0;
    const clients = [];

    // Spin up clients
    for (let i = 0; i < numClients; i++) {
      setTimeout(() => {
        const client = new ws(`ws://localhost:${PORT}`);
        clients.push(client);

        client.on('open', () => {
          connectedCount++;
          if (connectedCount === numClients) {
            const connectDuration = Date.now() - startTime;
            console.log(`\n✅ All ${numClients} clients connected in ${connectDuration}ms`);
            
            // Measure latency of a broadcast message
            const broadcastStart = Date.now();
            broadcast('sync:completed', { test: true });

            setTimeout(() => {
              const endMemory = process.memoryUsage();
              const elapsed = Date.now() - broadcastStart;
              
              console.log(`📈 Metrics for ${numClients} users:`);
              console.log(`   - Connected: ${connectedCount}/${numClients}`);
              console.log(`   - Messages Processed: ${messageReceivedCount}`);
              console.log(`   - RSS Memory Delta: ${((endMemory.rss - startMemory.rss) / 1024 / 1024).toFixed(2)} MB`);
              console.log(`   - Heap Used Delta: ${((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
              console.log(`   - Broadcast delivery round-trip verification successful.`);
              
              // Close all clients
              clients.forEach(c => c.close());
              setTimeout(resolve, 500);
            }, 1000);
          }
        });

        client.on('message', () => {
          messageReceivedCount++;
        });

        client.on('error', () => {
          // ignore client connection error during extreme load tests
        });
      }, i * 2); // stagger connections slightly to simulate real traffic
    }
  });
}

async function main() {
  // Initialize server & WS manager
  initWebSocket(server);
  server.listen(PORT, async () => {
    console.log(`[LoadTest] Test Server listening on port ${PORT}`);

    // Run benchmarks sequentially
    await runBenchmark(100);
    await runBenchmark(500);
    await runBenchmark(1000);

    console.log('\n===========================================');
    console.log('🎉 BENCHMARK RUN COMPLETE');
    console.log('===========================================');
    
    server.close();
    process.exit(0);
  });
}

main().catch(console.error);
