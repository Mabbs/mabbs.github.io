---  
layout: default
title: 离线模式
---

# 离线模式

本页用于管理本博客的离线阅读功能：

- **启用离线模式**：浏览器会下载整站压缩包（`MayxBlog.7z`）并解包到本地缓存，之后即使没有网络也能正常浏览博客；
- **自动回退**：当站点压缩包更新（博客重新部署）时，离线缓存会自动失效并回退到在线模式，下次重新启用即可获取最新内容；
- **手动切换**：离线模式下可以随时在本页切回在线模式，切回后页面将重新通过网络加载。

<table>  
  <tbody>  
    <tr><th>当前状态</th><td id="offline-state">检测中…</td></tr>  
    <tr><th>缓存版本</th><td id="offline-version">-</td></tr>  
    <tr><th>文件统计</th><td id="offline-files">-</td></tr>  
    <tr><th>解包时间</th><td id="offline-time">-</td></tr>  
    <tr><th>持久存储</th><td id="offline-persist">-</td></tr>  
  </tbody>  
</table>

<p id="offline-progress-box" hidden="hidden">  
  <progress id="offline-progress" max="100" value="0"></progress>  
  
  <small id="offline-progress-text">准备中…</small>  
</p>

<p><strong id="offline-message"></strong></p>

<p>  
  <button type="button" id="offline-enable">启用离线模式</button>  
  <button type="button" id="offline-disable">切换回在线模式</button>  
</p>

<script src="/assets/js/offline-page.js"></script>
