const express = require('express');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { createProxyServer } = require('http-proxy');
const { URL } = require('url');

const app = express();
const server = http.createServer(app);
const proxy = createProxyServer({ ws: true, changeOrigin: true, xfwd: true });

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // 60 requests per minute
});
app.use(limiter);

// Handle HTTP Proxy
app.get('/proxy', (req, res) => {
  const target = req.query.url;

  if (!target || !/^https?:\/\//.test(target)) {
    return res.status(400).send('Missing or invalid URL');
  }

  proxy.web(req, res, {
    target,
    headers: {
      host: new URL(target).host,
      origin: target,
      referer: target
    }
  }, (err) => {
    console.error('Proxy error:', err.message);
    res.status(502).send('Bad Gateway');
  });
});

// Handle WebSocket Proxy
server.on('upgrade', (req, socket, head) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const target = url.searchParams.get('url');

    if (!target || !/^wss?:\/\//.test(target)) {
      socket.destroy();
      return;
    }

    proxy.ws(req, socket, head, {
      target,
      headers: {
        host: new URL(target).host,
        origin: target,
        referer: target
      }
    }, (err) => {
      console.error('WebSocket error:', err.message);
      socket.destroy();
    });
  } catch (err) {
    socket.destroy();
  }
});

// Homepage UI
app.get('/', (req, res) => {
  res.send(`
    <h2>Game Proxy (Optimized)</h2>
    <form onsubmit="window.location.href='/proxy?url=' + encodeURIComponent(document.getElementById('url').value); return false;">
      <input id="url" placeholder="https://starblast.io" style="width:400px;" />
      <button type="submit">Launch Game</button>
    </form>
  `);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Proxy server running on port', PORT);
});
