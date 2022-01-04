---
layout: post
title: 自制一个简单的微信聊天机器人
tags: [微信, 聊天, 机器人, PHP]
---

  感觉API好像还挺有意思<!--more-->    
  
# 起因
  前两天我[制作了Server酱·TurboMini版](/2021/02/02/serverchan.html)之后感觉微信公众号的API好像还挺有意思的，总的来说也不是很复杂，没有用什么特别奇怪的东西，而且文档还算清晰，这一点还是很不错的。   
  于是最近我就开始看微信开放文档，其实我刚写完Server酱·TurboMini版之后我就在想，好多人在QQ上搞那种只要说来点什么图，机器人就会发图片的一个功能。我感觉这个好像有点意思，因为我平时用微信更多一些，既然有测试号这样好的平台，那么我就应该搞点这样的功能。   
  我花了一天的时间通读整个文档然后把程序写了出来，然而发生了很糟糕的事情，那就是微信被动回复的时间要求必须在5秒以内，否则就会报错，然而让服务器转发图片本来就很耗时，又加上我用的是垃圾国外免费的虚拟空间，中国与国际互联网的连接又很差劲，导致5秒内程序必定不可能来得及回复。   
  没办法，我花了一天时间写的东西，我一定要水一篇文章！所以我想了想，干脆写成聊天机器人吧，那个东西也简单，像我博客上的伊斯特瓦尔就用了聊天机器人（有现成的API啥都好搞）。于是我稍微改动了一下代码，把发图机器人改成了聊天机器人。   

# 代码
```php
<?php
$appid=微信appID;
$secret=微信appsecret;
$appkey=图灵机器人APIkey;
function checkSignature()
{
    $signature = $_GET["signature"];
    $timestamp = $_GET["timestamp"];
    $nonce = $_GET["nonce"];
	
    $token = 'mayx';
    $tmpArr = array($token, $timestamp, $nonce);
    sort($tmpArr, SORT_STRING);
    $tmpStr = implode( $tmpArr );
    $tmpStr = sha1( $tmpStr );
    
    if( $tmpStr == $signature ){
        return true;
    }else{
        return false;
    }
}
if(checkSignature()){
if($_GET["echostr"]){
echo $_GET["echostr"];
}else{
$content = file_get_contents("php://input");
$p = xml_parser_create();
xml_parse_into_struct($p, $content, $vals, $index);
xml_parser_free($p);
if($vals[$index['MSGTYPE'][0]]['value'] == 'text'){
echo '<xml>
  <ToUserName><![CDATA['.$vals[$index['FROMUSERNAME'][0]]['value'].']]></ToUserName>
  <FromUserName><![CDATA['.$vals[$index['TOUSERNAME'][0]]['value'].']]></FromUserName>
  <CreateTime>'.time().'</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA['.json_decode(file_get_contents('https://www.tuling123.com/openapi/api', false, stream_context_create(array('http' => array('method' => 'POST','header' => 'Content-type:application/x-www-form-urlencoded','content' => http_build_query(array('key' => $appkey,'info' => $vals[$index['CONTENT'][0]]['value'],'userid' => $vals[$index['FROMUSERNAME'][0]]['value'])))))),true)['text'].']]></Content>
</xml>';
}
}
}else{
echo 'error';
}
```

# 使用方法
  和[上一篇文章](/2021/02/02/serverchan.html)一样，同样需要去[申请](https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login)一个测试号，不过有一点不一样，那就是这一次需要配置接口配置信息，URL就填这个程序能在互联网上访问的地址，而Token则是填mayx。为什么呢？因为我在代码里这样写的啊……如果想改可以把对应的变量改成自己喜欢的值，总之保证两边一样就行。   
  提交之后接口就配置好了，不过还没有结束，为了能使用机器人，还得要去注册[图灵机器人](http://www.turingapi.com/)，毕竟又不可能自己去写一个聊天机器人，那个需要的资源太多了。现在那个图灵机器人好像必须要实名才能用，那总之混互联网的人遇到这种问题应该也不是问题了吧。   
  注册好机器人之后就直接把APIKey粘到代码里面，然后整个代码就可以正常运行了，现在你就可以和你的机器人聊天了。   
  
# 暂时废弃的代码
```php
define('MULTIPART_BOUNDARY', '--------------------------'.microtime(true));

$file_contents = file_get_contents(json_decode(file_get_contents('https://www.pixiv.net/ajax/illust/'.json_decode(file_get_contents('https://api.loli.st/pixiv/'),true)['illust_id'].'/pages'),true)['body'][0]['urls']['regular'], false, stream_context_create(array('http' => array('method' => 'GET','header' => "referer: https://www.pixiv.net/"))));

$context = stream_context_create(array(
    'http' => array(
          'method' => 'POST',
          'header' => 'Content-Type: multipart/form-data; boundary='.MULTIPART_BOUNDARY,
          'content' => "--".MULTIPART_BOUNDARY."\r\n".
            "Content-Disposition: filename=\"image.png\"\r\n".
            "Content-Type: image/png\r\n\r\n".
            $file_contents."\r\n".
            "--".MULTIPART_BOUNDARY."--\r\n"
    )
));

echo '<xml>
  <ToUserName><![CDATA['.$vals[$index['FROMUSERNAME'][0]]['value'].']]></ToUserName>
  <FromUserName><![CDATA['.$vals[$index['TOUSERNAME'][0]]['value'].']]></FromUserName>
  <CreateTime>'.time().'</CreateTime>
  <MsgType><![CDATA[image]]></MsgType>
  <Image>
    <MediaId><![CDATA['.json_decode(file_get_contents('https://api.weixin.qq.com/cgi-bin/media/upload?access_token='.json_decode(file_get_contents('https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid='.$appid.'&secret='.$secret),true)[access_token].'&type=image', false, $context),true)['media_id'].']]></MediaId>
  </Image>
</xml>';
```
  其实这段代码不是不能工作，只是它不能符合要求，没办法及时的把图片上传到微信服务器上，也没办法及时回复……也许如果有很好的条件，这段代码就可以运行了吧……   
  我也试过如果不是Pixiv上面的图片，而是图片在很小而且也很快的服务器上时，这个代码是能运行的。
  
# 替代的方案
  我看完文档之后好像也没有主动向用户发送信息的接口，只有被动发送的，那这5秒问题估计是没法解决了吧……不过我看网上说如果用客服接口好像就没有这样的限制，总之我回头试试看吧。   
  另外我也想了几种方案：
  1. 每天定时向微信服务器上传图片，需要时只发送ID，不再在得到请求时再上传。   
  2. 设置2条命令，一条用于向微信服务器上传，另一条负责取回。不过这样有个问题就是ID不太好传，可能还得缓存一下，其实上面那个一样也得缓存。   
  3. 搞成图文形式，每天定时发送，就像日报一样    
  
  目前大概就想出这么多，更多的睡起来再慢慢想吧~
