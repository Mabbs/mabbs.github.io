---
layout: default
title: 代理列表
---

  源站：<https://mabbs.github.io> <img src="https://mabbs.github.io/images/online.svg" style="width:22px;vertical-align: bottom" onerror="this.src = '/images/offline.svg'"/>   



# 代理列表
考虑到中国对于Github Pages在很多地区都有一定程度的解析异常，所以我为我的博客做了很多反向代理。以下代理站均为官方授权：   
（根据可能的可用性排序）   
{% for item in site.data.proxies %}
- <{{ item.url }}> <img src="{{ item.url }}images/online.svg" style="width:22px;vertical-align: bottom" onerror="this.src = '/images/offline.svg'"/>   
{% endfor %}

# 镜像列表
由于[Github已经不再可信](/2022/01/04/banned.html)，所以现在提供以下镜像站：   
{% for item in site.data.mirrors %}
- <{{ item.url }}> <img src="{{ item.url }}images/online.svg" style="width:22px;vertical-align: bottom" onerror="this.src = '/images/offline.svg'"/>   
{% endfor %}

# 其他平台博客（备用）
- <https://unmayx.blogspot.com/>   
- <https://unmayx.blog.fc2blog.us/>   
- <https://unmayx.wordpress.com/>   
- <https://mayx.code.blog/>   
- <https://mayx.home.blog/>   
- <https://unmayx.medium.com/>   
- <https://mayx.cnblogs.com/>   
- <https://mayx.xlog.app/>   
