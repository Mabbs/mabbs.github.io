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
    function showHitCount() {
        $(".visitors-index").each(function() {
            var $elem = $(this);
            $.get(BlogAPI + "/count_click?id=" + $elem.attr('id'), function(data) {
                $elem.text(Number(data));
            });
        });
    }
    
    function addCount() {
        var $visitor = $(".visitors:first");
        $.get(BlogAPI + "/count_click_add?id=" + $visitor.attr('id'), function(data) {
            $visitor.text(Number(data));
        });
    }
    if ($('.visitors').length == 1) {
        addCount();
    } else if ($('.visitors-index').length > 0) {
        showHitCount();
    }
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