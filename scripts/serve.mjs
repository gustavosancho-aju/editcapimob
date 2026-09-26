
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' };
const port = Number(process.env.PORT || 3000);
http.createServer(async (request,response) => {
  if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405,{Allow:'GET, HEAD'}); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const allowed = pathname === '/' || pathname === '/index.html' || /^\/(src|public)\/[a-zA-Z0-9._/-]+$/.test(pathname);
    const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
    const full = path.resolve(root,requested);
    if (!allowed || !full.startsWith(root) || requested.split('/').includes('..')) { response.writeHead(404);response.end('Não encontrado');return; }
    const body=await readFile(full);
    response.writeHead(200,{
      'Content-Type':types[path.extname(full)] || 'application/octet-stream',
      'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'strict-origin-when-cross-origin',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' https://images.pexels.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      'Cache-Control':'no-store'
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404);response.end('Não encontrado'); }
}).listen(port,'127.0.0.1',()=>console.log('EditCapImob: http://localhost:'+port));
