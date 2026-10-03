/*
 * Mayx的博客 · 离线模式 Service Worker
 *
 * 两种模式（由 Cache Storage 中是否存在就绪标记决定）：
 * - 在线模式（默认，无标记）：所有请求原样转发网络，SW 形同虚设。
 * - 离线模式（/offline.html 启用后写入标记）：同源 GET 请求缓存优先，
 *   缓存未命中且清单里没有的路径才回源网络，实现断网阅读。
 *
 * 版本控制：压缩包 /MayxBlog.7z 的 content-length 即版本号（每次重新部署
 * 都会变化）。SW 激活时、以及导航请求按 RECHECK_INTERVAL 节流复核；
 * 一旦发现线上压缩包与已缓存版本不一致，立即清空缓存 → 自动回退在线模式。
 * 网络不可用时复核失败，保留缓存（离线阅读本来就是离线模式的目的）。
 */

const CACHE_NAME = 'mayxblog-offline-v1';
const READY_KEY = '/__offline_manifest__';
const ARCHIVE_URL = '/MayxBlog.7z';
const RECHECK_INTERVAL = 5 * 60 * 1000;

let lastRecheck = 0;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(verifyPayloadVersion)
      .then(() => self.clients.claim())
  );
});

/*
 * HEAD 请求不被下面的 fetch 处理器拦截，这里读到的一定是线上真实压缩包，
 * 而不是缓存里的 quine 副本。网络失败返回 null，调用方选择信任现有缓存。
 */
async function payloadSize() {
  try {
    const response = await fetch(ARCHIVE_URL, { method: 'HEAD', cache: 'no-store' });
    if (!response.ok) return null;
    const size = Number(response.headers.get('content-length'));
    return Number.isFinite(size) && size > 0 ? size : null;
  } catch {
    return null;
  }
}

/*
 * 就绪标记同时是清单：记录了解包写入的所有路径。没有它就无法区分
 * “站点本来就没有这个页面”和“缓存条目被浏览器回收了”。
 */
async function readManifest(cache) {
  const hit = await cache.match(READY_KEY);
  if (!hit) return null;
  const meta = await hit.json().catch(() => null);
  if (!meta || !Array.isArray(meta.keys) || !meta.keys.length) return null;
  return meta;
}

/* 压缩包更新 → 清空缓存（即回退在线模式）；返回是否发生了失效。 */
async function verifyPayloadVersion() {
  const cache = await caches.open(CACHE_NAME);
  const meta = await readManifest(cache);
  if (!meta) return false;
  const size = await payloadSize();
  if (size && meta.payloadSize !== size) {
    await caches.delete(CACHE_NAME);
    return true;
  }
  return false;
}

/* 服务器对目录索引的处理与 Jekyll 产物一致，这里补齐候选路径。 */
function candidatesFor(pathname) {
  const keys = [pathname];
  if (pathname.endsWith('/')) {
    keys.push(pathname + 'index.html');
  } else {
    keys.push(pathname + '/index.html');
    keys.push(pathname + '.html');
  }
  return keys;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return; // HEAD 等直通网络（版本探测依赖这一点）

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 跨域请求不干预

  // 显式 no-store 的请求（重新下载压缩包等）绕过缓存，避免吃到旧的 quine 副本
  if (request.cache === 'no-store') return;

  event.respondWith(respond(request, url, event));
});

async function respond(request, url, event) {
  const cache = await caches.open(CACHE_NAME);

  // 导航请求顺带做节流版本复核；失效发生在后台，本次响应不受影响，
  // 下一次请求自然落入在线模式。
  if (request.mode === 'navigate' && Date.now() - lastRecheck > RECHECK_INTERVAL) {
    lastRecheck = Date.now();
    event.waitUntil(verifyPayloadVersion());
  }

  const candidates = candidatesFor(url.pathname);
  for (const key of candidates) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }

  const meta = await readManifest(cache);
  if (!meta) return fetch(request); // 在线模式：纯转发

  // 清单承诺过这个路径但缓存里没有 → 条目被浏览器回收，缓存已不可信，
  // 整体作废并回退在线模式。
  if (candidates.some((key) => meta.keys.includes(key))) {
    await caches.delete(CACHE_NAME);
    return fetch(request);
  }

  // 清单之外的路径回源网络；断网时的导航请求用站点 404 页兜底。
  try {
    return await fetch(request);
  } catch (error) {
    if (request.mode === 'navigate') {
      const notFound = await cache.match('/404.html');
      if (notFound) {
        return new Response(notFound.body, { status: 404, headers: notFound.headers });
      }
    }
    throw error;
  }
}
