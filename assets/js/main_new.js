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

$(function() {
    var $codeBlocks = $('div.highlight');

    $codeBlocks.each(function() {
        var $copyButton = $('<button>', {
            class: 'copy',
            type: 'button',
            text: '📋'
        });

        $(this).append($copyButton);

        $copyButton.on('click', function() {
            var code = $(this).siblings('pre').find('code').text().trim();
            var $button = $(this);
            
            navigator.clipboard.writeText(code)
                .then(function() {
                    $button.text('✅');
                })
                .catch(function(err) {
                    $button.text('❌');
                    console.error('复制失败:', err);
                })
                .finally(function() {
                    setTimeout(function() {
                        $button.text('📋');
                    }, 1500);
                });
        });
    });
});