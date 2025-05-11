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
        $("html")[0].style = "-webkit-filter: grayscale(100%);filter:progid:DXImageTransform.Microsoft.BasicImage(graysale=1);";
        $("html")[0].innerHTML = $("html")[0].innerHTML.replace(/Mayx/g, "Ghost");
        console.warn("Mayx may already be Dead");
    }
});

function getSearchJSON(callback) {
    var searchData = JSON.parse(localStorage.getItem("blog_" + lastUpdated.valueOf()));
    if (!searchData) {
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key.startsWith('blog_')) {
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