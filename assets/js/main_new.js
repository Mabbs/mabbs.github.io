/**
 * 根据 URL ?kw= 参数高亮页面内匹配的关键词。
 * 提取为全局函数，供 pjax.js 在页面切换后复用，避免重复实现。
 */
function highlightKeyword() {
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
};

function initCopyButtons() {
    $('.copy').remove();
    $('div.highlight').each(function () {
        var $btn = $('<button>', { class: 'copy', type: 'button', text: '📋' });
        $(this).append($btn);
        $btn.on('click', function () {
            var code = $btn.siblings('pre').find('code').text().trim();
            navigator.clipboard.writeText(code)
                .then(function () { $btn.text('✅'); })
                .catch(function () { $btn.text('❌'); })
                .finally(function () { setTimeout(function () { $btn.text('📋'); }, 1500); });
        });
    });
}

$(function () {
    highlightKeyword();
    initCopyButtons();
});