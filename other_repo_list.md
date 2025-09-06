---
layout: default
title: 其他Git仓库镜像列表
---

# 其他Git仓库镜像列表
{% for item in site.data.other_repo_list %}- <{{ item.repo_url }}>    
{% endfor %}