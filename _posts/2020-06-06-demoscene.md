---
layout: post
title: 关于Demoscene的探索
tags: [Demoscene]
--- 
  大佬们的领域我们无法步入……<!--more-->   
  
# 前言
  最近闲来无事又在回顾自己的历史，真是呜呼哀哉……14年左右的我是那么的有探索和研究精神，怎么过了几年之后就成Five了呢……   
  在我过去留下的文件里，我找到了一些比较有意思的东西，比如当时网上传的很火的一个叫做[.the .product](http://www.theproduct.de/)的一个64KiB的动画，传说它用了外星压缩算法把1个多GiB的东西压缩成了64KiB，真是令人感到不可思议，还有一个叫做[kkrieger](https://files.scene.org/view/parties/2004/breakpoint04/96kgame/kkrieger-beta.zip)的3D游戏，同样也仅仅用了92KiB。   
  这两个作品都来自一个叫做Farbrausch的组织，可能是这个组织的宣传做的比较好，其他的Demoscene虽然做的也很不错，但是并不怎么知名，唯有这个组织的Demoscene在网上广为流传……（不过也许是因为Breakpoint的Party知名度比较高）   
  除此之外，在Windows XP时代喜欢玩批处理的人也一定知道一个叫做[OMNISCENT](https://files.scene.org/view/parties/1997/mekka97/in4k/snc_omni.zip)的动画，把一串乱七八糟的东西放到debug程序里得出的一个只有4KiB的小程序，就能播放出一个看起来好像在一个飞船里的一个3D动画。
  以上所说的这些我当时不知道是什么东西。到了现在，我才知道这些是一种叫做Demoscene的东西。
  
# 什么是Demoscene
  Demoscene根据百科所说是一种计算机艺术亚文化，中文名叫做演景。玩这个的人就喜欢用计算机来渲染出一些看起来很有感觉的带音频的视频。因为这些画面都是直接渲染出来的，所以占用的空间也非常的小。   
  这个道理就和位图和矢量图、波形音乐和MIDI音乐一样，程序总比数据占用的空间小，所以Demoscene通常来说都是用很小的程序来表现很复杂的场面。不过做过像svg的人应该也知道，同一个图像，做矢量图的难度要比制作位图的难度要大，这也就是为什么Demoscene是只有大佬才会玩的东西。   
  虽然说这个东西说是计算机文化，但是在我看来这个东西就是会写程序的数学家搞的玩意，这就和NOI一样荒谬，一堆数学题非得要叫个信息学比赛……   
  
# Demoscene的实现方式
  过去的Demoscene通常都是使用汇编写出来的，虽然说汇编写出来的程序应该很小，但是它因为过于复杂以至于有些硬件资源它无法很好的利用。   
  因为Demoscene主要表现的是音乐和视频，那么这些事让显卡做的效率自然要比用CPU做的效率高很多。比如说我上面所说的OMNISCENT，这个程序完全使用的是CPU的计算资源，虽然使用了4KiB，看起来很小，但是事实上还是浪费了不少的空间。最近我在逛[scene.org](https://scene.org/)的时候见到了一个更加厉害的Demoscene，名字叫做[elevated](https://files.scene.org/view/parties/2009/breakpoint09/in4k/rgba_tbc_elevated.zip)。它用了4KiB表现了一座山的春夏秋冬，不仅画面更加精致，而且时长也更长。   
  我看了一下，他们还放出了[源代码](https://files.scene.org/view/resources/code/sources/rgba_tbc_elevated_source.zip)，看起来是使用C++和汇编写出来的，使用了微软的DirectX9来调用显卡。再看其他代码，好多东西就只用了一句话来表示，比如太阳就只需要一句`"+pow(saturate(mul(e,q[3])),16)*float3(.4,.3,.1)"`，云也只有一句`"+.1*f(s+q[3].w*.2,10)"`。这样看来难怪整个程序那么小，一个公式就表示了一个模型，这群伪装成程序员的数学家也真是有够强。   
  除此之外也有一些用数学界常有的复杂3D模型生成公式的，比如什么Romanesco Broccoli，还有分形之类乱七八糟的东西，像这些就超出我的理解范围了 ~~（连线代都搞不懂还搞这个？）~~。

# 后记
  既然Demoscene对数学的要求如此之高，对我来说自然是无缘步入了。但是欣赏他们的作品还是挺不错的。   
  除了上述的一些Demo(Intro)外，我还找到了一些比较有意思的，比如今年一个叫做Revision的Party里就有一个叫做[SyncCord](https://files.scene.org/view/parties/2020/revision20/pc-4k-intro/synccord_nusanvalden.zip)的作品，同样是4KiB，效果也是非常的不错。   
  当然也不一定非要局限于4KiB还是64KiB，更大的有更多的表现空间，就比如07年的一个叫做[debris](https://files.scene.org/view/parties/2007/breakpoint07/demo/fr-041_debris.zip)的作品，堪称大片，大小也仅仅只有177KiB，另外这也是Farbrausch的作品。   
  更多的作品大家可以自己去[scene.org](https://scene.org/)找，这里面有历年各位神仙做的各种各样的Demoscene。   
  另外除了这些程序之外，也还有一些大佬拿JS写的只有1KiB的网页，大家可以在[js1k.com](https://js1k.com/)里找到，当然这些和那些写真正程序的人完全不能比，只是觉得1KiB的JS能做出那些东西也感觉很有意思。
