/**
 * PJAX 初始化与页面切换重绑定脚本
 * 依赖：jQuery, jquery.pjax.min.js
 * 加载顺序：在 jquery.pjax.min.js 之后，body 末尾
 */

(function ($) {
    // ========== 常量 ==========
    var CONTAINER = '#pjax-container';
    var PJAX_OPTS = {
        container: CONTAINER,
        fragment: CONTAINER,
        timeout: 8000,
        scrollTo: false
    };

    // ========== 工具函数 ==========

    var _loadedScripts = {};
    var _pendingScripts = [];

    /** 动态加载外部 CSS（避免重复加载） */
    function loadCSS(href) {
        if ($('link[href="' + href + '"]').length) return;
        $('<link rel="stylesheet" href="' + href + '" />').appendTo('head');
    }

    /**
     * 动态加载外部 JS（避免重复）
     * 用对象跟踪已加载的 URL，而不是检查 DOM 中的 <script> 标签
     * （pjax 替换容器内容后，惰性 <script> 标签存在但不代表已执行）
     */
    function loadScript(src, callback) {
        if (_loadedScripts[src]) {
            if (typeof callback === 'function') callback();
            return;
        }
        _loadedScripts[src] = true;
        var s = document.createElement('script');
        s.src = src;
        s.onload = callback || null;
        document.body.appendChild(s);
    }

    /**
     * 按顺序执行脚本数组（内联和外部混合）
     * 外部脚本加载完成后再执行后续内联脚本，保持依赖顺序
     */
    function executeScripts(scripts) {
        var idx = 0;
        function runNext() {
            while (idx < scripts.length) {
                var s = scripts[idx];
                idx++;
                if (s.src) {
                    loadScript(s.src, runNext);
                    return; // 等待 onload 回调
                }
                try {
                    (window.execScript || function (code) {
                        window['eval'].call(window, code);
                    })(s.text);
                } catch (e) {
                    console.warn('[pjax] inline script exec error:', e);
                }
            }
        }
        runNext();
    }

    // ========== 页面类型判断 ==========

    /** 是否为文章页（非首页/分页） */
    function isPostPage(pathname) {
        return !/^(\/(index\.html)?|\/page\d+(\/index\.html)?)$/.test(pathname || window.location.pathname);
    }

    /** 是否为真正的文章页（用 DOM 特征判断，仅 post 布局才有这些元素） */
    function isRealPostPage() {
        return $(CONTAINER + ' #gitalk-container').length > 0;
    }

    // ========== 欢迎语生成 ==========

    /**
     * 根据当前时间和页面生成 Live2D 欢迎语
     * 此函数暴露到 window._live2d.getWelcomeText，供 message.js 首次加载时复用
     * @param {string} [pathname] - 页面路径，默认当前路径
     * @param {string} [title] - 页面标题，默认从 document.title 提取
     * @returns {string} 欢迎语 HTML
     */
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

    // ========== 各组件重初始化 ==========

    /** 访问量统计 */
    function reinitVisitors() {
        if (typeof BlogAPI === 'undefined') return;
        var apiBase = BlogAPI;
        if ($('.visitors').length === 1) {
            var $visitor = $('.visitors:first');
            $.get(apiBase + '/count_click_add?id=' + $visitor.attr('id'), function (data) {
                $visitor.text(Number(data));
            });
        } else if ($('.visitors-index').length > 0) {
            $('.visitors-index').each(function () {
                var $elem = $(this);
                $.get(apiBase + '/count_click?id=' + $elem.attr('id'), function (data) {
                    $elem.text(Number(data));
                });
            });
        }
    }

    /** AI 摘要（post.html 内联脚本，pjax 后由 executeScripts 触发） */
    function reinitAISummary() {
        if (typeof ai_gen === 'function' && $('#ai-output').length) {
            try { ai_gen(); } catch (e) { /* ignore */ }
        }
    }

    /** 代码块复制按钮 */
    function reinitCopyButtons() {
        $('.copy').remove();
        $('div.highlight').each(function () {
            var $block = $(this);
            var $btn = $('<button>', { class: 'copy', type: 'button', text: '📋' });
            $block.append($btn);
            $btn.on('click', function () {
                var code = $btn.siblings('pre').find('code').text().trim();
                navigator.clipboard.writeText(code)
                    .then(function () { $btn.text('✅'); })
                    .catch(function () { $btn.text('❌'); })
                    .finally(function () { setTimeout(function () { $btn.text('📋'); }, 1500); });
            });
        });
    }

    /** Gitalk 评论（post 页面专属） */
    function reinitGitalk() {
        if ($(CONTAINER + ' #gitalk-container').length === 0) return;
        loadCSS('/assets/css/gitalk.css');

        function doInitGitalk() {
            if (typeof Gitalk === 'undefined') {
                loadScript('/assets/js/gitalk.min.js', doInitGitalk);
                return;
            }
            var pageId = $(CONTAINER + ' #gitalk-container').data('page-id') || window.location.pathname;
            try {
                new Gitalk(Object.assign({ id: pageId }, window.GitalkConfig))
                    .render('gitalk-container');
            } catch (e) {
                console.warn('[pjax] Gitalk init error:', e);
            }
        }
        $('#gitalk-container').empty();
        doInitGitalk();
    }

    /** 关键词高亮 */
    function reinitHighlight() {
        var keyword = new URLSearchParams(window.location.search).get('kw');
        if (!keyword) return;
        keyword = keyword.trim();
        if (!keyword) return;

        var escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var regex = new RegExp('(' + escaped + ')', 'gi');
        var escapeHTML = function (str) {
            return str.replace(/[&<>"']/g, function (t) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[t] || t;
            });
        };
        function walk(node) {
            $(node).contents().each(function () {
                if (this.nodeType === Node.TEXT_NODE) {
                    var $t = $(this);
                    var text = escapeHTML($t.text());
                    if (regex.test(text)) $t.replaceWith(text.replace(regex, '<mark>$1</mark>'));
                } else if (this.nodeType === Node.ELEMENT_NODE && !$(this).is('script, style, noscript, textarea')) {
                    walk(this);
                }
            });
        }
        $('section').each(function () { walk(this); });
    }

    /** Google Analytics 页面浏览事件 */
    function trackPageView() {
        if (typeof gtag === 'function') {
            gtag('config', window._gaId || '', { page_path: window.location.pathname });
        }
    }

    /** Live2D 重初始化 */
    var _live2dSelectors = ['.post-link', '#search-input'];
    var _live2dDelegateBound = false;

    function reinitLive2d() {
        if (!window._live2d) return;
        var pathname = window.location.pathname;

        // 更新"想问这篇文章"相关状态（仅真正的文章页显示）
        $('#post_id').val(pathname);
        if (isRealPostPage()) {
            $('.live_talk_input_name_body').show();
        } else {
            $('.live_talk_input_name_body').hide();
            $('#load_this').prop('checked', false);
        }

        // 音乐按钮：根据当前页面是否有 BGM 输入来显示/隐藏
        if (typeof window._live2d.initBGM === 'function') {
            window._live2d.initBGM();
        }

        // 事件委托绑定（只执行一次）
        if (!_live2dDelegateBound && typeof String.prototype.renderTip === 'function') {
            var selector = CONTAINER + ' ' + _live2dSelectors.join(', ' + CONTAINER + ' ');
            $(document).on('mouseover._live2d_pjax', selector, function (e) {
                var $el = $(e.currentTarget || e.target);
                if ($el.is('.post-link')) {
                    window._live2d.showMessage('要看看 ' + $el.text() + ' 么？', 3000);
                } else if ($el.is('#search-input')) {
                    window._live2d.showMessage('在找什么东西呢，需要帮忙吗？', 3000);
                }
            });
            $(document).on('mouseout._live2d_pjax', selector, function () {
                if (window._live2d.showHitokoto) window._live2d.showHitokoto();
            });
            _live2dDelegateBound = true;
        }

        // 欢迎语
        if (typeof window._live2d.showMessage === 'function') {
            window._live2d.showMessage(getWelcomeText(pathname), 6000);
        }
    }

    // ========== PJAX 导航 ==========

    /** PJAX 完成后的统一处理 */
    function doPjaxComplete() {
        $('body').removeClass('pjax-loading');
        // 清理可能残留的浮层（如推荐文章 tooltip，hover 后点击跳转时 mouseleave 来不及触发）
        $('.content-tooltip').hide();
        // go() 路径：脚本在 DOM 替换前提取到了 _pendingScripts，需在此执行
        // pjax 库路径：_pendingScripts 为空，pjax 库自行处理了脚本执行
        if (_pendingScripts.length > 0) {
            executeScripts(_pendingScripts);
            _pendingScripts = [];
        }
        onPjaxComplete();
    }

    /** 暴露给模板内 onclick/onchange 调用的导航函数 */
    window.go = function (url) {
        $('body').addClass('pjax-loading');
        $.ajax({
            url: url,
            beforeSend: function (xhr) {
                xhr.setRequestHeader('X-PJAX', 'true');
                xhr.setRequestHeader('X-PJAX-Container', CONTAINER);
            },
            success: function (html) {
                try {
                    var doc = (new DOMParser()).parseFromString(html, 'text/html');
                    var fragment = doc.querySelector(CONTAINER);
                    if (fragment) {
                        // 先提取脚本（jQuery html() 会移除并可能异步处理脚本）
                        _pendingScripts = [];
                        fragment.querySelectorAll('script').forEach(function (s) {
                            _pendingScripts.push({
                                src: s.src || null,
                                text: s.textContent
                            });
                            s.remove();
                        });
                        $(CONTAINER).html(fragment.innerHTML);
                        document.title = doc.title;
                        history.pushState({ url: url }, document.title, url);
                        doPjaxComplete();
                    } else {
                        window.location.href = url;
                    }
                } catch (e) {
                    console.warn('[go] parse error, fallback:', e);
                    window.location.href = url;
                }
            },
            error: function () { window.location.href = url; },
            timeout: PJAX_OPTS.timeout
        });
    };

    /** 暴露 getWelcomeText 供 message.js 首次加载时复用，避免欢迎语逻辑重复 */
    window._pjaxGetWelcomeText = getWelcomeText;

    // ========== 初始化 ==========

    /** 每次 pjax 完成后执行所有重初始化 */
    function onPjaxComplete() {
        reinitVisitors();
        reinitCopyButtons();
        reinitHighlight();
        reinitGitalk();
        reinitAISummary();
        reinitLive2d();
        trackPageView();
        window.scrollTo(0, 0);
    }

    $(document).ready(function () {
        // 排除列表：外链、锚点、静态资源、Live2D 目录
        var exclude = ':not([target="_blank"]):not([href^="http"]):not([href^="//"])' +
            ':not([href^="mailto"]):not([href^="#"])' +
            ':not([href$=".xml"]):not([href$=".json"]):not([href$=".tgz"]):not([href$=".zip"])' +
            ':not([href^="/Live2dHistoire"])';
        $(document).pjax('a' + exclude, PJAX_OPTS.container, PJAX_OPTS);

        $(document).on('pjax:send', function () {
            $('body').addClass('pjax-loading');
        });
        $(document).on('pjax:complete', doPjaxComplete);
        $(document).on('pjax:error', function (xhr, textStatus, error) {
            console.warn('[pjax] error, fallback:', error);
        });

        // 首次加载初始化
        reinitCopyButtons();
    });

})(jQuery);