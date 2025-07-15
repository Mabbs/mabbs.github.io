/**
 * RSS/Atom Feed Preview for Links Table
 */

(function () {
  if (window.rssFeedPreviewInitialized)
    return;
  window.rssFeedPreviewInitialized = true;

  var CORS_PROXY = 'https://cors-anywhere.mayx.eu.org/?';

  var $previewEl = $('<div>', {
    id: 'rss-feed-preview'
  }).css({
    position: 'fixed',
    display: 'none',
    width: '300px',
    maxHeight: '400px',
    overflowY: 'auto',
    backgroundColor: 'white',
    border: '1px solid #ccc',
    borderRadius: '5px',
    padding: '10px',
    fontSize: '14px',
    lineHeight: '1.4',
    zIndex: 1000,
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  });

  $('body').append($previewEl);

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c];
    });
  }

  function parseRSS(xmlText) {
    var xml;
    try {
      xml = $.parseXML(xmlText);
    } catch (e) {
      return [];
    }

    var $xml = $(xml);
    var $items = $xml.find('item');
    if (!$items.length)
      $items = $xml.find('entry');

    var result = [];
    $items.slice(0, 5).each(function () {
      var $el = $(this);
      result.push({
        title: $el.find('title').text() || 'No title',
        date: $el.find('pubDate, updated').text() || 'No date'
      });
    });

    return result;
  }

  function checkFeed(url, callback) {
    $.ajax({
      url: CORS_PROXY + url,
      type: 'GET',
      dataType: 'text',
      success: function (data) {
        var items = parseRSS(data);
        callback(items);
      },
      error: function () {
        callback(null);
      }
    });
  }

  function renderFeedItems(items, siteName) {
    if (!items || !items.length) {
      $previewEl.html('<p>No feed items found.</p>');
      return;
    }

    var html = '<h3>Latest from ' + escapeHTML(siteName) + '</h3><ul style="list-style:none; padding:0; margin:0;">';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var dateStr = new Date(item.date).toLocaleDateString();
      html += '<li style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #eee;">' +
        '<div style="color:#24292e; font-weight:bold;">' + escapeHTML(item.title) + '</div>' +
        '<div style="color:#586069; font-size:12px; margin:3px 0;">' + escapeHTML(dateStr) + '</div>' +
        '</li>';
    }
    html += '</ul>';
    $previewEl.html(html);
  }

  function positionPreview(e) {
    e = e || window.event;

    var x = e.clientX;
    var y = e.clientY;

    var offsetWidth = $previewEl.outerWidth();
    var offsetHeight = $previewEl.outerHeight();

    var left = x + 20;
    var top = y + 20;

    if (left + offsetWidth > $(window).width()) {
      left = x - offsetWidth - 20;
    }
    if (top + offsetHeight > $(window).height()) {
      top = y - offsetHeight - 20;
    }

    $previewEl.css({
      left: Math.max(10, left),
      top: Math.max(10, top)
    });
  }


  function init() {
    var cache = {};
    var currentLink = null;
    var timeout = null;

    $('main table tbody tr td a').each(function () {
      var $link = $(this);

      $link.on('mouseenter', function (e) {
        currentLink = this;
        var siteName = $link.text();
        var url = $link.attr('data-feed');
        if (!url)
          return;

        $previewEl.html('<p>Checking for RSS/Atom feed...</p>').show();
        positionPreview(e);

        if (timeout)
          clearTimeout(timeout);
        timeout = setTimeout(function () {
          if (cache[url]) {
            renderFeedItems(cache[url], siteName);
            positionPreview(e);
            return;
          }

          if (url) {
            checkFeed(url, function (items) {
              if (currentLink === $link[0] && items) {
                cache[url] = items;
                renderFeedItems(items, siteName);
                positionPreview(e);
              } else {
                $previewEl.hide();
              }
            });
          } else {
            $previewEl.hide();
          }
        }, 300);
      });

      $link.on('mousemove', function (e) {
        if ($previewEl.is(':visible'))
          positionPreview(e);
      });

      $link.on('mouseleave', function () {
        clearTimeout(timeout);
        timeout = null;
        currentLink = null;
        $previewEl.hide();
      });
    });

    $(document).on('click', function (e) {
      if (!$(e.target).closest('#rss-feed-preview').length) {
        $previewEl.hide();
      }
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    $(document).ready(init);
  }
})();
