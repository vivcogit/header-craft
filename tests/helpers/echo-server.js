import { createServer } from 'node:http';

export async function startEchoServer() {
  const server = createServer((request, response) => {
    response.writeHead(200, {
      'access-control-allow-origin': '*',
      'content-type': 'application/json',
    });
    response.end(JSON.stringify(request.headers));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, resolve);
  });

  const { port } = server.address();

  return {
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    }),
    url: (host, path) => `http://${host}:${port}${path}`,
  };
}
