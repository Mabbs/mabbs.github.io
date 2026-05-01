---
layout: post
title: 虚拟局域网的组网探索记录
tags: [虚拟网络, 异地组网, WireGuard]
---

  异地组网，有多少种选择？<!--more-->   

# 起因
  最近我有一些放置在许多不同地方的机器，有一些东西需要让它们之间能够相互访问。虽然我很久以前写过一篇使用[SSH进行互联](/2021/05/07/ssh.html)的文章，但这样做每个服务都需要单独配置，也不方便管理。所以为了能让机器之间能够轻松通信，我打算组建一个虚拟局域网，让它们像在同一交换机下一样。不过这种组网的工具非常多，我应该选哪个比较好呢？   

# 不同组网工具的体验
## n2n
  以前我用过一款用C写的叫做[n2n](https://github.com/ntop/n2n)的工具，它可以很轻松地组建一个P2P的二层虚拟网络，而且生态也不错，手机、电脑、路由器、服务器上都有可以用的客户端。使用起来非常简单，它的中继和穿透服务程序叫做Supernode，无需太多的配置，只要在有公网的服务器安装并使用`-p`指定一个端口就可以启动。而客户端配置也非常简单，用`-l`配置好Supernode的地址，然后让想要在同一个网络的机器使用相同的任意`-k`和`-c`就可以成功组网，可以说算是非常好用了。   
  唯一的问题就是它这个项目看起来似乎已经停止更新了……虽然大多数情况下用起来没问题，但是有时候还是会出现组网不太可靠的情况。如果两个机器都不经过NAT，可以通过公网IP连接，它的可靠性还可以。但如果是两个NAT后的机器之间，有时候会存在莫名掉线的情况，也许是因为穿透导致的不可靠？总之遇到这种情况之后重启又能正常工作，说明是软件本身的问题，但它停更了……所以对我来说它的可靠性不太够。（其实它还有个叫做[n3n](https://github.com/n42n/n3n)的继任者，不过知名度不高，所以生态也不太行）   
## WireGuard
  其实在这之后我本来是打算用L2TP/IPSec进行组网的，但看了一下貌似配置有点复杂，而且不够现代，现在想要组网貌似大多都推荐[WireGuard](https://git.zx2c4.com/wireguard-linux/)作为更现代的选择。只不过它和n2n相比来说是三层的虚拟网络，如果需要发送非TCP/IP协议的特别包，可能就用不了它吧，当然对我来说没有这种需求。它用起来也非常简单，不过正常情况下它设计是为了点对点传输，而且没有自带的NAT穿透功能，所以如果想要实现组网，就得搭一个星形网络，让互联网上的服务器作为虚拟的交换机，这个做起来倒也不复杂。首先，每个节点需要生成一个公私钥对作为身份证明，在安装好WireGuard之后执行`wg genkey`就能生成私钥。作为交换机的节点需要在`/etc/wireguard/wg0.conf`中写一个这样的配置：   
```conf
[Interface]
PrivateKey = xxx
Address = 192.168.1.1/24
ListenPort = 51820

PostUp = iptables -A FORWARD -i wg0 -o wg0 -j ACCEPT
PostDown = iptables -D FORWARD -i wg0 -o wg0 -j ACCEPT

# 机器1
[Peer]
PublicKey = xxx
AllowedIPs = 192.168.1.2/32

# 机器2
[Peer]
PublicKey = xxx
AllowedIPs = 192.168.1.3/32
```
  其中PrivateKey填写交换机自己的私钥，而作为使用者的Peer中的PublicKey可以用对应节点的私钥执行`echo xxx | wg pubkey`这个命令查看，然后每个Peer需要像这样配置：   
```conf
[Interface]
PrivateKey = xxx
Address = 192.168.1.2/24

[Peer]
PublicKey = xxx # 交换机节点的公钥
Endpoint = xxx.xxx.xxx.xxx:51820 # 交换机节点的地址
AllowedIPs = 192.168.1.0/24
PersistentKeepalive = 25
```
  最后全都配置好之后所有节点使用`systemctl enable --now wg-quick@wg0`启动就可以了，启动之后每个节点可以执行`wg`查看当前的连接状态。   
  当然这是在Linux上，至于其他系统大多都有GUI配置，填起来更简单。它的生态也非常好，基本上常见的操作系统都支持，具体可以在[官网](https://www.wireguard.com/install/)查看支持的系统和安装方法。不过由于它在Linux中优先使用内核模块，导致我在一些比较小众的环境中也是遇到了各种特别的问题。   
### 在红米AX3000中遇到的问题
  我在这个网络中有几个安装了OpenWrt的路由器，在这其中使用联发科芯片的路由器基本上都没什么问题，官网能轻松下载到固件，也能很轻松地在软件包中找到WireGuard并安装，但我还有一台使用高通芯片的红米AX3000，似乎因为高通对资料管控得很严格，导致它没有官网的固件，最终我在GitHub上找了一个其他人自己编译的[固件](https://github.com/hzyitc/openwrt-redmi-ax3000/)。虽然它整起来有点麻烦，不过倒也能用，但是在我尝试安装WireGuard的时候遇到了麻烦……   
  它的软件包里有WireGuard，也能找到对应的内核模块安装包，但安装完之后没法启动……随后我看了一下它下载的[安装包](https://github.com/hzyitc/openwrt-redmi-ax3000/blob/gh-pages/ipq50xx-qsdk-kernel-5.4-openwrt-21.02-qsdk-11.5.05.841.1029/ci-20240727-173350-ab1f9ffa/kmod-wireguard_5.4-qsdk-11.5.0.5-1_arm_cortex-a7_neon-vfpv4.ipk)，结果发现是空的😰，它这个固件的内核模块可能是在编译的时候遇到了一些问题。至于让我自己编译这个内核模块，难度似乎有点高了……那怎么办呢？要知道Linux的内核模块都是和内核挂钩的，没办法随便找一个别的模块使用。还好WireGuard倒也不止有内核模块，也有一些在用户空间中的实现，比如[wireguard-go](https://git.zx2c4.com/wireguard-go)和[wireguard-rs](https://git.zx2c4.com/wireguard-rs)。只是官方似乎非常不推荐在Linux上使用它们，所以没有提供预编译的版本。不过遇到这种问题的人也许是比较多，所以有人做了在[OpenWrt上使用的wireguard-go](https://github.com/seud0nym/openwrt-wireguard-go)，安装好之后效果和使用内核模块的感觉基本上没什么区别，最终也能连通，唯一的区别就是在执行`wg`的时候，会显示“Interface: wg0 (userspace)”罢了。从效率上来说虽然肯定没有内核模块那么高，但它其实也用了“Tun”模块，理论上和使用“Tap”模块的n2n应该差不多吧。   
### 在openEuler中遇到的问题
  在我使用的节点中，还有一台安装了openEuler 22.03 LTS操作系统的服务器，虽然openEuler和CentOS可以说基本上没什么区别，但毕竟它的内核是openEuler自己编译的，所以没办法直接使用CentOS的内核模块。并且openEuler的源中也完全没有提供和WireGuard相关的包，所以想要在openEuler上安装WireGuard还是有些挑战（当然如果觉得麻烦，它们倒是有一个兼容WireGuard的客户端[TunSafe](https://eur.openeuler.openatom.cn/coprs/nucleo/tunsafe/)可以凑活用一下）。   
  后来我试了一下在这上面安装wireguard-tools倒是可以直接用[CentOS 8EPEL源中的包](https://mirrors.tuna.tsinghua.edu.cn/epel/8/Everything/x86_64/Packages/w/wireguard-tools-1.0.20210914-1.el8.x86_64.rpm)，但openEuler的内核在编译的时候故意没有包含WireGuard内核模块……这该怎么办呢？用wireguard-go吗？虽然这样可以很简单地解决，但感觉这样就是认输了😂。后来我搜了一下，找到了一篇[在openEuler安装WireGuard内核模块](https://dingle.site/archives/wei-openeulertian-jia-wireguardmo-kuai)的文章，方法大致如下：   
  1. 首先安装编译环境和源代码。
```bash
yum install elfutils-libelf-devel kernel-devel pkgconfig "@Development Tools"
yum install kernel-headers.x86_64 pkg-config ncurses-devel openssl-devel dwarves
yum install kernel-source.x86_64
```
  2. 然后进行编译配置，内核源码一般会安装到`/usr/src/`下，找到之后在里面执行`make menuconfig`，然后勾选“Device Drivers -> Network device support -> Wireguard secure network tunnel”并保存。
  3. 最后执行`make`开始编译，为了加速可以用`-j`参数加上CPU的核心数进行并行编译，当时编译就花掉了一整天😂，理论上应该可以只编译WireGuard和它依赖的几个模块，不过我不太清楚怎么做，还是费点时间按照文中说的做吧。
  4. 执行`make modules_install`将编译好的结果安装到`/lib/modules/5.10.0`。
  不过系统似乎不会去这个路径下找内核模块，所以还得把这里面的kernel文件夹复制到`/lib/modules/$(uname -r)`下，然后执行`depmod -a`更新模块依赖。
  5. 最后执行`modprobe wireguard`验证模块是否能正常加载，如果没有报错并且可以在`lsmod | grep wireguard`中看到，就说明安装成功了，剩余的步骤和其他Linux系统一样。

### WireGuard的控制平面
  虽然WireGuard本身配置很简单，但每加一个节点还得在交换机节点上修改一下配置文件，稍微有些麻烦，所以有人开发了一些控制平面，让它可以被更规范地管理，比如[Netmaker](https://github.com/gravitl/netmaker)和[Headscale](https://github.com/juanfont/headscale)。而Headscale主要是为Tailscale客户端开发的开源服务器端，因此功能会局限于Tailscale提供的功能。所以如果没有用过Tailscale，可以优先考虑Netmaker。   
  这两个控制平面支持的功能相当丰富，而且它们还支持让WireGuard进行NAT穿透，自动组建Mesh网络，不像我一堆在NAT后的设备还要直接使用WireGuard就只能搭成星形网络。只不过对我来说，我也用不到那么多企业级功能，这个服务端配置起来也有点麻烦，而且我也没有很多节点需要动态增减，我的云端服务器带宽也足够使用，所以就没有用这些东西了😆。   
## 其他的组网工具
  除了WireGuard之外，还有很多其他的组网工具，比如[VNT](https://github.com/vnt-dev/vnt)和[EasyTier](https://github.com/EasyTier/Easytier)，这俩用起来也非常简单，只需要加几个参数就能组网，和n2n一样。不过功能相比于n2n来说要强大不少，也支持NAT穿透，而且还都兼容WireGuard协议，另外不像WireGuard强制使用UDP传输，这两个还能用TCP和WebSocket，在特殊网络环境下应该比直接用WireGuard更好。另外它们都是Rust编写的，也许会更安全😋？可惜我已经配好WireGuard之后懒得再改了，如果以后有机会，可以尝试一下。   

# 总结
  现在如果想要异地搭建虚拟局域网，还是有相当多的选择，而且无论是性能还是配置难度，都比以前好了不少。看来这种需求还是相当多啊，也正是因为有这些需求，所以才会出现这么多的方案可以用吧……总之我最后还是选择了纯WireGuard方案，主要还是简单够用，可靠性也不错，而且折腾了这么多再换也不太合适吧🤣。   