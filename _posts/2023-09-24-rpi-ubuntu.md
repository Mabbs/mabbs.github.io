---
layout: post
title: 在树莓派4B上安装Ubuntu以及各种操作
tags: [树莓派, Ubuntu]
---

  明明在普通的电脑上也能完成这些操作……😥<!--more-->    

# 起因
  自从上次我给我的树莓派4B-8GiB内存版[安装了Windows11](/2023/05/22/rpi-win.html)以后，我感觉这个东西上是真的鸡肋，速度慢而且兼容性还差，指令集有缺失连很多需要用到加密库的软件都不能正常运行……后来我就重装了一个ESXi-Arm Fling，但是装这个也有个问题，就是它不能使用TF卡存储东西，我还特地为了Windows买了个64GiB的TF卡，结果装虚拟机还用不了😂，U盘我也只有一个32GiB的，ESXi-Arm Fling如果想要正常的存储配置信息就至少需要占用掉3*4GiB的空间，这样虚拟机就只能使用20GiB的空间……真的全都是垃圾，20GiB能开几个虚拟机啊，开了也没啥能用的。所以这个树莓派就一直在吃灰。   
  后来我又想整点活，想着干脆安装个Ubuntu好了，反正放着也是吃灰，也错过了最佳卖树莓派的机会，就用起来吧，安装Ubuntu的时候居然也是各种碰壁😓，一开始我用树莓派镜像烧录器，闭着眼睛直接选了Ubuntu Server系统，我还以为它可以像安装树莓派系统那样第一次启动的时候让我设置密码，结果烧录完之后引导就直接让登录了，我连密码都不知道要怎么登录啊😥，网上搜了一下有默认密码，输进去之后显示需要让我更改密码，结果这个需要更改的密码怎么设置都不能生效😰，后来去Ubuntu官网看了一眼才知道原来需要在烧录中选择高级设置，手动设置密码才行……网上这些教程都是垃圾，这个软件也一样🤬，啥提示都没有，不看文档就只能靠猜了😢。   
  最后终于把Ubuntu安装好了，可以开始整活了😁。   

