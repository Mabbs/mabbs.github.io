---
layout: post
title: 做一个Server酱·TurboMini企业应用版
tags: [Server, PHP, 微信]
---

  简单的事情应该自己去做<!--more-->    
  
# 起因
  这个月初，由于Server酱要挂了然后Turbo版又要钱所以我特地写了一个[Server酱·TurboMini测试号版](/2021/02/02/serverchan.html)，然而据那个开发Server酱的人说微信要下掉的是模板消息，而不是故意坑人不做这个东西了。过了一段时间后那个开发者说可以用企业微信啥的通道继续搞，顺便还给普通账户使用Turbo版的一点点权限，然后价格似乎也稍微降了一点？   
  但问题是我们之所以使用Server酱只是因为注册服务号很麻烦，微信认证要主体，所以我们才用，用这个的人也应该都是开发者吧？那如果说资源都是我们出的话还何必用那个一堆广告的Server酱呢？而且想好好用还要花钱，都是开发者了没必要交这种智商税吧？   
  不过看在它还给我们推荐了些路子，那也就不用太过分的说它了吧。   
  
# 如何制作？
  我也倒是去看了看企业微信的开发文档，和公众号的开发文档那就是大同小异啊，所以今天依然是一句话解决问题：
```php
<?php
$cid='企业ID';
$agentId='应用ID/AgentId';
$secret='应用Secret';
$userid='@all';//用户ID，不知道可以不改
$title='标题';
$content='内容';
file_get_contents('https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token='.json_decode(file_get_contents('https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid='.$cid.'&corpsecret='.$secret),true)['access_token'],false,stream_context_create(['http' => array('method'=>'POST','header'=>"content-type: application/json; charset=UTF-8",'content'=>'{"touser":"'.$userid.'","msgtype":"text","agentid":'.$agentId.',"text":{"content":"'.$title.'\n'.$content.'"}}')]));
```
  从体验上来说的话这个企业应用版的体验还是不错的，和测试号相比首先可以在主页显示，虽然有二级但是两边的图标和名字都是可以自定义的，而且API的调用次数也要比测试号多很多，用起来还是挺不错的，和测试号比唯一的缺点应该就是首次配置有点麻烦。   
  另外我在写这个东西的时候发现这个API还是和测试号的API不太一样，测试号那个在发post请求的时候post可以小写，但是这个垃圾企业微信的API的POST必须大写，不然就400，搞得我调试了半天才调试好。
  
# 如何配置？
  一样这个是兼容Server酱的，需要的参数和Server酱需要的一样多，所以配置也是完全兼容的。不过考虑到Server酱可怜的连每月5kw次请求都受不住，配置方法我就在这里再写一遍吧：   
## 第一步，注册企业
  用电脑打开[企业微信官网](https://work.weixin.qq.com/)，注册一个企业
## 第二步，创建应用
  注册成功后，点「管理企业」进入管理界面，选择「应用管理」 → 「自建」 → 「创建应用」    
  应用名称随便填，比如「Mayx的机器人」，应用logo随便找一个就行，可见范围可以选择自己，如果想推送给其他人就选公司。   
  创建完成后进入应用详情页，可以得到应用ID(agentid)，应用Secret(secret)，复制并填到代码中。
## 第三步，获取企业ID
  进入「[我的企业](https://work.weixin.qq.com/wework_admin/frame#profile)」页面，拉到最下边，可以看到企业ID，复制并填到上方。   
  推送UID不知道怎么填就直接填`@all`，推送给公司全员。
## 第四步，推送消息到微信
  进入「我的企业」 → 「[微信插件](https://work.weixin.qq.com/wework_admin/frame#profile/wxPlugin)」，拉到下边扫描二维码，关注以后即可收到推送的消息。   
  这里一样图标觉得不好看也可以自己改。
  
# 可以改进的地方
  首先，目前的这个版本是直接发送的信息，所以不支持Markdown，看起来也很丑。其实呢，我看文档里有说可以直接发Markdown消息，不过这样的话微信接收不到……   
  其实测试号版那个我看完文档之后就在想如果能把内容写到图文消息里也不错啊，可惜图文消息那个要一张头图，做不到开箱即用，这个企业微信版一样也有这个问题……   
  另外我还看到在文档里有一个文本卡片消息非常的不错，但是有一个问题是我不知道为啥它的URL是必选的，那这样的话同样我也没办法做到开箱即用……   
  当然要做的话也不难，自己去看[官方文档](https://work.weixin.qq.com/api/doc/90000/90135/90236)就好了，也没有多复杂。   
  另外测试号版就算模板消息不能用，那也不是不能推送啊，用[群发预览接口](https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Batch_Sends_and_Originality_Checks.html)不好吗？虽然有每天100次的限制，但又不是不能用啊，而且还能减少对Server酱服务器的压力，我看这所谓要捐助维护就是想着赚钱，那么多广告早就够交服务器费用了，我也是维护网站的还能不知道这请求要多少钱的服务器？   
  然后看微信发的[下线模板消息的通知](https://developers.weixin.qq.com/community/develop/doc/000a4e1df800d82acb9b7fb5e5b001)，应该大概率不会下线这个功能，只是说了灰度测试而已，有可能只是多加了比如授权之类的操作而已。

# 总结
  其实要不是Server酱有那么多广告，还以捐赠名义收费，而且还限制那么多的话其实也还算不错的产品，而且也是它给了我看微信开发文档的动力，让我在假期里还有点事干。只是既然最重要的服务号就要没了，那么它也该被开发者们放弃了吧。
