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
    initCopyButtons();
});