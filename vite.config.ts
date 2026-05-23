import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv, type Plugin } from "vite";

function isolatedStaticPlugin(options: {
	urlPrefix: string;
	dirAbs: string;
	indexFile: string;
}): Plugin {
	const { urlPrefix, dirAbs, indexFile } = options;
	const mime: Record<string, string> = {
		".html": "text/html; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".css": "text/css; charset=utf-8",
		".js": "text/javascript; charset=utf-8",
		".svg": "image/svg+xml",
		".png": "image/png",
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".ico": "image/x-icon",
		".txt": "text/plain; charset=utf-8",
	};

	return {
		name: "isolated-static",
		enforce: "pre",
		configureServer(server) {
			server.middlewares.use(urlPrefix, (req, res, next) => {
				try {
					const original = (req as { originalUrl?: string }).originalUrl ?? "";
					if (original === urlPrefix) {
						res.statusCode = 302;
						res.setHeader("location", `${urlPrefix}/`);
						return res.end();
					}
					let rel = decodeURIComponent((req.url || "/").split("?")[0]);
					if (rel === "/" || rel === "") rel = `/${indexFile}`;
					const full = path.resolve(dirAbs, `.${rel}`);
					if (full !== dirAbs && !full.startsWith(`${dirAbs}${path.sep}`)) {
						res.statusCode = 403;
						return res.end("Forbidden");
					}
					if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
						res.statusCode = 404;
						return res.end("Not found");
					}
					res.setHeader(
						"content-type",
						mime[path.extname(full).toLowerCase()] ||
							"application/octet-stream",
					);
					res.setHeader("cache-control", "no-cache");
					fs.createReadStream(full).pipe(res);
				} catch (err) {
					next(err);
				}
			});
		},
	};
}

const config = defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const port = Number.parseInt(env.PORT ?? "", 10);

	return {
		resolve: { tsconfigPaths: true },
		server: {
			port: Number.isFinite(port) ? port : 3000,
		},
		plugins: [
			isolatedStaticPlugin({
				urlPrefix: "/cost-analysis",
				dirAbs: path.resolve(process.cwd(), "analysis"),
				indexFile: "aws-cost-analysis.html",
			}),
			devtools(),
			nitro({ rollupConfig: { external: [/^@sentry\//] } }),
			tailwindcss(),
			tanstackStart(),
			viteReact(),
		],
	};
});

export default config;
