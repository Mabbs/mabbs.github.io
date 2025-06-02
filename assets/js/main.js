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
        $('body').html(function(_, oldHTML) {
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