# 用树莓派整点什么
## 整点FM电台
  安装好Ubuntu后我最先想干的事情还是整[FM电台](/2022/03/27/radio.html)，毕竟这真的就是树莓派唯一和其他设备不一样的地方了啊，于是我就编译了一下[PiFmAdv](https://github.com/miegl/PiFmAdv)并运行，结果不知道为什么一运行树莓派就直接死机……于是我退而求其次，选择了[fm_transmitter](https://github.com/markondej/fm_transmitter)，这个倒是能运行，不过操作和树莓派3B区别相当大，首先编译得要用`make GPIO21=1`，然后杜邦线也要插到第40个接口，具体如下图打x的位置：
```
,--------------------------------.
| ooooooooooooooooooox J8   +======
| 1ooooooooooooooooooo  PoE |   Net
|  Wi                    1o +======
|  Fi  Pi Model 4B  V1.4 oo      |
|        ,----. +---+         +====
| |D|    |SoC | |RAM|         |USB3
| |S|    |    | |   |         +====
| |I|    `----' +---+            |
|                   |C|       +====
|                   |S|       |USB2
| pwr   |hd|   |hd| |I||A|    +====
`-| |---|m0|---|m1|----|V|-------'
```  
  CPU和GPU也全部需要定频运行，另外设置频率不能超过93 MHz……我调了半天才能正常运行……还有就是不像之前PiFmAdv那个项目可以使用立体声，感觉树莓派4B还不如3B……   
  不过我写着写着感觉好像不太对劲，看了一眼我上次写电台的那篇文章的时间比PiFmAdv最后一次更新还要早，看了一眼提交发现人家已经把问题解决了，难怪我运行不起来，原来是代码没用最新的🤣，刚刚更新了一下代码之后再运行已经没有任何问题了，立体声啥的都能正常使用了。不过Makefile还是没改……aarch64的系统运行依然会出问题😥……其实改起来也很简单，把Makefile里面的两个参数换成：   
```Makefile
	CFLAGS = $(STD_CFLAGS) -march=armv8-a -ffast-math -DRASPI=4
	TARGET = pi4
```
  就可以正常编译了。
## 整点大语言模型LLaMA
  因为我的树莓派有8GiB内存，之前我在我的8GiB内存的[MacBook Pro上跑LLaMA](/2023/04/05/ai.html)都没问题，那在树莓派上跑个LLaMA应该也没问题，所以就想试试看。跑起来非常简单，把[llama.cpp](https://github.com/ggerganov/llama.cpp)拉下来，然后直接编译就行了，但是实际跑起来速度非常慢，大概1token要1-2秒……根本用不成，不过现在的llama.cpp已经非常完善了，支持各种各样的硬件加速，无论是在我的MacBook上，还是用N卡、A卡，甚至手机使用OpenCL似乎都可以进行硬件加速。这些都能得到很不错的速度，那树莓派呢？树莓派用的好像是博通的叫什么VideoCore的显卡，我搜了一下，貌似没有办法使用OpenCL……不过搜的过程中发现似乎可以[装Vulkan](https://qengineering.eu/install-vulkan-on-raspberry-pi.html)，虽然llama.cpp不能使用Vulkan，不过ncnn框架似乎可以使用Vulkan，跑个waifu2x也算不浪费这个树莓派的GPU啊，只是安了半天发现不连接屏幕貌似安了也识别不了……所以还是算了吧……
## 整点QEMU-KVM Windows虚拟机
  当时我在树莓派上安装Windows11的时候听说在虚拟机上运行的效果要比裸机安装效果更好，我听到之后认为这是胡说八道，哪有虚拟机比裸机运行效果好的啊，不过树莓派嘛……说不定会有因为驱动不完整之类的情况，毕竟如果是在虚拟机里安装系统外面的Linux系统可以使用无线网卡，而直接安装Windows是不能使用无线网卡的，所以这次我也打算试试看，反正树莓派上使用虚拟机是可以使用KVM加速的，所以试试也没关系。   
  安装QEMU也很简单，直接执行：
```bash
sudo apt install qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils virtinst virt-manager qemu-system-arm qemu-efi-aarch64 seabios vgabios
```
  就可以了，安装系统的话也很简单，首先去下载Windows所需要的驱动[virtio-win](https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/latest-virtio/)，然后下载Windows ARM版的安装光盘，这个去MSDN I tell you下载就行了，之后下载一个VNC客户端用来连接虚拟机的屏幕，然后创建硬盘：
```bash
qemu-img create -f vhdx -o subformat=fixed system.vhdx 30G
```
  准备好这些以后就可以启动虚拟机了，启动的命令如下：
```bash
sudo qemu-system-aarch64 -M virt-2.12 -smp 4 -m 4G -cpu host -enable-kvm -bios /usr/share/qemu-efi-aarch64/QEMU_EFI.fd -device ramfb -device qemu-xhci,id=xhci -usb -device usb-kbd -device usb-mouse -device usb-tablet -k en-us -device virtio-balloon -device virtio-rng -device virtio-blk,drive=system -drive if=none,id=system,format=raw,media=disk,file=system.vhdx -device usb-storage,drive=install -drive if=none,id=install,format=raw,media=cdrom,file=win10.iso -device usb-storage,drive=drivers -drive if=none,id=drivers,media=cdrom,file=virtio-win.iso -device virtio-net,disable-legacy=on,netdev=net0 -netdev user,id=net0,hostfwd=tcp::3389-:3389 -vnc :1 
```
  然后就能像正常安装Windows系统那样安装了，其中需要注意的一点是安装的时候会读不到硬盘，需要加载光盘中的驱动，其他缺失的驱动光盘里基本上都有，直接安装就行。另外第一次重启前最好把`-device usb-storage,drive=install -drive if=none,id=install,format=raw,media=cdrom,file=win10.iso`删掉，安装好之后可以打开远程桌面，就可以直接使用树莓派的IP去连接Windows系统，还能有完整的分辨率和音频支持。   
  既然装好了虚拟机，那么我就应该验证一下虚拟机是不是真的比物理机安装效果更好了。具体怎么验证呢？我又找了一个树莓派4B-4GiB内存版，在上面安装直接安装同版本的Windows ARM版，然后把两个树莓派的频率都调为1.8GHz，在两个Windows系统上下载了7-Zip ARM版，跑一遍基准测试，结果裸机安装的总体评分为6.1GIPS左右，虚拟机是5.1GIPS左右，这很明显裸机还是更强嘛，虚拟机唯一的优势就是可以用无线网络罢了，说到网络我也测了一下这个速度，在同样使用有线网络的情况下，虚拟机因为用的是user模式效果很差，连50Mbps都跑不到，而裸机可以超过100Mbps。至于qemu怎么使用其他网络模式我也不太会，整起来好像还挺麻烦的。总的来看树莓派安装QEMU-KVM运行Windows实在是不怎么样……一样是个垃圾。
## 让树莓派运行x86程序
  既然安装了QEMU，那就该玩玩跨指令集的东西了，当然跨指令集是没办法使用KVM了，而且树莓派不像MacBook的Rosetta 2那样有硬件加速，效果肯定会非常差，不过我已经做好了觉悟，还是想整个玩玩。怎么整呢？非常简单，只要运行
```bash
sudo apt install qemu-user-binfmt
```
  就好了，那到底是什么软件让我想大费周章的让树莓派运行x86程序呢？其实是一个叫做[postjson](http://cdn.ouapi.com/postjson_linux.zip)的接口测试工具，似乎是拿Go写的，但是没有开源，也没有ARM64的二进制文件，所以就只好用QEMU啦，试了一下还真能运行，而且就像Rosetta 2那样直接当作原生的程序运行就可以，效果挺不错，不过CPU占用非常高，一运行一个CPU核心就占满了😂，也就是勉强能用的水平吧。

# 感想
  搞了这么多东西之后发现树莓派除了那个FM电台不能在普通电脑上操作其他不是和普通的电脑一样吗🤣？那买树莓派还有什么意义，不如买个二手手机，不过有了树莓派就感觉越垃圾越想挖掘它的作用，这可能就是它存在的意义吧🤣。