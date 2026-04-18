const aedes = require("aedes")();
const net = require("net");
const server = net.createServer(aedes.handle);

server.listen(1883, () => {
  console.log("BROKER_READY");
});

aedes.on("client", (client) => {
  console.log(`CLIENT_CONNECTED ${client ? client.id : "unknown"}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  aedes.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
