---
layout: default
title: 代理列表
---

  源站：<https://mabbs.github.io> <img src="https://mabbs.github.io/images/online.svg" style="width:22px;vertical-align: bottom" onerror="this.src = '/images/offline.svg'"/>   



# 代理列表
考虑到中国对于Github Pages在很多地区都有一定程度的解析异常，所以我为我的博客做了很多反向代理。以下代理站均为官方授权：   
（根据可能的可用性排序）   
{% for item in site.data.proxylist.proxies %}- <{{ item.url }}> <img src="{{ item.url }}images/online.svg" style="width:22px;vertical-align: bottom" onerror="this.src = '/images/offline.svg'"/>   
{% endfor %}

# 镜像列表
由于[Github已经不再可信](/2022/01/04/banned.html)，所以现在提供以下镜像站：   
{% for item in site.data.proxylist.mirrors %}- <{{ item.url }}> <img src="{{ item.url }}images/online.svg" style="width:22px;vertical-align: bottom" onerror="this.src = '/images/offline.svg'"/>   
{% endfor %}

# 网站结构
```mermaid
graph LR;
    GH@{ shape: bow-rect, label: "GitHub" }
    GL@{ shape: bow-rect, label: "GitLab" }
    GE@{ shape: bow-rect, label: "Gitee" }
    CFP@{ shape: docs, label: "CloudFlare Pages" }
    GHP@{ shape: docs, label: "GitHub Pages" }
    GLP@{ shape: docs, label: "GitLab Pages" }
    FELH@{ shape: docs, label: "4EVERLAND Hosting" }
    IPFS@{ shape: lin-cyl, label: "IPFS" }
    GF@{ shape: lin-cyl, label: "Greenfield" }
    Vercel@{ shape: docs, label: "Vercel" }
    Netlify@{ shape: docs, label: "Netlify" }
    SH@{ shape: docs, label: "statichost.eu" }
    DA@{ shape: docs, label: "dAppling" }
    EOP@{ shape: docs, label: "EdgeOne Pages" }
    CFW@{ shape: curv-trap, label: "CloudFlare Workers" }
    Deno@{ shape: curv-trap, label: "Deno" }
    Glitch@{ shape: curv-trap, label: "Glitch" }
    Other@{ shape: curv-trap, label: "Other..." }
    subgraph Repo
    GH
    GL
    GE
    end
    
    subgraph Pages
    GHP
    GLP
    CFP
    SH
    FELH
    DA
    Vercel
    Netlify
    EOP
    end
    
    subgraph Proxies
    CFW
    Deno
    Glitch
    Other
    end
    
    subgraph DS
    IPFS
    GF
    end
    
    GH <--Sync--> GL
    GH -- Sync --> GE
    GH --> GHP & SH & FELH & DA & Netlify
    GL --> CFP & Vercel & GLP
    GE --> EOP
    
    CFW --> GHP
    Deno --> GHP
    Glitch --> GHP
    Other --> GHP
    
    FELH --> IPFS & GF
    DA --> IPFS
```

<script type="module">
   import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
   mermaid.initialize({ startOnLoad: false });
   await mermaid.run({
     querySelector: '.language-mermaid',
   });
</script>

# 其他平台博客（备用）
{% for item in site.data.proxylist.others %}- <{{ item.url }}>    
{% endfor %}
