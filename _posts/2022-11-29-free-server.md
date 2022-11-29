---
layout: post
title: 体验小白也会使用的免费容器云
tags: [Docker, 容器, 免费]
---

  Heroku虽然倒了，但是我们还有更多的选择<!--more-->    

# 起因
  从昨天开始，Heroku就不再提供免费的容器云服务了，虽然我有Github的学生包，但是试了一下要绑银行卡就算了。不过虽然这么说，我其实一次也没用过Heroku，因为它要安装奇奇怪怪的软件用起来很不人性化。不过最近也正好需要一个服务器来供我测试，那应该怎么办呢？   

# Koyeb的体验
  后来我在寻找的时候找到了一家叫做[Koyeb](https://www.koyeb.com/)的平台，也是容器云，还是免费的。用Github登录之后就可以使用了，试了一下感觉很不错啊，它和其他免费容器云最不一样的可能就是它能直接部署Docker Hub上的项目，不用在Github上新建乱七八糟的仓库，也不用安装乱七八糟的软件，非常的人性化啊。   
  既然能部署Docker Hub的项目，那可选择的余地就太大了，我直接随便部署一个发行版就能当免费的VPS来用，不过既然能直接部署了，还是安点什么好吧……我想了想干脆安装个宝塔面板吧，正好他们官方也提供了[Docker镜像](https://hub.docker.com/r/btpanel/baota)，直接部署就行，另外为了正常访问，需要映射8888端口，另外为了方便访问网站，还要映射一个80端口。不过它只给了一个地址，所以如果要映射多个端口就只能设定路径……像我是给面板设定的根目录，方便我配置，至于网站嘛……之后再考虑吧，这里我先填了一个`/app`的路径便于之后使用。   
  这样安装出来的面板直接根据镜像文档的说明就可以登录了，不过登录之后会要求绑定手机号……我不太想整这个东西，于是在网上找了个宝塔纯净版，在Koyeb的Console里面执行：
```bash
curl http://v7.hostcli.com/install/update6.sh|bash
```
  运行之后就可以跳过绑定宝塔账号的步骤了，还能安装企业版插件，还是挺不错的。不过不知道是什么问题，网页端的SSH好像用不了……这个建议使用frp等方式反代一下再用，免费的frp服务器还是比较好找的。   
## 建站方法
  因为之前已经映射了80端口，所以直接用提供的链接就能打开之前建好的网站（例如example.koyeb.app/app）。不过对于有些网站来说有个问题，那就是它的程序可能资源不允许在不是根目录的地方，这样它读取文件的时候就会从宝塔面板的路径读取了，然后就会出现例如404的错误。为了解决这个问题我想了一下，干脆让Cloudflare Workers反代它吧（理论上应该绑定域名然后在Cloudflare上配置重写规则应该也行），所以就写了个简单的脚本：   
```javascript
addEventListener(
    "fetch",event => {
        let url=new URL(event.request.url);
        url.protocol="https";
        url.hostname="example.koyeb.app";
        url.pathname="/app" + event.request.url.substring(event.request.url.indexOf('/',8),(event.request.url + "?").indexOf('?'));
        let request=new Request(url,event.request);
        event. respondWith(
            fetch(request)
        )
    }
)
```
  这样访问网站的时候就不会遇到404的情况了。不过这样做还有一个缺陷就是HTTP_HOST环境变量会是错的，有些程序会读取它，导致链接可能会出问题，这种情况就只能通过修改fastcgi的环境变量配置文件来解决了……   
## 搭梯子的方法
  一般租服务器，可能除了搭网站，就是搭梯子了。所以我想在建站的同时搭个梯子，正好网站也算是梯子的伪装了。   
  这次我搭梯子不想用v2ray了，我想换个之前在Github上看到的一个重新实现的v2ray，叫[verysimple](https://github.com/e1732a364fed/v2ray_simple)，据说速度比v2ray要快很多，不过它用的那个toml我看的不是很明白，因为之前配了[Tor](/2022/11/16/tor.html)和[i2p](/2022/11/23/i2p.html)，用到了路由功能，它这个路由功能……也没个文档，本来想给自己的服务器换一下，这看起来不知道怎么配就算了。不过在这个免费的测试机上不需要有那么多功能，只是当个普通梯子还是很简单的，而且它的配置文件能通过交互模式生成还挺有意思的。   
  像我的话配置文件很简单，就是这个样子：   
```toml
[[listen]]
  tag = "my_proxy"
  host = "***"
  ip = "0.0.0.0"
  port = 8080
  xver = 0
  tls = false
  path = "***"
  advancedLayer = "ws"
  protocol = "vless"
  uuid = "***"
  version = 0

[[dial]]
  port = 0
  xver = 0
  protocol = "direct"
  version = 0
```
  然后在我的网站的nginx里配置相应的路由：   
```conf
    location /***{
  		proxy_set_header X-Original-Host $host;
  		proxy_set_header X-Real-IP $remote_addr;
  		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  		proxy_set_header Host ***;
  		proxy_http_version 1.1;
  		proxy_set_header Upgrade $http_upgrade;
  		proxy_set_header Connection "Upgrade";
  		proxy_pass http://127.0.0.1:8080;
    }
```
  就可以正常使用了，试了一下效果还不错，不知道这个流量是怎么算的，Koyeb的面板上也没有关于流量费的介绍……难不成是不限流量？   

# 感想
  免费的东西虽好，不过既然Heroku都被薅没了，Koyeb这种小白都能免费用的容器云……只能说且用且珍惜了……
