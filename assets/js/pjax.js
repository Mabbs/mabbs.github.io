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
        if ($(CONTAINER + ' #gitalk-container').length > 0) {
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
        $('.content-tooltip').remove();
        onPjaxComplete();
    }

    /** 暴露给模板内 onclick/onchange 调用的导航函数 */
    window.go = function (url) {
        $.pjax({ url: url, ...PJAX_OPTS });
    };

    // ========== 初始化 ==========

    /** 每次 pjax 完成后执行所有重初始化 */
    function onPjaxComplete() {
        reinitVisitors();
        reinitCopyButtons();
        reinitHighlight();
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
        $(document).on('submit', 'form#search-input-all', function (e) {
            $.pjax.submit(e, PJAX_OPTS.container, PJAX_OPTS);
        });
        $(document).on('pjax:send', function () {
            $('body').addClass('pjax-loading');
        });
        $(document).on('pjax:complete', doPjaxComplete);
        $(document).on('pjax:error', function (xhr, textStatus, error) {
            console.warn('[pjax] error, fallback:', error);
        });
        $(document).on('pjax:end', function (event, xhr, options) {
            var $container = $(options.container || PJAX_OPTS.container);

            $container.find('script[type="module"]').each(function () {
                var oldScript = this;
                var newScript = document.createElement('script');
                newScript.type = 'module';

                // 如果是外链脚本 (<script src="..."></script>)
                if (oldScript.src) {
                    newScript.src = oldScript.src;
                } else {
                    // 如果是行内脚本 (<script>...code...</script>)
                    newScript.textContent = oldScript.textContent;
                }
                // 插入到 body 中触发浏览器执行
                document.body.appendChild(newScript);

                // 运行完后建议移除，防止 DOM 变得混乱（不影响模块执行）
                newScript.remove();
            });
        });
        // 首次加载初始化
        reinitCopyButtons();
    });

})(jQuery);