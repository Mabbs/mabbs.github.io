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

$(function () {
    var codeBlocks = document.querySelectorAll('div.highlight');

    codeBlocks.forEach(function (codeBlock) {
        var copyButton = document.createElement('button');
        copyButton.className = 'copy';
        copyButton.type = 'button';
        copyButton.innerText = '📋';

        codeBlock.append(copyButton);

        copyButton.addEventListener('click', function () {
            var code = codeBlock.querySelector('pre code').innerText.trim();
            window.navigator.clipboard.writeText(code)
                .then(() => {
                    copyButton.innerText = '✅';
                })
                .catch(err => {
                    copyButton.innerText = '❌';
                    console.error('Failed to copy:', err);
                });

            setTimeout(function () {
                copyButton.innerText = '📋';
            }, 1500);
        });
    });
});