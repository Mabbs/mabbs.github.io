---
layout: post
title: 快速自制微信图片机器人
tags: [微信, 图片, Pixiv, 机器人, PHP]
---

  优化真的是很复杂啊……<!--more-->     
  
# 起因
  前段时间，我做出来了[能发图片的机器人](/2021/02/19/picbot.html)，做出来之后我拿给群友们体验，但是很遗憾的是那个代码实在是不太行，首先有2个问题，第一是微信获取`access_token`的次数是有限的，我的第一版代码在每一次调用都去获取`access_token`，这样很快次数就会消耗光，后来我稍微改进了一下，设置了个缓存，结果呢，我检测的时候用了次数更少的接口……简直是太蠢了……之后呢？结果今天发现代码里有两个获取`access_token`的地方，缓存完全没起到作用……   
  总之上面的问题各种波折总算是解决好了，然后还有一个问题是我的图片来源是[Lolicon API](https://api.lolicon.app/setu)，然后调用限制是300次/天，说实话，对于一个人来说这个数量是够了，但是如果有很多人，像测试号最多能容纳100人，那每天每人也就只有3次调用的机会。   
  那要怎么解决调用次数的问题呢？我首先想的就是缓存结果。   

# 解决API调用次数过少的问题
  因为对于图片来说，基本上没有什么变化的信息，所以如果能将每一次的结果缓存的话其实也没有问题。所以说干就干，我单独开了一个仓库[pixiv-index](https://github.com/Mabbs/pixiv-index)用来存储缓存的结果，具体代码的话都在这个仓库里面，每天会调用那个API直到用完次数。   
  考虑到大多数情况下也不需要原图，所以这个API里的图片都只是长或宽最大为1200px的缩略图。   
  使用方法也很简单，像PHP的话就可以这样写：
```php
<?php
$raw=json_decode(file_get_contents("https://mabbs.github.io/pixiv-index/index.json"),true);
echo file_get_contents('https://mabbs.github.io/pixiv-index/data/'.$raw[rand(0,count($raw)-1)]);
```
  虽然问题解决了，但是我发现了一个巨大的缺陷，我设计这个脚本的初心是想着它有非常多的数据供我调用，结果我发现我错了，之前没有仔细看他们的文档，现在看了才发现，我想要的图片他们也只有仅仅3361张而已，实在是太少了，而总共的图片数量也只有17285张而已（即使那个站的数据也在以非常缓慢的速度增加）……   
  我只是懒得去别的地方找，而且因为这个API作者说那些图片都是Ta精心挑选的我才特意写了那个仓库的那些脚本，还特地学了一下Github Action…… ~~（虽然实际上是抄的那个[给开发者账号续命的](https://github.com/wangziyingwen/AutoApiSecret)那个仓库lol）~~  
  
# 新的代码
  解决了那些问题之后我又稍微优化了一下，把聊天机器人的功能剥离掉了，免得那个图灵机器人的API让人混乱。
```php
<?php
$appid='微信appID';
$secret='微信appsecret';
$token='和配置的Token配置一致即可';
$source='https://i.pximg.net';

ini_set('session.gc_maxlifetime', 7200);
ignore_user_abort(true);
set_time_limit(0);
session_id('Storage');
session_start();
if(!json_decode(file_get_contents('https://api.weixin.qq.com/cgi-bin/get_api_domain_ip?access_token='.$_SESSION['access_token']),true)['ip_list']){
$_SESSION['access_token']=json_decode(file_get_contents('https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid='.$appid.'&secret='.$secret),true)['access_token'];
}
if($_GET["upap"]){
define('MULTIPART_BOUNDARY', '--------------------------'.microtime(true));

$retry=3;
while(!$picdata||$retry<=0){
$raw=json_decode(file_get_contents("https://mabbs.github.io/pixiv-index/index.json"),true);
$picdata=file_get_contents($source.json_decode(file_get_contents('https://mabbs.github.io/pixiv-index/data/'.$raw[rand(0,count($raw)-1)]),true)['url'], false, stream_context_create(array('http' => array('method' => 'GET','header' => "referer: https://www.pixiv.net/"))));
$retry-=1;
}

$context = stream_context_create(array(
    'http' => array(
          'method' => 'POST',
          'header' => 'Content-Type: multipart/form-data; boundary='.MULTIPART_BOUNDARY,
          'content' => "--".MULTIPART_BOUNDARY."\r\n".
            "Content-Disposition: filename=\"image.jpg\"\r\n".
            "Content-Type: image/jpg\r\n\r\n".
            $picdata."\r\n".
            "--".MULTIPART_BOUNDARY."--\r\n"
    )
));

file_get_contents('https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token='.$_SESSION['access_token'] , false, stream_context_create(array('http' => array('method' => 'POST','header' => 'Content-type: application/json;charset=utf-8','content' => '{
    "touser":"'.$_GET["openid"].'",
    "msgtype":"image",
    "image":
    {
      "media_id":"'.json_decode(file_get_contents('https://api.weixin.qq.com/cgi-bin/media/upload?access_token='.$_SESSION['access_token'].'&type=image', false, $context),true)['media_id'].'"
    }
}'))));
exit();
}

$timestamp=$_GET["timestamp"];
$nonce=$_GET["nonce"];
$tmpArr=array($token, $timestamp, $nonce);
sort($tmpArr, SORT_STRING);
if( sha1(implode($tmpArr)) == $_GET["signature"] ){
if($_GET["echostr"]){
echo $_GET["echostr"];
}else{
 
//  加载XML内容
$content = file_get_contents("php://input");
$p = xml_parser_create();
xml_parse_into_struct($p, $content, $vals, $index);
xml_parser_free($p);
if($vals[$index['MSGTYPE'][0]]['value'] == 'text'){
if($vals[$index['CONTENT'][0]]['value'] == '来点色图'){

echo '<xml>
  <ToUserName><![CDATA['.$vals[$index['FROMUSERNAME'][0]]['value'].']]></ToUserName>
  <FromUserName><![CDATA['.$vals[$index['TOUSERNAME'][0]]['value'].']]></FromUserName>
  <CreateTime>'.time().'</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[开始发起请求，请耐心等待]]></Content>
</xml>';

file_get_contents('https://'.$_SERVER['HTTP_HOST'].$_SERVER['PHP_SELF'].'?upap=1&openid='.$vals[$index['FROMUSERNAME'][0]]['value'], false, stream_context_create(array('http' => array('timeout' => 0.5))));

}else{
echo 'success';
}
}
}
}else{
echo 'error';
}
```
  2021.02.26更新：似乎在库中的图片有一些是被删掉了，所以为了提高回复的成功率，增加了3次重试。

# 如何使用？
  具体应该不需要我说了吧，看之前的几篇关于微信机器人的文章里面的这段就行了。这里我删掉了2个参数，又增加了2个，一个是Token，想填啥都行，只要和测试号里配置一样就行。另一个是source，那个是Pixiv的图片服务器，如果后端服务器在国外那这个就不用管了，如果在国内的话需要改成`https://i.pixiv.cat`来做反代，或者如果有其他反代服务也可以，自己用CloudFlare Worker建一个也没有问题。   
  
# 结尾
  那个Lolicon API实在是不好用，不过我也懒得解决了，所以就托学弟在做Pixiv日榜的收集，回头看看效果怎么样，实在不行就去研究一下各种各样的什么booru之类的图站吧，用那些图片也是个不错的选择。
