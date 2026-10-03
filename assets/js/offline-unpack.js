/*
 * Mayx的博客 · 离线模式核心逻辑（/offline.html 控制页使用，ES module）
 *
 * - activateOffline()：注册 SW，下载站点压缩包 /MayxBlog.7z，经 libarchive(WASM)
 *   流式解包，把每个文件按站点路径写入 Cache Storage，最后写入就绪标记
 *   （清单 + payloadSize 版本号），自此进入离线模式。
 * - ensureFresh()：HEAD 探测线上压缩包大小，与标记中的 payloadSize 不一致
 *   说明站点已更新 → 清空缓存，回退在线模式。
 * - deactivateOffline()：清空缓存，手动切回在线模式。
 * - readStatus()：读取当前离线状态，供控制页展示。
 *
 */

const ARCHIVE_URL = '/MayxBlog.7z';
const ARCHIVE_ROOT = 'blog/';
const CACHE_NAME = 'mayxblog-offline-v1';
const READY_KEY = '/__offline_manifest__';
const WORKER_URL = '/vendor/libarchive/worker-bundle.js';

const MIME = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  xsl: 'text/xsl; charset=utf-8',
  opml: 'text/x-opml; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  '7z': 'application/x-7z-compressed',
  zip: 'application/zip',
  wasm: 'application/wasm',
  mtn: 'application/octet-stream',
  moc: 'application/octet-stream',
  pdf: 'application/pdf',
};

function mimeFor(pathname) {
  const dot = pathname.lastIndexOf('.');
  const ext = dot === -1 ? '' : pathname.slice(dot + 1).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function sitePathFor(entryPath) {
  const normalized = entryPath.replace(/\\/g, '/');
  if (!normalized.startsWith(ARCHIVE_ROOT)) return null;
  const relative = normalized.slice(ARCHIVE_ROOT.length);
  if (!relative) return null;

  const segments = [];
  for (const segment of relative.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') return null;
    segments.push(segment);
  }
  if (!segments.length) return null;
  return '/' + segments.join('/');
}

/*
 * 在独立 worker 中打开一层压缩包并流式吐出条目；
 * 返回其中根级嵌套压缩包（下一层包装）的原始字节。
 */
function extractLayer(file, onEntry) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_URL);
    const nested = [];
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      if (error) reject(error);
      else resolve(nested);
    };

    worker.addEventListener('error', (event) => {
      finish(new Error(event.message || 'libarchive worker failed'));
    });

    worker.addEventListener('message', ({ data }) => {
      if (data.type === 'ERROR') {
        finish(new Error(data.error && data.error.message ? data.error.message : 'libarchive failed'));
        return;
      }
      if (data.type === 'READY') {
        worker.postMessage({ type: 'OPEN', file });
        return;
      }
      if (data.type === 'OPENED') {
        worker.postMessage({ type: 'EXTRACT_FILES' });
        return;
      }
      if (data.type === 'END') {
        finish(null);
        return;
      }
      if (data.type !== 'ENTRY') return;

      const entry = data.entry;
      if (entry.type !== 'FILE' || !entry.fileData) return;

      // 根级压缩包是下一层包装，不是站点内容
      if (entry.path.replace(/\\/g, '/') === 'MayxBlog.7z') {
        nested.push(entry.fileData);
        return;
      }
      onEntry(entry);
    });
  });
}

/* 几十 MB 的缓存是浏览器常见的回收对象，而重新解包代价高，尽量申请持久存储。 */
async function requestPersistence() {
  if (!navigator.storage || !navigator.storage.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/* 读取就绪标记（= 离线模式状态）；损坏或缺清单的标记视为不存在。 */
export async function readStatus() {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(READY_KEY);
  if (!hit) return null;
  const meta = await hit.json().catch(() => null);
  if (!meta || !Array.isArray(meta.keys) || !meta.keys.length) return null;
  return meta;
}

/*
 * 线上压缩包的大小即版本号。HEAD 不被 SW 拦截，拿到的一定是线上真实值；
 * 网络失败返回 null，调用方选择信任现有缓存而不是误伤。
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
 * 控制页打开时调用：未启用 → {ready:false}；已启用且版本一致 → {ready:true, meta}；
 * 版本不一致 → 清空缓存并返回 {ready:false, stale:true}（已回退在线模式）。
 */
export async function ensureFresh() {
  const cache = await caches.open(CACHE_NAME);
  const size = await payloadSize();
  const meta = await readStatus();

  if (!meta) return { ready: false, size, stale: false };
  if (size && meta.payloadSize !== size) {
    await caches.delete(CACHE_NAME);
    return { ready: false, size, stale: true };
  }
  return { ready: true, size, stale: false, meta };
}

/*
 * 启用离线模式：注册 SW → 清空旧缓存（同时清掉上次中断的残留，保证随后
 * 的压缩包下载不会被旧缓存喂旧的 quine 副本）→ 下载并逐层解包 → 写标记。
 */
export async function activateOffline({ onProgress } = {}) {
  if (!('serviceWorker' in navigator)) {
    throw new Error('当前浏览器不支持 Service Worker，无法启用离线模式。');
  }
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  await caches.delete(CACHE_NAME);

  const persisted = await requestPersistence();

  // 写操作串行链，保证按到达顺序落盘且不产生无界并发
  const cache = await caches.open(CACHE_NAME);
  let writes = Promise.resolve();
  const keys = new Set();
  let files = 0;
  let bytes = 0;
  let skipped = 0;

  const response = await fetch(ARCHIVE_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`无法下载站点压缩包：HTTP ${response.status}`);
  const outer = await response.arrayBuffer();
  const downloadedBytes = outer.byteLength;

  let layer = [outer];
  while (layer.length) {
    const bytesThisLayer = layer.shift();
    const file = new File([bytesThisLayer], 'MayxBlog.7z');

    layer = await extractLayer(file, (entry) => {
      const key = sitePathFor(entry.path);
      if (!key) {
        skipped += 1;
        return;
      }
      const body = entry.fileData;
      files += 1;
      bytes += body.byteLength;

      writes = writes.then(async () => {
        await cache.put(key, new Response(body, {
          status: 200,
          headers: { 'Content-Type': mimeFor(key) },
        }));
        keys.add(key);
      });

      if (onProgress) onProgress({ done: false, files, bytes, skipped });
    });
  }

  await writes;

  const meta = {
    files,
    bytes,
    skipped,
    persisted,
    payloadSize: downloadedBytes,
    failed: files - keys.size,
    keys: [...keys],
    unpackedAt: new Date().toISOString(),
  };
  await cache.put(
    READY_KEY,
    new Response(JSON.stringify(meta), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  );

  if (onProgress) onProgress({ done: true, cached: false, ...meta });
  return meta;
}

/* 切回在线模式：删掉缓存（含标记），SW 随即恢复纯转发。返回之前是否处于离线模式。 */
export async function deactivateOffline() {
  const had = await readStatus();
  await caches.delete(CACHE_NAME);
  return Boolean(had);
}
