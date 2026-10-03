/*
 * Mayx的博客 · /offline.html 控制页控制器（classic script，PJAX 兼容）
 *
 * 本体是 IIFE，不含模块语法：PJAX 换页时 jQuery 会重新执行本文件，
 * 每次执行都重新查询元素、重新绑定事件，天然幂等。真正的解包逻辑在
 * ES module /assets/js/offline-unpack.js 中，通过动态 import() 加载
 * （浏览器模块缓存保证 PJAX 反复进入本页也不会重复加载）。
 * 注意：本文件经 Liquid 原样输出，不能使用模板语法字符。
 */

(function () {
  var MODULE_URL = '/assets/js/offline-unpack.js';
  // 压缩包大致量级（当前约 27MB），仅用于进度条比例，不影响正确性
  var EXPECTED_BYTES = 27 * 1024 * 1024;
  var busy = false;

  function el(id) { return document.getElementById(id); }
  function fmtMB(bytes) { return (bytes / 1048576).toFixed(1) + ' MB'; }

  function setMessage(text) {
    el('offline-message').textContent = text || '';
  }

  function showProgress(show) {
    el('offline-progress-box').hidden = !show;
  }

  function render(meta) {
    var online = !meta;
    el('offline-state').textContent = online
      ? '在线模式（离线未启用）'
      : '离线模式（优先从本地缓存加载）';
    el('offline-version').textContent = online ? '-' : fmtMB(meta.payloadSize) + '（压缩包大小即版本号）';
    el('offline-files').textContent = online ? '-' : meta.files + ' 个文件 / ' + fmtMB(meta.bytes);
    el('offline-time').textContent = online ? '-' : new Date(meta.unpackedAt).toLocaleString();
    el('offline-persist').textContent = online ? '-' : (meta.persisted ? '已授权（缓存不会被自动回收）' : '未授权（浏览器空间紧张时可能回收缓存）');
    el('offline-enable').disabled = busy || !online;
    el('offline-disable').disabled = busy || online;
  }

  function onProgress(info) {
    if (info.done) return;
    el('offline-progress').value = Math.min(100, (info.bytes / EXPECTED_BYTES) * 100);
    el('offline-progress-text').textContent =
      '已解包 ' + info.files + ' 个文件（' + fmtMB(info.bytes) + '）…';
  }

  function withModule(fn) {
    return import(MODULE_URL).then(fn);
  }

  function refresh() {
    if (!('serviceWorker' in navigator) || !('caches' in window)) {
      el('offline-state').textContent = '当前浏览器不支持离线模式（需要 Service Worker）';
      el('offline-enable').disabled = true;
      el('offline-disable').disabled = true;
      return;
    }
    withModule(function (mod) { return mod.ensureFresh(); }).then(function (fresh) {
      render(fresh.ready ? fresh.meta : null);
      if (fresh.stale) {
        setMessage('检测到站点压缩包已更新，离线缓存已自动失效，当前处于在线模式。可重新启用离线模式。');
      }
    }).catch(function (e) {
      setMessage('状态检测失败：' + (e && e.message ? e.message : e));
    });
  }

  function onEnable() {
    busy = true;
    render(null);
    showProgress(true);
    setMessage('正在下载并解包站点压缩包，请保持网络连接…');
    withModule(function (mod) { return mod.activateOffline({ onProgress: onProgress }); })
      .then(function (meta) {
        el('offline-progress').value = 100;
        el('offline-progress-text').textContent = '解包完成';
        setMessage('离线模式已启用。之后访问本博客将优先使用本地缓存，断网也能阅读。');
        busy = false;
        showProgress(false);
        render(meta); // 立即展示离线状态，不必等后台刷新
      })
      .catch(function (e) {
        setMessage('启用失败：' + (e && e.message ? e.message : e));
        busy = false;
        showProgress(false);
        refresh();
      });
  }

  function onDisable() {
    busy = true;
    setMessage('');
    withModule(function (mod) { return mod.deactivateOffline(); })
      .then(function () {
        setMessage('已切回在线模式，之后页面将通过网络加载。');
        busy = false;
        render(null);
        if (navigator.onLine) {
          setTimeout(function () { location.reload(); }, 800);
        }
      })
      .catch(function (e) {
        setMessage('操作失败：' + (e && e.message ? e.message : e));
        busy = false;
        refresh();
      });
  }

  function bind() {
    var enable = el('offline-enable');
    if (!enable) return; // 不在控制页（PJAX 容错）
    enable.addEventListener('click', onEnable);
    el('offline-disable').addEventListener('click', onDisable);
    refresh();
  }

  bind();
})();
