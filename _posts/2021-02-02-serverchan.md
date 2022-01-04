---
layout: post
title: 自己动手做一个Server酱·TurboMini版
tags: [Server, PHP]
---

  一句话就能解决的问题也敢收费？<!--more-->   
  
# 起因
  我以前经常使用Server酱给我推送日报，或者告诉我树莓派有没有正常启动之类的事情。之所以使用它是因为那个API还是挺方便的，而且我平时微信也用的多，能直接通过微信推送信息也挺不错的。   
  后来Server酱整了个什么Turbo版，不过我用普通版用的挺好就没怎么管。结果今天发了个什么通知，说他们的服务有可能要挂？我这个人最讨厌的就是服务不稳定，连个服务都整不稳定的人干脆别做服务了，做出来那不是害人嘛，像之前那个什么LeanCloud就不行，因此我还[自己写了一个博客计数器](/2019/06/22/counter.html)。   
  然后我就看了看他们的Server酱·Turbo版，好家伙，还是收费的，8CNY/mo有点过分啊，也不过是调用微信接口还要花钱？看了之后我说不行，这个太贵了，我倒要看看这东西到底要花多少资源。   
  之前我就看他们吹，说自己月请求数5kw，我说这有啥，我花火学园每个月请求数要上亿，也花不了几个钱，5kw就敢出来吹？还敢开课？所以今天我就来看看这所谓的“配置略显复杂”到底有多复杂。   
  
# 试着做一下
  我看了下微信关于测试号的接口文档，看起来也没多复杂嘛，我估摸了一下，最多一句话就能搞定！然后就试着用PHP写了一下。   
  最终的代码如下：
```php
<?php
$appid='appID';
$secret='appsecret';
$userid='微信号（OpenID）';
$template_id='模板ID';
$title='标题';
$content='内容';
file_get_contents('https://api.weixin.qq.com/cgi-bin/message/template/send?access_token='.json_decode(file_get_contents('https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid='.$appid.'&secret='.$secret),true)['access_token'], false, stream_context_create(array('http' => array('method'=>'POST','header'=>"Content-Type: application/json;charset=utf-8",'content'=>'{"touser":"'.$userid.'","template_id":"'.$template_id.'","data":{"title": {"value":"'.$title.'"},"content": {"value":"'.$content.'"}}}'))));
```
  写好之后测试了一下，效果还不错，和Server酱测试号的效果几乎一模一样，除了没有能点开的网页，当然要想搞也行，很简单，就插一个URL就可以了，如果你希望整些更多的特效，也可以去[模板接口文档](https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Template_Message_Interface.html)里面看。    
  关于限制方面的话也要比Server酱要好，理论上我的代码每天能发送2000次，主要是因为获取access_token的接口每天只能使用2000次，不过如果能缓存access_token的话理论上每天能发送100000次，要比垃圾Server酱的1000次好得多。
  
# 如何得到参数？
  我写的代码是兼容Server酱的，所以跟着他们的配置指南也可以直接用，不过有人可能连Server酱是啥都不知道，我也不给他们引流了，免得浪费他们珍贵的服务器资源。   
  要做的事情很简单，首先打开[申请页面](https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login)，然后扫码登录，成功之后就能看到测试号管理的页面了。   
  首先看到的是appID和appsecret，这样我们就已经获得了两个参数。另外两个的话就继续往下翻，找到测试号二维码，用微信扫描关注后就会出现自己的微信号，当然这个不是真正的微信号，相当于只是一个识别码，这样第三个参数也得到了。接下来是第四个参数，找到模板消息接口，点击新增测试模板，标题输入推送通知，或者你喜欢的啥都行，内容的话填：
```
{% raw %}{{title.DATA}}
{{content.DATA}}{% endraw %}
```
  之所以这样填是为了兼容Server酱，当然也可以自己改代码然后填别的也行。不过如果不想改代码在末尾加个签名也没有问题，比如说这样：
```
{% raw %}{{title.DATA}}
{{content.DATA}}{% endraw %}
--By Mayx
```
  这样第四个参数模板ID我们也得到了，这样上面的代码应该可以正常使用了。   
  需要注意的一点是由于莫名其妙的原因，有可能扫码后第一次得到的appsecret是错的，如果代码不能正常工作，可以刷新测试号管理的页面看看有没有变化，如果有就输入最新的appsecret。   
  
# 结语
  我觉得作为开发者，这种简单的小活就自己干吧，没必要给所谓不赞助就不能用功能的开发者给钱，我觉得既然叫赞助，就不能有差别待遇，不然这就叫做收费，就是商业行为，不要用赞助这种词给自己的资本家行为贴金。
