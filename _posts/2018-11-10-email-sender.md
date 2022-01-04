---
layout: post
title: 免费订阅一个属于自己的邮件日报
tags: [免费, 邮件, 日报, 心得]
---

  前几天，我给自己做了一个邮件订阅系统<!--more-->，是用PHP做的。这里不得不夸赞一下PHP，PHP真不愧是世界上最好的语言，我从来没学过PHP，但是我光靠百度搜到
的东西拼凑就能搞出这个邮件订阅系统，还是很不错的，而且网上的免费PHP空间也有很多，所以就可以很轻易的给自己搞一个免费的邮件订阅系统。   

# 制作方法
  很简单，首先去百度上搜一个带sendmail和CronTab的免费PHP主机空间，然后在上面创建一个PHP文件，随便取什么名字都好，只要后缀是PHP就可以，然后把下面的代码
粘上去，保存，然后在主机面板上设置CornTab任务，设定为每天运行一次，然后OK……对了，记得把下面变量`$to`里面的地址换成自己的邮箱地址，不然每次发送邮件就会发
到我的邮箱了……

# 代码
``` PHP
<?php
function curl_post_https($url,$data){ // 模拟提交数据函数
    $curl = curl_init(); // 启动一个CURL会话
    curl_setopt($curl, CURLOPT_URL, $url); // 要访问的地址
    curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, 0); // 对认证证书来源的检查
    curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, 1); // 从证书中检查SSL加密算法是否存在
    curl_setopt($curl, CURLOPT_FOLLOWLOCATION, 1); // 使用自动跳转
    curl_setopt($curl, CURLOPT_AUTOREFERER, 1); // 自动设置Referer
    curl_setopt($curl, CURLOPT_POST, 1); // 发送一个常规的Post请求
    curl_setopt($curl, CURLOPT_POSTFIELDS, $data); // Post提交的数据包
    curl_setopt($curl, CURLOPT_TIMEOUT, 30); // 设置超时限制防止死循环
    curl_setopt($curl, CURLOPT_HEADER, 0); // 显示返回的Header区域内容
    curl_setopt($curl, CURLOPT_RETURNTRANSFER, 1); // 获取的信息以文件流的形式返回
    $tmpInfo = curl_exec($curl); // 执行操作
    if (curl_errno($curl)) {
        echo 'Errno'.curl_error($curl);//捕抓异常
    }
    curl_close($curl); // 关闭CURL会话
    $backdata = json_decode($tmpInfo,true);
    return $backdata['text']; // 返回数据，json格式
}
function w_get(){
        $url = 'https://yuri.gear.host/talk.php';
        $data['info']       = '某地天气';
        $data['userid']      = 'Mayx_Mail';
        $retdata=curl_post_https($url,$data);
        $data['info']       = '某地明天天气';
        $retdata = $retdata . "<br>" .curl_post_https($url,$data);
        $data['info']       = '某地后天天气';
        $retdata=$retdata . "<br>" .curl_post_https($url,$data);
        return $retdata;//返回json
}
function xh_get(){
        $url = 'https://yuri.gear.host/talk.php';
        $data['info']       = '讲个笑话';
        $data['userid']      = 'Mayx_Mail';
        $retdata=curl_post_https($url,$data);
        return $retdata;//返回json
}
function xw_get(){
//RSS源地址列表数组 
$rssfeed = array("http://www.people.com.cn/rss/it.xml"); 
 
for($i=0;$i<sizeof($rssfeed);$i++){//分解开始 
    $buff = ""; 
    $rss_str=""; 
    //打开rss地址，并读取，读取失败则中止 
    $fp = fopen($rssfeed[$i],"r") or die("can not open $rssfeed");  
    while ( !feof($fp) ) { 
        $buff .= fgets($fp,4096); 
    } 
    //关闭文件打开 
    fclose($fp); 
 
    //建立一个 XML 解析器 
    $parser = xml_parser_create(); 
    //xml_parser_set_option -- 为指定 XML 解析进行选项设置 
    xml_parser_set_option($parser,XML_OPTION_SKIP_WHITE,1); 
    //xml_parse_into_struct -- 将 XML 数据解析到数组$values中 
    xml_parse_into_struct($parser,$buff,$values,$idx); 
    //xml_parser_free -- 释放指定的 XML 解析器 
    xml_parser_free($parser); 
    $j = 0;
    foreach ($values as $val) { 
        $tag = $val["tag"]; 
        $type = $val["type"]; 
        $value = $val["value"]; 
        //标签统一转为小写 
        $tag = strtolower($tag); 
 
        if ($tag == "item" && $type == "open"){ 
            $is_item = 1; 
        }else if ($tag == "item" && $type == "close") { 
            //构造输出字符串 
            $rss_str .= "<a href='".$link."' target=_blank>".$title."</a><br />"; 
            $j++;
            $is_item = 0; 
        } 
        //仅读取item标签中的内容 
        if($is_item==1){ 
            if ($tag == "title") {$title = $value;}         
            if ($tag == "link") {$link = $value;} 
        } 
    if($j == 20){
        break;
    }
    } 
    //输出结果 
    return $rss_str."<br />"; 
} 
}
$to = "mayx@outlook.com , unmayx@139.com";
$subject = "Mayx日报";
$txt = "
<html>
<body>
<h1>Mayx日报</h1><hr>Hi,今天是" . date("Y-m-d") . "，以下是今天的日报：<br><small>
" . file_get_contents("http://mappi.000webhostapp.com/hitokoto/") . "</small>
<h2>天气预报</h2>" . w_get() . "<h2>每日笑话</h2>" . xh_get() . "<h2>今日新闻</h2>" . xw_get() . "<hr><small>" . file_get_contents("https://api.gushi.ci/all.txt") . "</small><br><center>Made By <a href=\"https://mabbs.github.io\">Mayx</a></center>
</body>
</html>
";
$headers = "MIME-Version: 1.0" . "\r\n" . 
"Content-type: text/html;charset=utf-8" . "\r\n" . 
"From: Mayx_Daily<Mayx_Site>";

mail($to,$subject,$txt,$headers);
?>
```
（2018.11.12更新：增加了今日新闻）
（2018.11.13更新：限制新闻条数为前20条）

# 后记
  说实话，我更擅长用Linux Shell解决这种问题，可惜网上好像没有免费的云主机，听说Travis-CI好像也能搞这个事情，但是说实话，我英语并不是很好，让我看懂短一点的文档还可以，太长的就算了……   
  但我还是努力的使用Travis-CI解决了这个问题，链接：[Mayx日报](https://mayx.tk/)
  对了，运营商自己带的邮箱可以设定短信提醒，所以也可以搞成给手机发短信的形式，每天给自己发一条天气预报……那么这样的话，就把天气预报里的城市换成自己的城市吧！   
  如果没有收到邮件，去垃圾邮件找找吧，然后把邮件地址设为白名单。   
  如果谁想试试这个功能，可以在下面给我留言，我在验证通过后会把你加到我的服务器里面的。
  
