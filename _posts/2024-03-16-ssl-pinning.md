---
layout: post
title: 如何用requests库验证证书
tags: [Python, requests, ssl]
---

  用Python制作的程序怎么样？<!--more-->    

# 起因
  之前在抓包某些APP的时候，可能会遇到即使信任了抓包软件的CA根证书也无法抓包的情况，听说之所以遇到这种情况是因为那些APP使用了“SSL Pinning”的技术，可以只信任代码中认为可以信任的证书。不过对于逆向之类的事情我并不擅长，这种问题我也不太会解决。但是不能解决问题我可以创造问题啊，Java的APP我不会写，但是我会用Python写，所以今天来看看怎么样用Python实现类似“SSL Pinning”的技术。   

# 实现方案
  真正的SSL Pinning似乎是通过预置网站所使用的根证书或者中间证书来实现的，这样的好处是即使证书到期换了证书也能继续验证。不过我觉得其实没必要这么麻烦，一般Python程序要连接的后端也没必要在浏览器中调用，大不了就自签一个证书，然后自己验证证书就好了，反正中间人攻击重新签的公钥证书的指纹肯定和原来网站公钥证书的指纹不一样，用这一点就可以判断有没有被抓包。   
  不过我搜了一下，如果想实现这个功能，首先请求的时候就要获得网站的证书，很多资料都是直接用socket和ssl这两个包实现的，但是在python上请求一般都是用requests，用socket操作有点太麻烦了吧，再问问AI呢？AI给出的回复是：`response.raw.connection.getpeercert()`，结果执行了根本没有这个方法，不愧是只会东拼西凑，这应该是ssl库的函数吧……要么可以用`urllib3.contrib.pyopenssl.ssl.get_server_certificate()`这个方法获取，但是这个方法不是在发起请求的时候获取的证书，而是直接先访问了一下服务器然后直接获取的证书，这样每次调用接口的时候可能就要请求两次服务器了，感觉不怎么好……后来去Stack Overflow上搜了一下，还真有关于类似这个问题的[讨论](https://stackoverflow.com/questions/16903528/how-to-get-response-ssl-certificate-from-requests-in-python)，于是我简单改编了一下，最终效果如下：
```python
import requests
import hashlib

HTTPSConnection = requests.packages.urllib3.connection.HTTPSConnection
orig_HTTPSConnection_connect = HTTPSConnection.connect
def new_HTTPSConnection_connect(self):
    orig_HTTPSConnection_connect(self)
    try:
        self.peer_certificate = self.sock.getpeercert(binary_form=True)
    except AttributeError:
        pass
HTTPSConnection.connect = new_HTTPSConnection_connect

def verify_cert_request(url):
    with requests.get(url, stream=True, verify=False) as r:
        result = [ hashlib.sha256(r.raw.connection.sock.getpeercert(binary_form=True)).hexdigest(), r.text ]
    return result

result = verify_cert_request('https://www.baidu.com')
print(result[0])
print(result[1][:10])
```
  用这个代码就能获取到请求的网站中证书的指纹了，如果不希望其他人抓包，先自己计算一下自己证书的hash指纹，然后在代码中执行逻辑的时候先判断一下请求网站的指纹是不是自己网站的指纹，如果不是还可以考虑一下反制措施？这样就能实现证书的验证了。   

# 后记
  不过Python作为解释型语言，代码不是随便看😂？就算用Cython然后加壳啥的调用的库依然不是加密的，大不了修改依赖的库然后让它返回的结果向正确的凑可能也行？不过这样至少能防止绝大多数抓包的人了。