import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { hostname } from "node:os";
import wisp from "wisp-server-node";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCompress from "@fastify/compress";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

let indexHtmlWithInlineCss = null;
function getIndexWithInlineCss() {
	if (indexHtmlWithInlineCss) return indexHtmlWithInlineCss;
	try {
		const css = readFileSync(path.join(publicDir, 'css', 'loading.css'), 'utf8');
		let html = readFileSync(path.join(publicDir, 'index.html'), 'utf8');
		html = html.replace(/<link rel="stylesheet" href="[^"]*loading\.css"[^>]*\/?>/, '<style>' + css + '</style>');
		indexHtmlWithInlineCss = html;
	} catch (e) {
		console.error('Failed to inline CSS:', e.message);
		indexHtmlWithInlineCss = readFileSync(path.join(publicDir, 'index.html'), 'utf8');
	}
	return indexHtmlWithInlineCss;
}

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'production';

const activeConnections = new Set();

const fastify = Fastify({
	serverFactory: (handler) => {
		return createServer()
			.on("request", (req, res) => {
				const pathname = (req.url || "").split("?")[0];
				const isDocOrStatic = pathname === "/" || pathname === "/index.html" ||
					pathname.startsWith("/css/") || pathname.startsWith("/js/") ||
					pathname.startsWith("/images/") || pathname.startsWith("/baremux/") ||
					pathname.startsWith("/epoxy/") ||
					/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|webp)$/i.test(pathname);
				if (!isDocOrStatic) {
					res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
					res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
				}
				res.setHeader("Connection", "keep-alive");
				res.setHeader("Keep-Alive", "timeout=30, max=1000");
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				if (req.url.endsWith("/wisp/")) {
					activeConnections.add(socket);
					socket.setKeepAlive(true, 30000);
					socket.setTimeout(0);
					
					socket.on('close', () => {
						activeConnections.delete(socket);
					});
					
					socket.on('error', (err) => {
						activeConnections.delete(socket);
						if (err.code !== 'ECONNRESET') {
							console.error('WebSocket error:', err.code);
						}
					});
					
					wisp.routeRequest(req, socket, head);
				} else {
					socket.end();
				}
			});
	},
	logger: NODE_ENV === 'development',
	bodyLimit: 10 * 1024 * 1024,
	requestTimeout: 30000,
	keepAliveTimeout: 30000,
	connectionTimeout: 30000
});

fastify.register(fastifyCompress, {
	global: true,
	threshold: 1024,
	encodings: ['gzip', 'deflate', 'br'],
	customTypes: /^(?!image\/|video\/|audio\/|application\/octet-stream)/
});

fastify.get("/css/loading.css", (req, reply) => {
	return reply.type("text/css; charset=utf-8").sendFile("css/loading.css", publicDir);
});

fastify.get("/", (req, reply) => {
	return reply.type("text/html; charset=utf-8").send(getIndexWithInlineCss());
});
fastify.get("/index.html", (req, reply) => {
	return reply.type("text/html; charset=utf-8").send(getIndexWithInlineCss());
});

fastify.register(fastifyStatic, {
	root: publicDir,
	prefix: "/",
	decorateReply: true,
	cacheControl: true,
	maxAge: NODE_ENV === 'development' ? 0 : 86400000,
	immutable: NODE_ENV !== 'development',
	etag: true,
	lastModified: true,
	preCompressed: true
});

const faviconCache = new Map();
const FAVICON_CACHE_TTL = 3600000;

fastify.get("/favicon-proxy", async (req, reply) => {
	try {
		const { url } = req.query;
		
		if (!url) {
			return reply.code(400).send({ error: 'URL parameter required' });
		}
		
		const cached = faviconCache.get(url);
		if (cached && Date.now() - cached.timestamp < FAVICON_CACHE_TTL) {
			reply.header('Content-Type', cached.contentType);
			reply.header('Cache-Control', 'public, max-age=86400');
			reply.header('Access-Control-Allow-Origin', '*');
			reply.header('X-Cache', 'HIT');
			return reply.send(cached.buffer);
		}
		
		const urlObj = new URL(url);
		const validServices = [
			'www.google.com',
			'icons.duckduckgo.com',
			'favicons.githubusercontent.com',
			't0.gstatic.com',
			't1.gstatic.com',
			't2.gstatic.com',
			't3.gstatic.com'
		];
		
		if (!validServices.includes(urlObj.hostname)) {
			return reply.code(403).send({ error: 'Invalid favicon service' });
		}
		
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 3000);
		
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				'Accept': 'image/*,*/*;q=0.8'
			},
			signal: controller.signal
		});
		
		clearTimeout(timeoutId);
		
		if (!response.ok) {
			return reply.code(response.status).send({ error: 'Failed to fetch favicon' });
		}
		
		const contentType = response.headers.get('content-type') || 'image/x-icon';
		const buffer = Buffer.from(await response.arrayBuffer());
		
		if (buffer.length < 50000) {
			faviconCache.set(url, {
				buffer,
				contentType,
				timestamp: Date.now()
			});
			
			if (faviconCache.size > 500) {
				const now = Date.now();
				for (const [key, value] of faviconCache) {
					if (now - value.timestamp > FAVICON_CACHE_TTL) {
						faviconCache.delete(key);
					}
				}
			}
		}
		
		reply.header('Content-Type', contentType);
		reply.header('Cache-Control', 'public, max-age=86400');
		reply.header('Access-Control-Allow-Origin', '*');
		reply.header('X-Cache', 'MISS');
		
		return reply.send(buffer);
		
	} catch (error) {
		if (error.name === 'AbortError') {
			return reply.code(504).send({ error: 'Favicon request timeout' });
		}
		console.error('Favicon proxy error:', error.message);
		return reply.code(500).send({ error: 'Internal server error' });
	}
});

fastify.register(fastifyStatic, {
	root: epoxyPath,
	prefix: "/epoxy/",
	decorateReply: false,
	cacheControl: true,
	maxAge: 86400000
});

fastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: "/baremux/",
	decorateReply: false,
	cacheControl: true,
	maxAge: 86400000
});

fastify.get("/health", (req, reply) => {
	reply.send({ 
		status: 'ok', 
		uptime: process.uptime(),
		connections: activeConnections.size
	});
});

fastify.setErrorHandler((error, request, reply) => {
	fastify.log.error(error);
	reply.status(500).send({ error: 'Internal Server Error' });
});

async function shutdown() {
	console.log('Shutting down gracefully...');
	
	for (const socket of activeConnections) {
		try {
			socket.end();
		} catch (e) {
		}
	}
	activeConnections.clear();
	
	try {
		await fastify.close();
		console.log('Server closed');
		process.exit(0);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

fastify.listen({ port: PORT, host: HOST }, (err) => {
	if (err) {
		fastify.log.error(err);
		process.exit(1);
	}

	const address = fastify.server.address();
	console.log(`Server running in ${NODE_ENV} mode`);
	console.log(`Listening on:`);
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	if (address.family === 'IPv6') {
		console.log(`\thttp://[${address.address}]:${address.port}`);
	} else {
		console.log(`\thttp://${address.address}:${address.port}`);
	}
});
