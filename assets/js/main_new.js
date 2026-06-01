function highlightKeyword() {
    var match = location.search.match(/[?&]kw=([^&]+)/);
    var kw = match ? $.trim(decodeURIComponent(match[1].replace(/\+/g, ' '))) : '';
    if (!kw) return;

    var reg = new RegExp('(' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    var escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    $('section, section *').not('script, style, textarea').contents().filter(function() {
        return this.nodeType === 3; 
    }).each(function() {
        var escapedText = this.nodeValue.replace(/[&<>"']/g, function(m) { return escapeMap[m]; });
        var highlighted = escapedText.replace(reg, '<mark>$1</mark>');
        if (escapedText !== highlighted) {
            $(this).replaceWith(highlighted);
        }
    });
}

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