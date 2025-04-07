/**
 * RSS/Atom Feed Preview for Links Table
 */

(function() {
    const existingPreviews = document.querySelectorAll('#rss-feed-preview');
    existingPreviews.forEach(el => el.remove());
  
    const CORS_PROXY = 'https://cors-anywhere.mayx.eu.org/?';
  
    const createPreviewElement = () => {
      const existingPreview = document.getElementById('rss-feed-preview');
      if (existingPreview) {
        return existingPreview;
      }
  
      const previewEl = document.createElement('div');
      previewEl.id = 'rss-feed-preview';
      previewEl.style.cssText = `
        position: fixed;
        display: none;
        width: 300px;
        max-height: 400px;
        overflow-y: auto;
        background-color: white;
        border: 1px solid #ccc;
        border-radius: 5px;
        padding: 10px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        font-size: 14px;
        line-height: 1.4;
      `;
      document.body.appendChild(previewEl);
      return previewEl;
    };
  
    const parseRSS = (xmlText) => {
      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlText, 'text/xml');
  
      const rssItems = xml.querySelectorAll('item');
      if (rssItems.length > 0) {
        return Array.from(rssItems).slice(0, 5).map(item => {
          return {
            title: item.querySelector('title')?.textContent || 'No title',
            date: item.querySelector('pubDate')?.textContent || 'No date',
          };
        });
      }
  
      const atomItems = xml.querySelectorAll('entry');
      if (atomItems.length > 0) {
        return Array.from(atomItems).slice(0, 5).map(item => {
          return {
            title: item.querySelector('title')?.textContent || 'No title',
            date: item.querySelector('updated')?.textContent || 'No date',
          };
        });
      }
  
      return null;
    };
  
    const checkFeed = async (url) => {
      try {
        const response = await fetch(CORS_PROXY + url);
        if (!response.ok) {
          return null;
        }
  
        const text = await response.text();
        return parseRSS(text);
      } catch (error) {
        return null;
      }
    };
  
    const findFeedUrl = async (siteUrl, linkElement) => {
      if (linkElement && linkElement.hasAttribute('data-feed')) {
        const dataFeedUrl = linkElement.getAttribute('data-feed');
        if (dataFeedUrl) {
          const feedItems = await checkFeed(dataFeedUrl);
          if (feedItems) {
            return { url: dataFeedUrl, items: feedItems };
          }
        }
      }
  
      return null;
    };
  
    const renderFeedItems = (previewEl, items, siteName) => {
      if (!items || items.length === 0) {
        previewEl.innerHTML = '<p>No feed items found.</p>';
        return;
      }
  
      let html = `<h3>Latest from ${siteName}</h3><ul style="list-style: none; padding: 0; margin: 0;">`;
  
      items.forEach(item => {
        html += `
          <li style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
            <div style="color: #24292e; font-weight: bold;">
              ${item.title}
            </div>
            <div style="color: #586069; font-size: 12px; margin: 3px 0;">
              ${new Date(item.date).toLocaleDateString()}
            </div>
          </li>
        `;
      });
  
      html += '</ul>';
      previewEl.innerHTML = html;
    };
  
    const positionPreview = (previewEl, event) => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
  
      let left = event.clientX + 20;
      let top = event.clientY + 20;
  
      const rect = previewEl.getBoundingClientRect();
  
      if (left + rect.width > viewportWidth) {
        left = event.clientX - rect.width - 20;
      }
  
      if (top + rect.height > viewportHeight) {
        top = event.clientY - rect.height - 20;
      }
  
      left = Math.max(10, left);
      top = Math.max(10, top);
  
      previewEl.style.left = `${left}px`;
      previewEl.style.top = `${top}px`;
    };
  
    const initFeedPreview = () => {
      const previewEl = createPreviewElement();
  
      const tableLinks = document.querySelectorAll('main table tbody tr td a');
  
      const feedCache = {};
  
      let currentLink = null;
      let loadingTimeout = null;
  
      tableLinks.forEach(link => {
        link.addEventListener('mouseenter', async (event) => {
          currentLink = link;
          const url = link.getAttribute('href');
          const siteName = link.textContent;
  
          previewEl.innerHTML = '<p>Checking for RSS/Atom feed...</p>';
          previewEl.style.display = 'block';
          positionPreview(previewEl, event);
  
          if (loadingTimeout) {
            clearTimeout(loadingTimeout);
          }
  
          loadingTimeout = setTimeout(async () => {
            if (feedCache[url]) {
              renderFeedItems(previewEl, feedCache[url].items, siteName);
              positionPreview(previewEl, event); // Reposition after content is loaded
              return;
            }
  
            const feedData = await findFeedUrl(url, link);
  
            if (currentLink === link) {
              if (feedData) {
                feedCache[url] = feedData;
                renderFeedItems(previewEl, feedData.items, siteName);
                positionPreview(previewEl, event); // Reposition after content is loaded
              } else {
                previewEl.style.display = 'none';
              }
            }
          }, 300);
        });
  
        link.addEventListener('mousemove', (event) => {
          if (previewEl.style.display === 'block') {
            window.requestAnimationFrame(() => {
              positionPreview(previewEl, event);
            });
          }
        });
  
        link.addEventListener('mouseleave', () => {
          if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
          }
  
          currentLink = null;
          previewEl.style.display = 'none';
        });
      });
  
      document.addEventListener('click', (event) => {
        if (!previewEl.contains(event.target)) {
          previewEl.style.display = 'none';
        }
      });
    };
  
    if (!window.rssFeedPreviewInitialized) {
      window.rssFeedPreviewInitialized = true;
  
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFeedPreview);
      } else {
        initFeedPreview();
      }
    }
  })();
  