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
    var BlogAPI = "https://summary.mayx.eu.org";
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

function getSuggestBlog(blogurl) {
    var suggest = $("#suggest-container")[0];
    suggest.innerHTML = "Loading...";
    $.get(BlogAPI + "/suggest?id=" + blogurl, function (data) {
        getSearchJSON(function (search) {
            suggest.innerHTML = "";
            const searchMap = new Map(search.map(item => [item.url, item]));
            const merged = data.map(suggestObj => {
                const searchObj = searchMap.get(suggestObj.id);
                return searchObj ? { ...searchObj } : suggestObj;
            });
            merged.forEach(element => {
                suggest.innerHTML += "<a href=" + element.url + ">" + element.title + "</a> - " + element.date + "<br />";
            });
        });
    });
}

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
