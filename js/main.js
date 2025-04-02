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

$(function() {
    function getQueryVariable(variable){
           var query = window.location.search.substring(1);
           var vars = query.split("&");
           for (var i=0;i<vars.length;i++) {
                   var pair = vars[i].split("=");
                   if(pair[0] == variable){return pair[1];}
           }
           return(false);
    }
    var keyword = decodeURI(getQueryVariable("kw"));

    if (!keyword) return;

    // 转义正则表达式特殊字符，避免安全问题
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 创建不区分大小写的正则表达式（全局匹配）
    const regex = new RegExp(`(${escapedKeyword})`, 'gi');

    // 递归遍历并高亮文本节点
    function highlightTextNodes(element) {
        $(element).contents().each(function() {
            if (this.nodeType === Node.TEXT_NODE) {
                const $this = $(this);
                const text = $this.text();
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

    $('section').each(function() {
        highlightTextNodes(this);
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

var message_Path = '/Live2dHistoire/live2d/';
var talkAPI = BlogAPI + "/ai_chat";
