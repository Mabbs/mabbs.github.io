---
layout: default
title: 代理列表
---

  源站：<https://mabbs.github.io/> <img src="https://mabbs.github.io/images/online.svg" style="width: 1.2em; vertical-align: text-bottom;" onerror="this.outerHTML='ⓧ'"/>   



# 代理列表
考虑到中国对于Github Pages在很多地区都有一定程度的解析异常，所以我为我的博客做了很多反向代理。以下代理站均为官方授权：   
（根据可能的可用性排序）   
{% for item in site.data.proxylist.proxies %}- <{{ item }}> <img src="{{ item }}images/online.svg" style="width: 1.2em; vertical-align: text-bottom;" onerror="this.outerHTML='ⓧ'"/>   
{% endfor %}

# 镜像列表
由于[Github已经不再可信](/2022/01/04/banned.html)，所以现在提供以下镜像站：   
{% for item in site.data.proxylist.mirrors %}- <{{ item }}> <img src="{{ item }}images/online.svg" style="width: 1.2em; vertical-align: text-bottom;" onerror="this.outerHTML='ⓧ'"/>   
{% endfor %}

# Git列表 
{% for item in site.data.proxylist.gits %}- <{{ item }}>    
{% endfor %}

# 服务架构
```mermaid
graph LR;
    Users@{ shape: stadium, label: "Users" }
    GH@{ shape: bow-rect, label: "GitHub" }
    GL@{ shape: bow-rect, label: "GitLab" }
    GE@{ shape: bow-rect, label: "Gitee" }
    OG@{ shape: bow-rect, label: "Other..." }
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
    CFW@{ label: "CloudFlare Workers" }
    CFAI@{ shape: procs, label: "CloudFlare AI" }
    CFD@{ shape: lin-cyl, label: "CloudFlare D1" }
    Deno@{ shape: curv-trap, label: "Deno" }
    Glitch@{ shape: curv-trap, label: "Glitch" }
    Other@{ shape: curv-trap, label: "Other..." }
    subgraph Repo
    GH
    GL
    GE
    OG
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
    end

    subgraph API[API Service]
    CFAI
    CFD
    CFW
    end
    
    subgraph Proxies
    Deno
    Glitch
    Other
    end
    
    subgraph DS[Decentralized storage]
    IPFS
    GF
    end
    
    GH <-- Sync --> GL
    GH -- Sync --> GE
    GH -. Sync .-> OG
    GH -- Deploy --> GHP & SH & Netlify & FELH & DA
    GL -- Deploy --> CFP & Vercel & GLP
    CFW -- Reverse Proxy --> GHP
    Deno -- Reverse Proxy --> GHP
    Glitch -- Reverse Proxy --> GHP
    Other -- Reverse Proxy --> GHP
    CFD <--> CFW
    CFAI <--> CFW
    API -- API/Proxy Service <--> Users
    Pages -- Serviced --> Users
    Proxies -- Serviced --> Users
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

# 其他不能CI/CD的静态托管（备用）
{% for item in site.data.proxylist.static %}- <{{ item }}>    
{% endfor %}

# 其他平台博客（备用）
{% for item in site.data.proxylist.others %}- <{{ item }}>    
{% endfor %}
