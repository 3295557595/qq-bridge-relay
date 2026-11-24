// QQ 桥接中转站：只传消息 ID，不传任何消息内容。
// 服务器上的 watcher 有新消息就 POST /ping 上来，
// Muse 的 hook 每 5 秒 GET /state，发现新 ID 就醒来去服务器上取消息回。
// 状态只放内存里，服务重启就丢——丢了也没事，watcher 会重推，
// 兜底还有 1 分钟定时检查和机器人自带的 180 秒备用回复。
const http = require('http');

let state = { count: 0, newest: null, ids: [], updatedAt: 0 };

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/state') {
    return sendJson(res, 200, state);
  }
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true });
  }
  if (req.method === 'POST' && req.url === '/ping') {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 65536) req.destroy();
    });
    req.on('end', () => {
      try {
        const body = JSON.parse(raw || '{}');
        const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string').slice(0, 100) : [];
        state = {
          count: ids.length,
          newest: typeof body.newest === 'number' ? body.newest : null,
          ids,
          updatedAt: Date.now(),
        };
        return sendJson(res, 200, { ok: true });
      } catch {
        return sendJson(res, 400, { ok: false, error: 'bad json' });
      }
    });
    return;
  }
  return sendJson(res, 404, { ok: false, error: 'not found' });
});

const port = parseInt(process.env.PORT || '3000', 10);
server.listen(port, () => console.log('qq-bridge-relay listening on ' + port));
