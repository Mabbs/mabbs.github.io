---
layout: post
title: 关于OS模拟器的探索
tags: [模拟器, Windows, Android, Linux, macOS]
---

  在一个系统模拟另一个系统有多困难呢？<!--more-->    

# 起因
  前段时间我在网上和人聊天的时候谈到了安卓模拟器，在我看来所有除了Linux上可以使用例如Waydroid的[容器原生运行Android](/2023/12/24/android.html)之外，其他系统只能通过虚拟机的方式运行，毕竟不用虚拟机能在完全不相干的系统上运行安卓我感觉还是挺不可思议的。不过随后就被打脸了🤣，网易在前几年出过一个包含“星云引擎”的安卓模拟器——[MuMu Nebula](https://www.mumuplayer.com/mumu-nebula.html)，据说这个模拟器是不需要使用虚拟化技术的。所以这次我打算探索一下这个安卓模拟器和它类似的模拟器。   

# 关于虚拟机和模拟器的区别
  在我看来，模拟硬件的就是虚拟机，模拟软件的就是模拟器。不过现在这些挺难分的，融合的也挺多。比如QEMU+KVM使用硬件虚拟化显然是虚拟机，QEMU System模式使用二进制翻译的方式模拟硬件也是虚拟机，但是QEMU User模式使用了当前系统的资源，没有模拟硬件，所以应该是模拟器（不过也有叫仿真器的？）……不过也许不是这样？模拟指令集也算虚拟了一个CPU吧，像Java虚拟机似乎就是这样，只是单模拟一个CPU叫虚拟机又感觉不太对……并且macOS的Rosetta 2甚至还有硬件加速（硬件模拟x86的内存一致性模型？），还有用了AOT已经翻译完的程序再执行那应该不算模拟器吧……另外还有什么容器之类的……搞得这些概念很难分清。   
  那至少使用了硬件虚拟化技术的肯定是虚拟机吧？其实这也不一定，现在的Windows有个叫“基于虚拟化的安全性”的功能使用了硬件虚拟化技术，但是不能说现在的Windows是运行在虚拟机上吧？这些大公司搞的乱七八糟的黑科技把我都绕晕了😂。   
  总之接下来我要说的模拟器是一定基于某个系统，然后模拟另一个系统的环境，不使用硬件虚拟化技术，而且翻译的不是「指令集」，而是「系统调用」，这样感觉才算我心目中的模拟器🫠，也就是OS模拟器。   

# 各种各样的OS模拟器
## MuMu Nebula（Windows模拟Android）
  既然是因为网易的模拟器进行的探索，肯定要先讲这个啦。首先看介绍，它是专为“低端电脑”制作的模拟器，所以整个软件都是32位的，而且不用VT，说明老到不支持硬件虚拟化的CPU都可以运行（不过那样的CPU估计至少是15年前的吧😝）。安装后首先会下载Android的镜像，但不像其他安卓模拟器最后使用的是一个磁盘镜像文件，而是像WSL1那样把所有文件都放在一个文件夹里。至于里面的文件就是和正常的32位Android x86差不多，甚至还有兼容ARM的libhoudini.so文件。然后启动模拟器后可以在任务管理器中看到有许多“nebula.exe”进程，这让我想到了Wine，看起来在模拟器中的每个安卓进程都对应着一个“nebula.exe”进程。这么来看这个星云引擎应该相当于安卓特别精简版的WSL1。   
  其实当时WSA出之前，我以为微软会用WSL1的技术做WSA，结果和WSL2一起用了虚拟机，太令人失望了😅。而且用类似WSL1技术的居然还让网易整出来了……虽然到现在WSA已经凉了，这个星云引擎也是没什么热度，不过单从技术上来说我觉得还是这种要好，因为这种模拟器省**内存**，可以共用**磁盘空间**，不像其他模拟器，就算虚拟机有什么气球驱动动态调整分配的内存，总是不如这种现用现申请的好。不过从速度上来说和虚拟机版安卓模拟器拉不开什么差距，技术难度估计也比虚拟机高很多，大概因为这样，所以它也凉了吧。   
## WSL1（Windows模拟Linux）
  网易那个就挺像WSL1的，不过很明显WSL1出的早，另外和Windows结合的更深，可以直接在任务管理器中管理WSL1中的进程。虽然有些人说WSL1的BUG很多，但对我来说我是一个都没碰到过，用起来还是挺不错的……虽然不支持Docker，这也是它对我来说唯一的缺陷。不过我要是用Docker一般是在Hyper-V中单独安一个虚拟机来操作，因为WSL2和Docker desktop的内存不好控制，虚拟机限制起来比较方便。如果需要在Windows用到Linux的时候就安WSL1，因为省内存，而且和Windows共用同一个IP。不过要是安装了Nvidia显卡的话好像还是得用WSL2？我一般没这个需求所以不存在这种问题。   
## Darling（Linux模拟macOS）
  之前我在玩旧电脑的时候试过[Darling](/2024/04/06/old-pc.html#%E5%85%B3%E4%BA%8Edarling%E7%9A%84%E6%8E%A2%E7%B4%A2)，不过用的都是超老的电子垃圾，因为指令集的原因费了不少功夫才跑起来😂，不过就算用正常电脑跑这个感觉也没啥意义，除了项目本身很不成熟，很多软件跑不起来，另外到现在也没有做出来ARM版，x86的macOS马上就要被抛弃了，如果没有搞出ARM版，这个项目就更没什么意义了。   
## Wine（Linux/macOS模拟Windows）
  Wine我用的还挺多的，因为我现在用的是MacBook，[在macOS上玩Windows游戏](/2023/10/21/game.html#%E4%BD%BF%E7%94%A8wine%E6%B8%B8%E7%8E%A9windows%E6%B8%B8%E6%88%8F)就得用Wine，另外也[在树莓派上试过ExaGear+Wine](/2024/10/13/arm-linux.html#%E8%BD%AC%E8%AF%91%E5%BA%94%E7%94%A8%E6%B5%8B%E8%AF%95)，其实说来这个项目和使用虚拟机相比，不仅更省内存，而且性能要比虚拟机好得多，除了兼容性不太行之外其他都挺好的，看来省内存是模拟器的特色啊。   
## 其他古董模拟器
  这种倒是挺多的，像DOSBox，还有GBA模拟器之类的，我以前在手机上就试过[用DOSBox Turbo安装Windows3.2](/2020/09/27/vm.html#%E6%89%8B%E6%9C%BA%E7%9A%84%E8%99%9A%E6%8B%9F%E6%9C%BA%E4%BD%BF%E7%94%A8%E5%8F%B2)，也用GBA模拟器玩过宝可梦，不过这些其实不算我心目中的模拟器😆，因为它们不是翻译的系统调用，而是模拟了一块古董CPU，然后装了对应的系统能直接用，只不过大家都说这类算模拟器所以提了一下。   

# 感想
  看起来模拟器相比虚拟机还是有很多优势啊，省**内存**这一优势还是很重要的，虽然现在内存倒是不贵 ~~（苹果内存除外🤣）~~ ，但是消耗本不必要的内存就是浪费吧。只不过这种东西对技术要求果然还是太高了，实在是费力不讨好，所以没有企业愿意投入精力来做，所以就都凉了啊……   
  不过Wine倒是活得不错，大概是因为Windows的软件太多了吧……生态很重要啊。