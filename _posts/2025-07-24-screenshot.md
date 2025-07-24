---
layout: post
title: 使用Cloudflare制作自动更新的网站预览图
tags: [Cloudflare, Workers, 网站截图, 自动化]
---

  Cloudflare的功能真是越来越多了，而且还免费！<!--more-->   

# 起因
  前段时间我在登录Cloudflare的时候发现Workers上多了一个“浏览器呈现”的功能（可能已经出来一段时间了，不过之前一直没关注），看介绍，这个功能可以让Worker操作运行在Cloudflare服务器上的浏览器。这功能挺有意思，而且免费用户也能用，不如想个办法好好利用一下。   
  一般来说这个功能可以干什么呢？既然是在AI盛行的时候出现……估计是为了搞Agent之类的吧，不过看[文档](https://developers.cloudflare.com/browser-rendering/platform/limits/)对免费用户来说一天也只有10分钟的使用时间，估计也没什么应用价值……那除了这个之外还能做些什么？我发现有好多博客主题喜欢给自己的README里添加一个能查看主题在多种设备上显示效果的预览图，以展示主题的自适应能力。那么既然现在能在Cloudflare上操作浏览器，那么我也可以做一个类似的，而且这个预览图还可以自动更新。   

# 制作自适应的网站预览
  既然打算做预览图，那么我应该用什么方案？按照不同尺寸的视口截几张图再拼起来吗？这显然就太复杂了，况且在Cloudflare Workers中处理图片也相当困难。这时我想起来曾经见到过一个工具，只要输入网址，就可以在一个页面中同时展示网站在四种不同设备（手机、平板、笔记本电脑、台式机）上的显示效果，叫做“多合一网页缩略图”，实现原理是使用iframe和CSS缩放模拟多种设备视口。搜了一下发现这套代码被不少网站使用，所以就随便找了其中一个工具站把代码和素材扒了下来，稍微改了一下，然后放到[GitHub](https://github.com/Mabbs/responsive)上，方便等一会用Cloudflare访问这个部署在[GitHub Pages](https://mabbs.github.io/responsive/)上的页面来进行截图。   

# 使用Cloudflare浏览器呈现进行截图
  接下来截图就简单了，不过Cloudflare有两种截图的办法，[用Workers](https://developers.cloudflare.com/browser-rendering/workers-bindings/)的话可以直接用Puppeteer之类的库连接浏览器，但用这个库需要安装，要本地搭环境……我毕竟不是专门搞JS开发的，一点也不想在本地安装Node.js环境，所以就不想用这种方式。另外一种是通过[调用Cloudflare的接口](https://developers.cloudflare.com/browser-rendering/rest-api/)，这种非常简单，只需要填几个参数请求就行，唯一的问题就是要填一个Token……我一直觉得Worker调用Cloudflare自己的服务不应该需要Token之类的东西，毕竟内部就能验证了，没必要自己搞，但是我看了半天文档貌似无论如何只要想调接口就必须搞个Token……那没办法就搞吧，其实也很简单，只需要在“账户API令牌”里添加一个有浏览器呈现编辑权限的令牌就行。   
  至于展示……这个接口调用比较耗时，而且一天只能调用10分钟，截图的话估计也就够30次左右，还有每分钟3次的限制😓，所以实时更新肯定是不行了，图片肯定得缓存，一天更新一次感觉应该就够了。另外次数这么少的话写成接口给大伙用貌似也没啥意义，所以我就把地址写死了，于是以下就是最终实现的代码：   
```javascript
export default {
  async fetch(request, env, ctx) {
    const cache = caches.default;
    const kv = env.SCREENSHOT;

    const url = "https://mabbs.github.io/responsive/";
    const date = new Date().toISOString().split("T")[0];
    const cacheKey = url;
    const datedKey = `${url}?${date}`;

    // 工具函数：构建 Response 对象
    const buildResponse = (buffer) =>
      new Response(buffer, {
        headers: {
          "content-type": "image/png",
          "cache-control": "public, max-age=86400, immutable",
        },
      });

    // 工具函数：尝试从 KV 和 Cache 中加载已有截图
    const tryGetCachedResponse = async (key) => {
      let res = await cache.match(key);
      if (res) return res;

      const kvData = await kv.get(key, { type: "arrayBuffer" });
      if (kvData) {
        res = buildResponse(kvData);
        ctx.waitUntil(cache.put(key, res.clone()));
        return res;
      }
      return null;
    };

    // 1. 优先使用当日缓存
    let res = await tryGetCachedResponse(datedKey);
    if (res) return res;

    // 2. 若缓存不存在，则请求 Cloudflare Screenshot API
    try {
      const payload = {
        url: url,
        viewport: { width: 1200, height: 800 },
        gotoOptions: { waitUntil: "networkidle0" },
      };

      const apiRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/screenshot?cacheTTL=86400`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.CF_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!apiRes.ok) throw new Error(`API returned ${apiRes.status}`);

      const buffer = await apiRes.arrayBuffer();
      res = buildResponse(buffer);

      // 后台缓存更新
      ctx.waitUntil(Promise.all([
        kv.put(cacheKey, buffer),
        kv.put(datedKey, buffer, { expirationTtl: 86400 }),
        cache.put(cacheKey, res.clone()),
        cache.put(datedKey, res.clone()),
      ]));

      return res;
    } catch (err) {
      console.error("Screenshot generation failed:", err);

      // 3. 回退到通用旧缓存
      res = await tryGetCachedResponse(cacheKey);
      if (res) return res;

      return new Response("Screenshot generation failed", { status: 502 });
    }
  },
};
```
  使用方法很简单，创建一个Worker，把以上代码粘进去，然后把从“账户API令牌”中生成的令牌填到Worker的密钥中，名称为`CF_API_TOKEN`，另外再加一个名称为`CF_ACCOUNT_ID`的密钥，内容是账户ID，就是打开仪表板时URL中的那串16进制数字，除此之外还需要创建一个KV数据库，绑定到这个Worker上，绑定的名称是`SCREENSHOT`。如果想给自己的网站生成，可以Fork我的[仓库](https://github.com/Mabbs/responsive)，然后把里面首页文件中的网址替换成你的网站，然后再把Worker中的url替换成Fork后仓库的GitHub Pages地址就可以了。   
  最终的效果如下：   
  ![ScreenShot](https://screenshot.mayx.eu.org)

# 感想
  Cloudflare实在是太强了，虽然这个浏览器呈现免费用量并不多，但是有这么一个功能已经吊打很多Serverless服务了，毕竟浏览器对服务器资源的占用也不小，小内存的服务器甚至都不能运行，如果要自己搭的话成本可能也不小，而现在Cloudflare能免费提供，应该说不愧是赛博活佛吗🤣。