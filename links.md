---
layout: post
title: Links
date: 2019-05-03
id: links
tags: [links]
---

| Link | Description |
| - | - |
{% for item in site.data.links %}| <a href="{{ item.link }}" target="_blank" rel="noopener sponsored" {% if item.feed_url %}data-feed="{{ item.feed_url }}"{% endif %}>{{ item.title }}</a> | {% if item.description %}{{ item.description }}{% else %}*No description*{% endif %} |
{% endfor %}

订阅以上链接：[OPML](/blogroll.opml)   

## Links申请
请在下面留言或者直接[修改Links](https://github.com/Mabbs/mabbs.github.io/edit/master/_data/links.csv)并发起PR   
请在申请之前加上本站友链   
要求：
1. 全站HTTPS
2. 原创文章比例>80%，数量>10
3. 站点稳定，不弃坑

## 本站信息
名称：Mayx的博客   
简介：Mayx's Home Page   
链接：<https://mabbs.github.io>   
订阅：<https://mabbs.github.io/atom.xml>   
头像：<https://avatars0.githubusercontent.com/u/17966333>   
Logo：<https://mabbs.github.io/favicon.ico>

<!--[if !IE]> -->
<script src="/assets/js/rss-feed-preview.js"></script>
<!-- <![endif]-->