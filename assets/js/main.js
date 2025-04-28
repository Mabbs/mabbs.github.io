var message_Path = '/Live2dHistoire/live2d/';
var talkAPI = BlogAPI + "/ai_chat";

(function () {
    var $backToTopTxt = "返回顶部", $backToTopEle = $('<div class="backToTop"></div>').appendTo($("body"))
        .text($backToTopTxt).attr("title", $backToTopTxt).click(function () {
            $("html, body").animate({ scrollTop: 0 }, 120);
        }), $backToTopFun = function () {
            var st = $(document).scrollTop(), winh = $(window).height();
            (st > 0) ? $backToTopEle.show() : $backToTopEle.hide();
        };
    $(window).bind("scroll", $backToTopFun);
    $(function () { $backToTopFun(); });
})();
$(function () {
    $("div#landlord").mouseenter(function () {
        $("div.live_ico_box").fadeIn();
    });
    $("div#landlord").mouseleave(function () {
        $("div.live_ico_box").fadeOut();
    });
    function showHitS(hits) {
        $.get(BlogAPI + "/count_click?id=" + hits.id, function (data) {
            hits.innerHTML = Number(data);
        });
    }
    function showHitCount() {
        var visitors = $(".visitors-index");
        for (var i = 0; i < visitors.length; i++) {
            showHitS(visitors[i]);
        }

    }
    function addCount() {
        var visitors = $(".visitors");
        $.get(BlogAPI + "/count_click_add?id=" + visitors[0].id, function (data) {
            visitors[0].innerHTML = Number(data);
        });
    }
    if ($('.visitors').length == 1) {
        addCount();
    } else if ($('.visitors-index').length > 0) {
        showHitCount();
    }
});

$(function () {
    const urlParams = new URLSearchParams(window.location.search);
    const keyword = urlParams.get('kw')?.trim();

    if (!keyword) return;

    // 转义正则表达式特殊字符，避免安全问题
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 创建不区分大小写的正则表达式（全局匹配）
    const regex = new RegExp(`(${escapedKeyword})`, 'gi');

    // 递归遍历并高亮文本节点
    const escapeHTML = str => str.replace(/[&<>"']/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[tag] || tag));
    function highlightTextNodes(element) {
        $(element).contents().each(function () {
            if (this.nodeType === Node.TEXT_NODE) {
                const $this = $(this);
                const text = escapeHTML($this.text());

                // 使用正则替换并保留原始大小写
                if (regex.test(text)) {
                    const replaced = text.replace(regex, '<mark>$1</mark>');
                    $this.replaceWith(replaced);
                }
            } else if (
                this.nodeType === Node.ELEMENT_NODE &&
                !$(this).is('script, style, noscript, textarea')
            ) {
                highlightTextNodes(this);
            }
        });
    }

    $('section').each(function () {
        highlightTextNodes(this);
    });
});
$(function () {
    var codeBlocks = document.querySelectorAll('div.highlight');

    codeBlocks.forEach(function (codeBlock) {
        var copyButton = document.createElement('button');
        copyButton.className = 'copy';
        copyButton.type = 'button';
        copyButton.innerText = '📋';

        codeBlock.append(copyButton);

        copyButton.addEventListener('click', function () {
            var code = codeBlock.querySelector('pre code').innerText.trim();
            window.navigator.clipboard.writeText(code)
                .then(() => {
                    copyButton.innerText = '✅';
                })
                .catch(err => {
                    copyButton.innerText = '❌';
                    console.error('Failed to copy:', err);
                });

            setTimeout(function () {
                copyButton.innerText = '📋';
            }, 1500);
        });
    });
});

today = new Date();
timeold = (today.getTime() - lastUpdated.getTime());
secondsold = Math.floor(timeold / 1000);
e_daysold = timeold / (24 * 60 * 60 * 1000);
daysold = Math.floor(e_daysold);
if (daysold > 90) {
    $("html")[0].style = "-webkit-filter: grayscale(100%);filter:progid:DXImageTransform.Microsoft.BasicImage(graysale=1);";
    $("html")[0].innerHTML = $("html")[0].innerHTML.replace(/Mayx/g, "Ghost");
    console.warn("Mayx may already be Dead");
}