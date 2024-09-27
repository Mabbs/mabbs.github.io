---
layout: post
title: 使用Cloudflare Workers制作博客AI摘要
tags: [Cloudflare, Workers, AI, 博客]
---

  Cloudflare实在是太强了，以至于全都依赖它了😂<!--more-->    

# 起因
  虽然很早就在[关注AI](/2023/04/05/ai.html)了，而且也看到有些博客早已用上了AI摘要（比如xLog下的），但是一般都要后端提前生成好，另外那时候还没有那么多免费好用的接口可以用，像OpenAI到现在还没有GPT免费的API😂，至于花钱就更是想都别想，互联网的东西我是不会花钱的，就因为这样我一直都没有考虑过给我的博客加AI摘要的功能。   
  直到前两天看到一个Hexo的博客有一个AI摘要的功能，如果是有后端的博客我可能还没什么兴趣，但是既然是纯前端的就引发了我的兴趣，我大概看了一下，用的是一个叫[Post-Abstract-AI](https://github.com/zhheo/Post-Abstract-AI)的项目，定睛一看，居然还是收费的，而且API Key还是直接明文放代码里的，给我看笑了。如果我拿着这个Key去不停刷使用量不一会就把它刷完了？不过这时候我想起来赛博活佛Cloudflare之前也出了AI功能，还是免费的，我何不用Workers写一个好好打脸一下这个收费的项目？就像我对[Server酱](/2021/02/02/serverchan.html)做的事情一样。   

# 开始制作
  首先先不考虑重复造轮子，去Github上看看有没有现成的，毕竟Cloudflare的这个AI功能也出了不少时间了，搜了一下还真有，叫[Qwen-Post-Summary](https://github.com/FloatSheep/Qwen-Post-Summary)，用的居然还是阿里的通义千问模型，这倒是不错，毕竟如果用Llama3的话说不定给我生成出来全是英文了，国产的模型至少都是对中文优化过的。   
  我仔细看了看，发现它怎么是把文章放GET请求里的，要知道浏览器是不会允许超过4KiB的请求头的，看了一下代码还截取成前1800字了，感觉有点不爽，不过我搜了一下，为了能简单的做到流式效果，用的EventSource功能根本不支持POST请求……看来这个代码不能直接拿来用了，另外我也不希望每次打开文章都重新生成摘要，那样不仅浪费计算资源，而且毫无意义，毕竟文章又不会变。所以我首先考虑怎么样存AI生成的结果呢？另外为了能通过POST把文章喂给AI我也得考虑存文章。最开始我想着用Workers的KV数据库，因为那是最早出的，虽然限制很多但当时没得选。但这次点开发现居然有个D1数据库，容量更大，[延迟更低](https://github.com/bruceharrison1984/kv-d1-benchmark)，操作次数更多而且还支持SQL语法，这不比那个KV数据库好太多了，这下都不知道这个KV数据库留着还有啥意义了，可能就单纯是为了兼容以前的应用不得不留着了吧。   
  不过既然会存储内容，还得考虑一点就是万一有人偷偷拿我的接口把我的文章内容换了，让AI生成了糟糕的内容，显示在我的文章里多不合适啊，所以为了避免这种问题，我每次会对比文章的数字摘要，免得有人把我数据库里的文章篡改了🤣。   
  最终基于上面的代码边查文档边改把代码写出来了，顺便把我之前写的[博客计数器](/2019/06/22/counter.html)也一起替换掉了，做到真正的Serverless：   
```javascript
async function sha(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(""); // convert bytes to hex string
  return hashHex;
}
async function md5(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(""); // convert bytes to hex string
  return hashHex;
}

export default {
  async fetch(request, env, ctx) {
    const db = env.blog_summary;
    const url = new URL(request.url);
    const query = decodeURIComponent(url.searchParams.get('id'));
    const commonHeader = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': "*",
      'Access-Control-Allow-Headers': "*",
      'Access-Control-Max-Age': '86400',
    }
    if (query == "null") {
      return new Response("id cannot be none", {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': "*",
          'Access-Control-Allow-Headers': "*",
          'Access-Control-Max-Age': '86400',
        }
      });
    }
    if (url.pathname.startsWith("/summary")) {
      let result = await db.prepare(
        "SELECT content FROM blog_summary WHERE id = ?1"
      ).bind(query).first("content");
      if (!result) {
        return new Response("No Record", {
          headers: commonHeader
        });
      }

      const messages = [
        {
          role: "system", content: `
          你是一个专业的文章摘要助手。你的主要任务是对各种文章进行精炼和摘要，帮助用户快速了解文章的核心内容。你读完整篇文章后，能够提炼出文章的关键信息，以及作者的主要观点和结论。
          技能
            精炼摘要：能够快速阅读并理解文章内容，提取出文章的主要关键点，用简洁明了的中文进行阐述。
            关键信息提取：识别文章中的重要信息，如主要观点、数据支持、结论等，并有效地进行总结。
            客观中立：在摘要过程中保持客观中立的态度，避免引入个人偏见。
          约束
            输出内容必须以中文进行。
            必须确保摘要内容准确反映原文章的主旨和重点。
            尊重原文的观点，不能进行歪曲或误导。
            在摘要中明确区分事实与作者的意见或分析。
          提示
            不需要在回答中注明摘要（不需要使用冒号），只需要输出内容。
          格式
            你的回答格式应该如下：
              这篇文章介绍了<这里是内容>
          ` },
        { role: "user", content: result.substring(0, 5000) }
      ]

      const stream = await env.AI.run('@cf/qwen/qwen1.5-14b-chat-awq', {
        messages,
        stream: true,
      });

      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': "*",
          'Access-Control-Allow-Headers': "*",
          'Access-Control-Max-Age': '86400',
        }
      });
    } else if (url.pathname.startsWith("/get_summary")) {
      const orig_sha = decodeURIComponent(url.searchParams.get('sign'));
      let result = await db.prepare(
        "SELECT content FROM blog_summary WHERE id = ?1"
      ).bind(query).first("content");
      if (!result) {
        return new Response("no", {
          headers: commonHeader
        });
      }
      let result_sha = await sha(result);
      if (result_sha != orig_sha) {
        return new Response("no", {
          headers: commonHeader
        });
      } else {
        let resp = await db.prepare(
          "SELECT summary FROM blog_summary WHERE id = ?1"
        ).bind(query).first("summary");
        if (resp) {
          return new Response(resp, {
            headers: commonHeader
          });
        } else {
          const messages = [
            {
              role: "system", content: `
          你是一个专业的文章摘要助手。你的主要任务是对各种文章进行精炼和摘要，帮助用户快速了解文章的核心内容。你读完整篇文章后，能够提炼出文章的关键信息，以及作者的主要观点和结论。
          技能
            精炼摘要：能够快速阅读并理解文章内容，提取出文章的主要关键点，用简洁明了的中文进行阐述。
            关键信息提取：识别文章中的重要信息，如主要观点、数据支持、结论等，并有效地进行总结。
            客观中立：在摘要过程中保持客观中立的态度，避免引入个人偏见。
          约束
            输出内容必须以中文进行。
            必须确保摘要内容准确反映原文章的主旨和重点。
            尊重原文的观点，不能进行歪曲或误导。
            在摘要中明确区分事实与作者的意见或分析。
          提示
            不需要在回答中注明摘要（不需要使用冒号），只需要输出内容。
          格式
            你的回答格式应该如下：
              这篇文章介绍了<这里是内容>
          ` },
            { role: "user", content: result.substring(0, 5000) }
          ]

          const answer = await env.AI.run('@cf/qwen/qwen1.5-14b-chat-awq', {
            messages,
            stream: false,
          });
          resp = answer.response
          await db.prepare("UPDATE blog_summary SET summary = ?1 WHERE id = ?2")
            .bind(resp, query).run();
          return new Response(resp, {
            headers: commonHeader
          });
        }
      }
    } else if (url.pathname.startsWith("/is_uploaded")) {
      const orig_sha = decodeURIComponent(url.searchParams.get('sign'));
      let result = await db.prepare(
        "SELECT content FROM blog_summary WHERE id = ?1"
      ).bind(query).first("content");
      if (!result) {
        return new Response("no", {
          headers: commonHeader
        });
      }
      let result_sha = await sha(result);
      if (result_sha != orig_sha) {
        return new Response("no", {
          headers: commonHeader
        });
      } else {
        return new Response("yes", {
          headers: commonHeader
        });
      }
    } else if (url.pathname.startsWith("/upload_blog")) {
      if (request.method == "POST") {
        const data = await request.text();
        let result = await db.prepare(
          "SELECT content FROM blog_summary WHERE id = ?1"
        ).bind(query).first("content");
        if (!result) {
          await db.prepare("INSERT INTO blog_summary(id, content) VALUES (?1, ?2)")
            .bind(query, data).run();
          result = await db.prepare(
            "SELECT content FROM blog_summary WHERE id = ?1"
          ).bind(query).first("content");
        }
        if (result != data) {
          await db.prepare("UPDATE blog_summary SET content = ?1, summary = NULL WHERE id = ?2")
            .bind(data, query).run();
        }
        return new Response("OK", {
          headers: commonHeader
        });
      } else {
        return new Response("need post", {
          headers: commonHeader
        });
      }
    } else if (url.pathname.startsWith("/count_click")) {
      let id_md5 = await md5(query);
      let count = await db.prepare("SELECT `counter` FROM `counter` WHERE `url` = ?1")
        .bind(id_md5).first("counter");
      if (url.pathname.startsWith("/count_click_add")) {
        if (!count) {
          await db.prepare("INSERT INTO `counter` (`url`, `counter`) VALUES (?1, 1)")
            .bind(id_md5).run();
          count = 1;
        } else {
          count += 1;
          await db.prepare("UPDATE `counter` SET `counter` = ?1 WHERE `url` = ?2")
            .bind(count, id_md5).run();
        }
      }
      if (!count) {
        count = 0;
      }
      return new Response(count, {
        headers: commonHeader
      });
    } else {
      return Response.redirect("https://mabbs.github.io", 302)
    }
  }
}
```
  另外也写了配套的前端代码（用的jQuery，其实应该用Fetch的😂）：   
```html
{% raw %}
<b>AI摘要</b>
<p id="ai-output">正在生成中……</p>
<script>
  async function sha(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""); // convert bytes to hex string
    return hashHex;
  }
  async function ai_gen(){
    var postContent = "文章标题：" + {{ page.title | jsonify }} + "；文章内容：" + {{ page.content | strip_html | strip_newlines | jsonify }};
    var postContentSign = await sha(postContent);
    var outputContainer = document.getElementById("ai-output");
    $.get("https://summary.mayx.eu.org/is_uploaded?id={{ page.url }}&sign=" + postContentSign, function (data) {
      if (data == "yes") {
        $.get("https://summary.mayx.eu.org/get_summary?id={{ page.url }}&sign=" + postContentSign, function (data2) {
          outputContainer.textContent = data2;
        });
      } else {
        $.post("https://summary.mayx.eu.org/upload_blog?id={{ page.url }}", postContent, function (data) {
          $.get("https://summary.mayx.eu.org/get_summary?id={{ page.url }}&sign=" + postContentSign);
          const evSource = new EventSource("https://summary.mayx.eu.org/summary?id={{ page.url }}");
          outputContainer.textContent = "";
          evSource.onmessage = (event) => {
            if (event.data == "[DONE]") {
              evSource.close();
              return;
            } else {
              const data = JSON.parse(event.data);
              outputContainer.textContent += data.response;
            }
          }
        });
      }
    });
  }
  ai_gen();
</script>
{% endraw %} 
```
  本来文章内容应该从html里读更好一些，但是标签啥的还得用正则去掉，感觉不如Liquid方便😂。另外博客计数器不应该用MD5的，但懒得改之前的数据了，还好Cloudflare Workers为了兼容是支持MD5的，免得我还得想办法改数据库里的数据。   

# 使用方法
  如果想给自己的静态博客加AI摘要功能的话也可以用我的接口，把前端代码粘到模板里就行，反正是用的Cloudflare的资源，而且现在通义千问的模型还是Beta版调用没有次数限制，就算之后变正式版，也能每天免费用1w个神经元，好像可以进行1k次左右的生成，完全够用了，只要别和我文章url重了就行。   
  不过毕竟Workers本身是有每日调用次数限制的，自己部署当然更好。方法也很简单，首先在D1里创建一个数据库，然后创建一个Workers，在变量里绑定AI和新建的D1数据库，名字要起成blog_summary，如果想换名字就要改代码，里面建一张叫做blog_summary的表，需要有3个字段，分别是id、content、summary，都是text类型，如果想用博客计数器功能就再加一张counter表，一个是url，text类型，另一个是counter，int类型。本来博客计数器接口名字也打算用counter的，结果不知道AdBlock有什么大病，居然会屏蔽“counter?id=”这样的请求😆，害的我只能改成count_click这样的名字了。   

# 其他想法
  加了这个功能之后感觉效果还挺不错的，这下就有点想加点别的功能了，比如文章推荐和知识库问答啥的， ~~不过这个似乎需要什么向量数据库，而且数据需要进行“嵌入”处理，这用现有的东西感觉难度实在是太高了所以就算了……~~ （在2024.09.27中[已经实现了](/2024/09/27/rag.html)） 另外还想用文生图模型给我的文章加个头图，不过我天天写的都是些技术文章，没啥图可加吧🤣。其他的之后再看看有什么有意思的功能再加吧。   

# 感想
  Cloudflare真不愧是赛博活佛，这波操作下来不就省下了那笔生成费用？啥都是免费的，不过问题就是Cloudflare在这方面几乎是垄断地位，虽然国际大厂倒是不担心倒闭，不过万一挂了想再找个这样厉害的平台可就没了😆。   