/*!
 * blog-console.js — Mayx's Blog DevTools Console API
 */
(function (global) {
    'use strict';

    /* =====================================================================
     * 0. 常量与配置
     * ===================================================================== */

    var config = {
        /** list() 默认每页条数 */
        pageSize: 10,
        /** show() 单次最多渲染的行数，防止超长文章刷屏 */
        maxShowLines: 600,
        /** 摘要/预览截断长度 */
        previewLength: 120
    };

    /* =====================================================================
     * 1. 控制台样式（DevTools 用 %c + CSS）
     * ===================================================================== */

    var S = {
        reset: '',
        title: 'font-weight:bold;font-size:13px;color:#3fb950',
        sub: 'color:#8b949e',
        num: 'color:#d29922;font-weight:bold',
        date: 'color:#58a6ff',
        strong: 'font-weight:bold',
        link: 'color:#58a6ff;text-decoration:underline',
        ok: 'color:#3fb950;font-weight:bold',
        warn: 'color:#d29922',
        err: 'color:#f85149;font-weight:bold',
        dim: 'color:#8b949e',
        code: 'color:#e3b341;font-family:ui-monospace,Consolas,monospace;background:rgba(110,118,129,.18);padding:0 3px;border-radius:3px',
        quote: 'color:#8b949e;font-style:italic',
        hr: 'color:#6e7781',
        tag: 'color:#a371f7',
        h: [
            '',
            'font-weight:bold;font-size:16px;color:#f85149',
            'font-weight:bold;font-size:15px;color:#3fb950',
            'font-weight:bold;font-size:14px;color:#d29922',
            'font-weight:bold;font-size:13px;color:#58a6ff',
            'font-weight:bold;font-size:13px;color:#a371f7',
            'font-weight:bold;font-size:13px;color:#39c5cf'
        ]
    };

    /**
     * 分段样式打印器。收集 [文本, CSS] 片段，分批 flush 到 console.log，
     * 既能保证多行样式连续，又避免单条消息过长被浏览器截断。
     */
    function Printer(chunkSize) {
        this.chunk = chunkSize || 160;
        this.fmt = [];
        this.css = [];
        this.pending = 0;
    }
    /**
     * 追加一个带样式的片段（不换行）。
     * @param {string} text 文本内容
     * @param {string} [css] CSS 样式串，省略则使用默认样式
     */
    Printer.prototype.push = function (text, css) {
        // 转义 %，防止与 console 的格式化占位符冲突
        this.fmt.push('%c' + String(text).replace(/%/g, '%%'));
        this.css.push(css || '');
        this.pending++;
        return this;
    };
    /** 追加一行（自动换行），并在片段数超过阈值时 flush。 */
    Printer.prototype.line = function (text, css) {
        this.push((text === undefined ? '' : text) + '\n', css);
        if (this.pending >= this.chunk) this.flush();
        return this;
    };
    /** 结束当前行。 */
    Printer.prototype.br = function () {
        this.push('\n', '');
        return this;
    };
    /** 把已累积的片段输出到控制台。 */
    Printer.prototype.flush = function () {
        if (!this.fmt.length) return this;
        var msg = this.fmt.join('');
        // 去掉行尾多余换行，避免每次 flush 产生空行
        msg = msg.replace(/\n$/, '');
        console.log.apply(console, [msg].concat(this.css));
        this.fmt = [];
        this.css = [];
        this.pending = 0;
        return this;
    };

    /** 打印一条分隔标题横幅。 */
    function banner(text) {
        var p = new Printer();
        p.line('── ' + text + ' ' + repeat('─', Math.max(2, 46 - strWidth(text))), S.title);
        p.flush();
    }

    function repeat(ch, n) { return n > 0 ? new Array(n + 1).join(ch) : ''; }

    /** 粗略估算显示宽度（中日韩字符按 2 计）。 */
    function strWidth(s) {
        var w = 0;
        for (var i = 0; i < s.length; i++) {
            w += /[\u2E80-\uFFFF]/.test(s[i]) ? 2 : 1;
        }
        return w;
    }

    /** 打印错误并返回 null，统一失败出口。 */
    function fail(msg) {
        console.log('%c⚠️ ' + msg, S.err);
        return null;
    }

    /* =====================================================================
     * 2. 宿主环境依赖层
     * ===================================================================== */

    /**
     * GitHub Issues 访问用的 Basic 凭据。
     * @returns {{headers:object, owner:string, repo:string}}
     */
    function githubAuth() {
        var g = GitalkConfig;
        return {
            headers: { Authorization: 'Basic ' + btoa(g.clientID + ':' + g.clientSecret) },
            owner: g.owner,
            repo: g.repo
        };
    }

    /**
     * 读取搜索索引 search.json，复用 main.js 的 getSearchJSON（带 localStorage 缓存）。
     * @returns {Promise<Array>} search.json 原始数组
     */
    function loadSearchJSON() {
        return new Promise(function (resolve) {
            getSearchJSON(resolve);
        });
    }

    /**
     * 懒加载站点自带的 SimpleJekyllSearch。
     * 该库只在 /search.html 里被引入，其他页面需要时动态注入同一个文件，
     * 从而保证控制台搜索与页面搜索使用完全一致的匹配/排序逻辑。
     * @returns {Promise<Function>} SimpleJekyllSearch 工厂函数
     * @throws {Error} 脚本加载失败时 reject
     */
    function ensureSimpleJekyllSearch() {
        if (typeof global.SimpleJekyllSearch === 'function') {
            return Promise.resolve(global.SimpleJekyllSearch);
        }
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = '/assets/js/simple-jekyll-search.min.js';
            s.async = true;
            s.onload = function () {
                if (typeof global.SimpleJekyllSearch === 'function') resolve(global.SimpleJekyllSearch);
            };
            s.onerror = function () {
                reject(new Error('无法加载 SimpleJekyllSearch'));
            };
            document.head.appendChild(s);
        });
    }

    /* =====================================================================
     * 3. 通用请求工具
     * ===================================================================== */

    /**
     * 请求 JSON，失败返回 null（不抛异常，便于控制台链式使用）。
     * @param {string} url
     * @param {object} [options] fetch 选项
     * @returns {Promise<any|null>}
     */
    function fetchJSON(url, options) {
        return fetch(url, options || {})
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; });
    }

    /**
     * 请求纯文本，失败返回 null。
     * @param {string} url
     * @param {object} [options] fetch 选项
     * @returns {Promise<string|null>}
     */
    function fetchText(url, options) {
        return fetch(url, options || {})
            .then(function (r) { return r.ok ? r.text() : null; })
            .catch(function () { return null; });
    }

    /** 解码 HTML 实体（search.json 的 title 经过 Liquid escape 过滤器处理）。 */
    function unescapeHTML(str) {
        if (!str || str.indexOf('&') === -1) return str || '';
        var el = document.createElement('textarea');
        el.innerHTML = str;
        return el.value;
    }

    /* =====================================================================
     * 4. 数据层
     * ===================================================================== */

    var _articles = null;

    /**
     * 规范化 search.json 的一条记录。
     * @param {object} item search.json 原始项
     * @param {number} index 从 0 开始的下标
     * @returns {{num:number,title:string,url:string,date:string,category:string,tags:string[],content:string,excerpt:string,link:string}}
     */
    function normalize(item, index) {
        var content = item.content || '';
        var tags = (item.tags || '')
            .split(',')
            .map(function (t) { return t.trim(); })
            .filter(Boolean);
        return {
            num: index + 1,
            title: unescapeHTML(item.title || ''),
            url: item.url || '',
            date: item.date || '',
            category: item.category || '',
            tags: tags,
            content: content,
            excerpt: content.slice(0, config.previewLength) +
                (content.length > config.previewLength ? '……' : ''),
            link: item.url || ''
        };
    }

    /**
     * 取得全部文章（含缓存）。
     * 注意：search.json 由 Jekyll 生成时已排除 layout 为 encrypt 的加密文章，
     * 因此这里的序号 num 是「非加密文章」的序号。
     * @param {boolean} [force] 传 true 强制重新拉取
     * @returns {Promise<Array>} 规范化后的文章数组，最新的在前
     */
    function getArticles(force) {
        if (_articles && !force) return Promise.resolve(_articles);
        return loadSearchJSON().then(function (data) {
            _articles = (data || []).map(normalize);
            return _articles;
        });
    }

    /**
     * 把各种形式的标识解析为一篇文章。
     * @param {number|string} id 序号(1 起) / 文章 URL / 标题（支持模糊包含匹配）
     * @returns {Promise<object|null>} 命中的文章对象，未命中为 null
     */
    function resolve(id) {
        return getArticles().then(function (list) {
            if (!list || !list.length) return null;
            if (id === undefined || id === null || id === '') {
                // 无参时默认取当前页面对应的文章
                return matchByPath(list, global.location.pathname);
            }
            // 1) 纯数字序号
            var n = parseInt(id, 10);
            if (!isNaN(n) && String(n) === String(id).trim()) {
                return (n >= 1 && n <= list.length) ? list[n - 1] : null;
            }
            var s = String(id).trim();
            // 2) 精确 URL / 路径
            var byUrl = matchByPath(list, s);
            if (byUrl) return byUrl;
            // 3) 标题包含匹配（大小写不敏感）
            var low = s.toLowerCase();
            var hit = list.filter(function (a) {
                return a.title.toLowerCase().indexOf(low) !== -1;
            });
            return hit.length ? hit[0] : null;
        });
    }

    /** 按路径匹配文章（容忍 URL 编码差异与站点前缀）。 */
    function matchByPath(list, path) {
        if (!path) return null;
        var dec = path, p = path;
        try { dec = decodeURIComponent(p); } catch (e) { }
        for (var i = 0; i < list.length; i++) {
            var u = list[i].url, ud = u;
            try { ud = decodeURIComponent(u); } catch (e) { }
            if (u === p || ud === dec || u === dec || ud === p) return list[i];
        }
        return null;
    }

    /**
     * 由文章对象推导其原始 Markdown 文件的 raw 地址。
     * @param {object} article
     * @returns {string} raw.githubusercontent.com 上的 .md 地址
     */
    function rawUrlOf(article) {
        var dateDash = (article.date || '').replace(/\//g, '-');
        var last = (article.url || '').split('/').pop();
        try { last = decodeURIComponent(last); } catch (e) { }
        var slug = last.replace(/\.html$/, '');
        return 'https://raw.githubusercontent.com/Mabbs/mabbs.github.io/refs/heads/master/_posts/' + dateDash + '-' + slug + '.md';
    }

    /* =====================================================================
     * 5. Markdown → 控制台样式渲染
     * ===================================================================== */

    /**
     * 行内标记解析：`code`、**bold**、*italic*、~~del~~、[text](url)、![alt](url)
     * @param {Printer} p
     * @param {string} text
     * @param {string} baseCss 该行的基础样式
     */
    function inline(p, text, baseCss) {
        var re = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*\n]+\*|_[^_\n]+_)|(~~[^~]+~~)|(!?\[[^\]]*\]\([^)]*\))/g;
        var last = 0, m;
        while ((m = re.exec(text)) !== null) {
            if (m.index > last) p.push(text.slice(last, m.index), baseCss);
            var tok = m[0];
            if (m[1]) {
                p.push(tok.slice(1, -1), S.code);
            } else if (m[2]) {
                p.push(tok.slice(2, -2), baseCss + ';font-weight:bold');
            } else if (m[3]) {
                p.push(tok.slice(1, -1), baseCss + ';font-style:italic');
            } else if (m[4]) {
                p.push(tok.slice(2, -2), baseCss + ';text-decoration:line-through;opacity:.7');
            } else if (m[5]) {
                var mm = /^(!?)\[([^\]]*)\]\(([^)]*)\)$/.exec(tok);
                if (mm) {
                    var label = mm[2] || (mm[1] ? '图片' : '链接');
                    p.push((mm[1] ? '🖼 ' : '') + label, S.link);
                    if (mm[3]) p.push(' (' + mm[3] + ')', S.dim);
                } else {
                    p.push(tok, baseCss);
                }
            }
            last = m.index + tok.length;
        }
        if (last < text.length) p.push(text.slice(last), baseCss);
        p.push('\n', '');
    }

    /**
     * 渲染整篇 Markdown 到控制台。
     * @param {string} md Markdown 原文
     * @param {object} [opts]
     * @param {number} [opts.maxLines] 最大渲染行数
     * @param {boolean} [opts.frontMatter=true] 是否显示 YAML front matter
     */
    function renderMarkdown(md, opts) {
        opts = opts || {};
        var maxLines = opts.maxLines || config.maxShowLines;
        var showFM = opts.frontMatter !== false;

        var lines = md.split('\n');
        var p = new Printer();
        var inCode = false, inFM = false, rendered = 0;

        for (var i = 0; i < lines.length && rendered < maxLines; i++) {
            var raw = lines[i];
            var t = raw.replace(/^\s+/, '');

            // YAML front matter
            if (i === 0 && /^---\s*$/.test(t)) { inFM = true; if (showFM) p.line(raw, S.dim); rendered++; continue; }
            if (inFM) {
                if (/^---\s*$/.test(t)) inFM = false;
                if (showFM) { p.line(raw, S.dim); rendered++; }
                continue;
            }

            // 围栏代码块
            if (/^```/.test(t) || /^~~~/.test(t)) {
                inCode = !inCode;
                p.line(raw, S.dim);
                rendered++;
                continue;
            }
            if (inCode) { p.line(raw, S.code); rendered++; continue; }

            if (t === '') { p.line(''); rendered++; continue; }

            // 标题
            var h = t.match(/^(#{1,6})\s+/);
            if (h) {
                p.line(raw, S.h[h[1].length] || S.h[6]);
                rendered++;
                continue;
            }

            // 水平分割线
            var hr = t.replace(/\s/g, '');
            if (/^-{3,}$/.test(hr) || /^\*{3,}$/.test(hr) || /^_{3,}$/.test(hr)) {
                p.line(raw, S.hr); rendered++; continue;
            }

            // 引用
            if (/^>/.test(t)) { p.line(raw, S.quote); rendered++; continue; }

            // 无序列表
            if (/^[-*+]\s/.test(t)) {
                var ind = raw.match(/^(\s*)/)[1];
                p.push(ind + t[0] + ' ', S.ok);
                inline(p, t.replace(/^[-*+]\s+/, ''), '');
                rendered++;
                if (p.pending >= p.chunk) p.flush();
                continue;
            }

            // 有序列表
            if (/^\d+\.\s/.test(t)) {
                var ind2 = raw.match(/^(\s*)/)[1];
                var mk = t.match(/^\d+\./)[0];
                p.push(ind2 + mk + ' ', S.num);
                inline(p, t.replace(/^\d+\.\s+/, ''), '');
                rendered++;
                if (p.pending >= p.chunk) p.flush();
                continue;
            }

            inline(p, raw, '');
            rendered++;
            if (p.pending >= p.chunk) p.flush();
        }
        p.flush();

        if (lines.length > rendered) {
            console.log('%c… 已省略 ' + (lines.length - rendered) + ' 行', S.warn);
        }
    }

    /* =====================================================================
     * 6. 对外 API
     * ===================================================================== */

    var Blog = {};

    /** 运行期配置对象，可直接修改 @type {object} */
    Blog.config = config;

    // ---------------------------------------------------------------- 数据

    /**
     * 按序号 / URL / 标题定位一篇文章并打印其元信息。
     * @param {number|string} [id] 序号(从 1 开始) / 文章 URL / 标题关键字；
     *                             省略时取当前页面对应的文章
     * @returns {Promise<object|null>} 文章对象，未找到返回 null
     * @example await Blog.get(1); await Blog.get('/2015/02/23/diary.html'); await Blog.get('日记')
     */
    Blog.get = function (id) {
        return resolve(id).then(function (a) {
            if (!a) return fail('未找到文章: ' + id);
            banner('文章 #' + a.num);
            var p = new Printer();
            p.line(a.title, S.title);
            p.push('日期  ', S.dim).line(a.date, S.date);
            p.push('链接  ', S.dim).line(a.link, S.link);
            if (a.category) p.push('分类  ', S.dim).line(a.category, S.tag);
            if (a.tags.length) p.push('标签  ', S.dim).line(a.tags.join('  #'), S.tag);
            p.push('字数  ', S.dim).line(String(a.content.length), S.num);
            p.line('');
            p.line(a.excerpt, S.sub);
            p.flush();
            return a;
        });
    };

    /**
     * 分页列出文章（控制台以表格呈现）。
     * @param {number} [page=1] 页码，从 1 开始
     * @param {number} [pageSize] 每页条数，默认取 Blog.config.pageSize（10）
     * @returns {Promise<Array|null>} 当前页的文章数组
     * @example await Blog.list(2)
     */
    Blog.list = function (page, pageSize) {
        page = parseInt(page, 10) || 1;
        pageSize = parseInt(pageSize, 10) || config.pageSize;
        if (page < 1) return Promise.resolve(fail('页码必须是正整数'));

        return getArticles().then(function (list) {
            if (!list) return fail('无法获取文章列表');
            var total = list.length;
            var totalPages = Math.ceil(total / pageSize);
            var start = (page - 1) * pageSize;
            if (start >= total) return fail('第 ' + page + ' 页没有文章（共 ' + totalPages + ' 页）');

            var slice = list.slice(start, Math.min(start + pageSize, total));
            banner('博客文章列表 · 第 ' + page + '/' + totalPages + ' 页');
            var obj = {};
            slice.forEach(function (a) {
                obj[a.num] = { '日期': a.date, '标题': a.title };
            });

            console.table(obj);
            console.log('%c共 ' + total + ' 篇 · Blog.show(id) 读正文 · Blog.open(id) 跳转 · Blog.comment(id) 看评论', S.sub);
            return slice;
        });
    };

    /**
     * 搜索文章。复用站点自带的 SimpleJekyllSearch，
     * 与 /search.html 使用完全一致的匹配与排序规则。
     * @param {string}  keyword 关键词
     * @param {object}  [opts]
     * @param {number}  [opts.limit=10] 最大结果数
     * @param {boolean} [opts.fuzzy=false] 是否启用模糊匹配
     * @returns {Promise<Array|null>} 命中的文章数组
     * @example await Blog.search('Jekyll')
     */
    Blog.search = function (keyword, opts) {
        opts = opts || {};
        var limit = opts.limit || 10;
        if (!keyword) return Promise.resolve(fail('请提供关键词，例如 Blog.search("Jekyll")'));

        return getArticles().then(function (list) {
            if (!list) return fail('无法获取文章列表');
            return ensureSimpleJekyllSearch().then(function (SJS) {
                var results = searchWithSJS(SJS, list, keyword, limit, !!opts.fuzzy);
                render(results);
                return results;
            });
        });

        function render(results) {
            banner('搜索「' + keyword + '」· ' + results.length + ' 条结果');
            if (!results.length) {
                console.log('%c没有匹配的文章。', S.warn);
                return;
            }
            var obj = {};
            results.forEach(function (a) {
                obj[a.num] = { '日期': a.date, '标题': a.title, '摘要': a.excerpt.slice(0, 40) };
            });

            console.table(obj);
            console.log('%c用 Blog.show(' + results[0].num + ') 查看第一条结果。', S.sub);
        }
    };

    /**
     * 借助 SimpleJekyllSearch 在游离 DOM 节点上取得搜索结果。
     * 结果模板只输出 url，再用 url 反查完整文章对象。
     * @param {Function} SJS SimpleJekyllSearch 工厂函数
     * @param {Array} list 全部文章
     * @param {string} keyword 关键词
     * @param {number} limit 最大结果数
     * @param {boolean} fuzzy 是否模糊匹配
     * @returns {Array} 命中的文章数组
     */
    function searchWithSJS(SJS, list, keyword, limit, fuzzy) {
        // SimpleJekyllSearch 会对每个字段调用 String.prototype.trim，
        // 因此必须喂给它与 search.json 一致的「全字符串」结构，
        // 而不是规范化后的对象（num 为数字、tags 为数组会直接报错）。
        var flat = list.map(function (a) {
            return {
                title: a.title,
                category: a.category,
                tags: a.tags.join(' '),
                url: a.url,
                date: a.date,
                content: a.content
            };
        });

        var box = document.createElement('div');
        SJS({
            searchInput: document.createElement('input'),
            resultsContainer: box,
            json: flat,
            searchResultTemplate: '<i data-u="{url}"></i>',
            noResultsText: '',
            limit: limit,
            fuzzy: fuzzy
        }).search(keyword);

        var byUrl = {};
        list.forEach(function (a) { byUrl[a.url] = a; });
        var out = [];
        Array.prototype.forEach.call(box.querySelectorAll('i[data-u]'), function (el) {
            var a = byUrl[el.getAttribute('data-u')];
            if (a) out.push(a);
        });
        return out;
    }

    /**
     * 用正则表达式检索全部文章正文，并打印命中的上下文片段。
     * （search.json 已内联全文，因此无需额外网络请求）
     * @param {string|RegExp} pattern 正则或字符串
     * @param {object} [opts]
     * @param {number} [opts.context=40] 命中处前后保留的字符数
     * @param {number} [opts.limit=20]   最多显示的命中条目数
     * @returns {Promise<Array<{article:object,matches:string[]}>>}
     * @example await Blog.grep(/Cloudflare\s*Workers?/i)
     */
    Blog.grep = function (pattern, opts) {
        if (!pattern) return Promise.resolve(fail('请提供关键词，例如 Blog.grep("Jekyll")'));
        opts = opts || {};
        var ctx = opts.context || 40;
        var limit = opts.limit || 20;
        var re;
        try {
            re = pattern instanceof RegExp
                ? new RegExp(pattern.source, pattern.flags.indexOf('g') === -1 ? pattern.flags + 'g' : pattern.flags)
                : new RegExp(String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        } catch (e) {
            return Promise.resolve(fail('无效的正则表达式: ' + e.message));
        }

        return getArticles().then(function (list) {
            if (!list) return fail('无法获取文章列表');
            var out = [];
            for (var i = 0; i < list.length && out.length < limit; i++) {
                var a = list[i], m, hits = [];
                re.lastIndex = 0;
                while ((m = re.exec(a.content)) !== null && hits.length < 3) {
                    var s = Math.max(0, m.index - ctx);
                    var e = Math.min(a.content.length, m.index + m[0].length + ctx);
                    hits.push((s > 0 ? '…' : '') + a.content.slice(s, e) + (e < a.content.length ? '…' : ''));
                    if (m[0] === '') re.lastIndex++;
                }
                if (hits.length) out.push({ article: a, matches: hits });
            }

            banner('grep ' + re + ' · ' + out.length + ' 篇命中');
            if (!out.length) { console.log('%c无命中。', S.warn); return out; }
            var p = new Printer();
            out.forEach(function (r) {
                p.push('#' + r.article.num + ' ', S.num).line(r.article.title, S.strong);
                r.matches.forEach(function (t) { p.line('    ' + t, S.sub); });
            });
            p.flush();
            return out;
        });
    };

    // ---------------------------------------------------------------- 内容


    /**
     * 拉取文章的原始 Markdown 并在控制台做语法着色渲染。
     * @param {number|string} id 序号 / URL / 标题
     * @param {object}  [opts]
     * @param {number}  [opts.maxLines] 最多渲染行数，默认 Blog.config.maxShowLines（600）
     * @param {boolean} [opts.frontMatter=true] 是否显示 YAML front matter
     * @param {boolean} [opts.raw=false] 为 true 时跳过渲染，直接返回原文
     * @returns {Promise<string|null>} Markdown 原文
     * @example await Blog.show(1); await Blog.show(1, { raw: true })
     */
    Blog.show = function (id, opts) {
        opts = opts || {};
        return resolve(id).then(function (a) {
            if (!a) return fail('未找到文章: ' + id);
            var url = rawUrlOf(a);
            return fetchText(url).then(function (md) {
                if (md === null) return fail('无法获取原始 Markdown：' + url);
                if (opts.raw) return md;
                banner(a.title);
                var p = new Printer();
                p.push('日期 ', S.dim).push(a.date, S.date)
                    .push('   来源 ', S.dim).line(url, S.link);
                p.line('');
                p.flush();
                renderMarkdown(md, opts);
            });
        });
    };

    /**
     * 获取文章的 Gitalk 评论（走 GitHub Issues API）。
     * @param {number|string} id 序号 / URL / 标题
     * @returns {Promise<Array|null>} 评论数组 [{author, date, body}]
     * @example await Blog.comment(1)
     */
    Blog.comment = function (id) {
        return resolve(id).then(function (a) {
            if (!a) return fail('未找到文章: ' + id);
            var auth = githubAuth();
            var label = a.url.replace(/\.html$/, '');
            var api = 'https://api.github.com/repos/' + auth.owner + '/' + auth.repo +
                '/issues?labels=' + encodeURIComponent('Gitalk,' + label);

            return fetchJSON(api, { headers: auth.headers }).then(function (issues) {
                if (!issues || !issues.length) {
                    console.log('%c📭 文章「' + a.title + '」暂无评论（未找到对应 Issue）', S.warn);
                    return [];
                }
                return fetchJSON(issues[0].comments_url, { headers: auth.headers }).then(function (cs) {
                    if (!cs || !cs.length) {
                        console.log('%c📭 文章「' + a.title + '」暂无评论', S.warn);
                        return [];
                    }
                    var out = cs.map(function (c) {
                        return {
                            author: (c.user && c.user.login) || 'unknown',
                            date: c.created_at || '',
                            body: c.body || ''
                        };
                    });
                    banner('评论 · ' + a.title + ' · ' + out.length + ' 条');
                    var p = new Printer();
                    out.forEach(function (c, i) {
                        p.push((i + 1) + '. ', S.num)
                            .push(c.author, S.ok)
                            .line('  ' + c.date, S.dim);
                        c.body.split('\n').forEach(function (l) { p.line('   ' + l, ''); });
                        p.line('');
                    });
                    p.flush();
                    console.log('%c原 Issue: ' + issues[0].html_url, S.sub);
                    return out;
                });
            });
        });
    };

    // ---------------------------------------------------------------- 导航

    /**
     * 打开一篇文章。默认复用 pjax.js 的 window.go() 做站内无刷新跳转。
     * @param {number|string} id 序号 / URL / 标题
     * @param {object}  [opts]
     * @param {boolean} [opts.newTab=false] 为 true 时改用新标签页打开
     * @returns {Promise<object|null>} 被打开的文章对象
     * @example await Blog.open(1); await Blog.open(1, { newTab: true })
     */
    Blog.open = function (id, opts) {
        opts = opts || {};
        return resolve(id).then(function (a) {
            if (!a) return fail('未找到文章: ' + id);
            if (opts.newTab) {
                var w = global.open(a.link, '_blank', 'noopener,noreferrer');
                if (!w) return fail('浏览器阻止了弹出窗口，请允许后重试');
                console.log('%c✅ 已在新标签页打开：%c' + a.title, S.ok, S.strong);
            } else {
                go(a.url);
                console.log('%c✅ 正在跳转：%c' + a.title, S.ok, S.strong);
            }
            console.log('%c' + a.link, S.link);
            return a;
        });
    };

    /**
     * 随机打开一篇文章。等价于首页 "Random" 链接的逻辑
     * （getSearchJSON + go 的组合），此处复用同一对函数。
     * @param {object}  [opts]
     * @param {boolean} [opts.open=true] 为 false 时只返回文章不跳转
     * @returns {Promise<object|null>} 随机选中的文章
     * @example await Blog.random({ open: false })
     */
    Blog.random = function (opts) {
        opts = opts || {};
        return getArticles().then(function (list) {
            if (!list || !list.length) return fail('无法获取文章列表');
            var a = list[Math.floor(Math.random() * list.length)];
            console.log('%c🎲 随机文章 #' + a.num + '：%c' + a.title, S.ok, S.strong);
            console.log('%c' + a.link, S.link);
            if (opts.open !== false) go(a.url);
            return a;
        });
    };

    /**
     * 返回当前页面对应的文章信息（若当前不是文章页则返回 null）。
     * @returns {Promise<object|null>}
     * @example await Blog.current()
     */
    Blog.current = function () {
        return getArticles().then(function (list) {
            var a = list ? matchByPath(list, global.location.pathname) : null;
            if (!a) {
                console.log('%c当前页面不是文章页：' + global.location.pathname, S.warn);
                return null;
            }
            return Blog.get(a.num);
        });
    };

    // ---------------------------------------------------------------- 其他

    /**
     * 显示站点作者信息（读取 /humans.txt）。。
     * @returns {Promise<string|null>} humans.txt 全文
     * @example await Blog.about()
     */
    Blog.about = function () {
        return fetchText('/humans.txt').then(function (t) {
            if (t === null) return fail('无法获取 humans.txt');
            banner('关于本站');
            console.log('%c' + t, 'line-height:1.5');
            return t;
        });
    };

    /**
     * 打印全部可用命令的帮助信息。
     * @returns {void}
     * @example Blog.help()
     */
    Blog.help = function () {
        var groups = [
            ['数据查询', [
                ['Blog.list(page, size)', '分页列出文章，表格输出，页码从 1 开始'],
                ['Blog.get(id)', '查看单篇文章元信息，id 支持 序号/URL/标题'],
                ['Blog.search(kw, opts)', '搜索文章'],
                ['Blog.grep(re, opts)', '用正则检索全文并显示上下文片段']
            ]],
            ['内容读取', [
                ['Blog.show(id, opts)', '阅读文章正文'],
                ['Blog.comment(id)', '获取 Gitalk 评论（GitHub Issues）'],
                ['Blog.current()', '当前页面对应的文章信息']
            ]],
            ['导航跳转', [
                ['Blog.open(id, {newTab})', '打开文章'],
                ['Blog.random({open})', '随机一篇文章']
            ]],
            ['其他', [
                ['Blog.about()', '站点与作者信息']
            ]]
        ];

        var p = new Printer();
        p.line('');
        p.line('  Mayx 博客控制台 API', 'font-weight:bold;font-size:15px;color:#3fb950');
        p.line('');
        groups.forEach(function (g) {
            p.line('▍' + g[0], S.h[3]);
            g[1].forEach(function (row) {
                var pad = repeat(' ', Math.max(1, 26 - strWidth(row[0])));
                p.push('   ' + row[0], S.code).line(pad + row[1], S.sub);
            });
            p.line('');
        });
        p.line('示例：', S.strong);
        p.line('   await Blog.list(1)                 列出第 1 页文章', S.sub);
        p.line('   await Blog.search("Jekyll")        搜索关键词', S.sub);
        p.line('   await Blog.show(1)                 阅读第 1 篇文章', S.sub);
        p.line('   await Blog.open(1)                 跳转到第 1 篇文章', S.sub);
        p.line('');
        p.flush();
    };

    /* =====================================================================
     * 7. 挂载
     * ===================================================================== */

    global.Blog = Blog;

    console.log(
        '%c Mayx Blog %c 控制台 API 已就绪，输入 %cBlog.help()%c 查看全部命令 ',
        'background:#3fb950;color:#fff;font-weight:bold;border-radius:3px 0 0 3px;padding:2px 6px',
        'background:rgba(110,118,129,.2);padding:2px 6px',
        'font-family:ui-monospace,Consolas,monospace;color:#e3b341;background:rgba(110,118,129,.2)',
        'background:rgba(110,118,129,.2);padding:2px 6px;border-radius:0 3px 3px 0'
    );

})(typeof window !== 'undefined' ? window : this);
