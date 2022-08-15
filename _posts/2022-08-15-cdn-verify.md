---
layout: post
title: 如何避免Cloudflare背后的源站被恶意访问
tags: [Cloudflare, CDN, 安全]
---

  Cloudflare还是非常完善的，只是我们不会用！<!--more-->    

# 起因
  很久以前我写过一篇文章是介绍关于[如何简单的找到Cloudflare背后源站IP](/2019/05/03/origip.html)的文章。虽然当时的我知道设置了防火墙白名单可以有效的解决这类问题。   
  不过随着Cloudflare的业务越来越广泛，设置白名单这种方法我感觉已经很不靠谱了。而且最近也遇到一个问题，就是花火学园的用户有些人会使用自动签到的脚本，比如[ForumSignin](https://github.com/LovesAsuna/ForumSignin)，使用这种脚本破坏了大家公平竞争的原则。虽然我用Cloudflare WAF写了一个很简单的规则解决掉了这个问题，但是万一有人悄悄的绕过了Cloudflare直接访问源站的方式签到那我设置的防火墙就没有一点点用处了。今天正好看到了Cloudflare的双向认证的功能，配置好之后也正好分享一下。

# 关于防火墙白名单的缺陷
  我们现在已经知道了Cloudflare除了本身CDN的业务外还加了很多花里胡哨的比如Workers，WARP之类的功能，这些功能有一个特点就是能利用Cloudflare自己的IP来任意发起请求，那防火墙本来就是通过检测访问的IP是不是来自Cloudflare这种方式来判断，那你要是能使用这些功能来向我的源站发请求不就可以随意的绕过WAF了嘛。   

# 解决方法
  以前我的想法是如果Cloudflare能发送一个只有我和Cloudflare的请求头那不就可以了嘛，比如Token啥的，但是我没在Cloudflare上发现这个功能。不过今天又没事看了看Cloudflare的功能，发现居然有个叫做“经过身份验证的源服务器拉取”功能，看了看[功能解释](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/explanation/)，原来这是通过双向认证实现的，这配置起来也非常的简单，所以就按照[配置文档](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/set-up)的说明设置了。   
  如果看不懂英文，我大概解释一下，首先下载[Cloudflare 客户端CA](https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem)，如果是Apache服务器就直接在配置文件里面写：   
```
SSLVerifyClient require
SSLVerifyDepth 1
SSLCACertificateFile /path/to/authenticated_origin_pull_ca.pem
```
  不过Nginx使用这个功能貌似要crt格式的证书，可以执行`openssl x509 -in authenticated_origin_pull_ca.pem -out cloudflare.crt`获得crt证书，然后再配置：   
```
ssl_client_certificate /etc/nginx/certs/cloudflare.crt;
ssl_verify_client on;
```
  就可以了。   
  设置完之后，如果我不开“经过身份验证的源服务器拉取”的功能，就会报“400 Bad Request, No required SSL certificate was sent”的错误，这个效果我非常的满意，这样即使其他人通过比如Workers，WARP之类的功能去请求我的源站IP，也会因为没有Cloudflare的私钥而无法访问，就可以完全避免通过源站IP来绕过WAF这种问题。

# 感想
  不过这个配置实在是不够显眼，希望Cloudflare能把它放到新手教程里面，让更多人避免因为源站IP泄露导致的安全问题。
