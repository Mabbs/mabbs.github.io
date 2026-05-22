var message_Path = '/Live2dHistoire/live2d/';
var talkAPI = BlogAPI + "/ai_chat";

$(function () {
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

    function showHitCount() {
        $(".visitors-index").each(function () {
            var $elem = $(this);
            $.get(BlogAPI + "/count_click?id=" + $elem.attr('id'), function (data) {
                $elem.text(Number(data));
            });
        });
    }
    function addCount() {
        var $visitor = $(".visitors:first");
        $.get(BlogAPI + "/count_click_add?id=" + $visitor.attr('id'), function (data) {
            $visitor.text(Number(data));
        });
    }
    if ($('.visitors').length == 1) {
        addCount();
    } else if ($('.visitors-index').length > 0) {
        showHitCount();
    }

    if (Math.floor((new Date().getTime() - lastUpdated.getTime()) / (24 * 60 * 60 * 1000)) > 90) {
        $("html").css({
            "-webkit-filter": "grayscale(100%)",
            "filter": "progid:DXImageTransform.Microsoft.BasicImage(grayscale=1)"
        })
        $('body').html(function (_, oldHTML) {
            return oldHTML.replace(/Mayx/g, 'Ghost');
        });
        console.warn("Mayx may already be Dead");
    }
});

function getSearchJSON(callback) {
    if (typeof Storage == 'undefined') {
        $.getJSON("/search.json", callback);
        return;
    }
    var searchData = JSON.parse(localStorage.getItem("blog_" + lastUpdated.valueOf()));
    if (!searchData) {
        for (var i = localStorage.length - 1; i >= 0; i--) {
            var key = localStorage.key(i);
            if (key.indexOf('blog_') === 0) {
                localStorage.removeItem(key);
            }
        }
        $.getJSON("/search.json", function (data) {
            localStorage.setItem("blog_" + lastUpdated.valueOf(), JSON.stringify(data));
            callback(data);
        });
    } else {
        callback(searchData);
    }
}
if (typeof window.go === 'undefined') {
    window.go = function (url) {
        window.location.href = url;
        return;
    }
}

function getWelcomeText(pathname, title) {
    pathname = pathname || window.location.pathname;
    title = title || document.title.split(' | ')[0];

    if (pathname === '/' || pathname === '/index.html') {
        var now = (new Date()).getHours();
        if (now > 23 || now <= 5) return '你是夜猫子呀？这么晚还不睡觉，明天起的来嘛？';
        if (now > 5 && now <= 7) return '早上好！一日之计在于晨，美好的一天就要开始了！';
        if (now > 7 && now <= 11) return '上午好！工作顺利嘛，不要久坐，多起来走动走动哦！';
        if (now > 11 && now <= 14) return '中午了，工作了一个上午，现在是午餐时间！';
        if (now > 14 && now <= 17) return '午后很容易犯困呢，今天的运动目标完成了吗？';
        if (now > 17 && now <= 19) return '傍晚了！窗外夕阳的景色很美丽呢，最美不过夕阳红~~';
        if (now > 19 && now <= 21) return '晚上好，今天过得怎么样？';
        if (now > 21 && now <= 23) return '已经这么晚了呀，早点休息吧，晚安~~';
        return '嗨~ 快来逗我玩吧！';
    }
    return '欢迎阅读<span style="color:#0099cc;">「 ' + title + ' 」</span>';
}
