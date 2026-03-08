---
layout: default
title: Archives
---

# Archives

---

{% assign posts_by_year = site.posts | group_by_exp: "post", "post.date | date: '%Y'" %}

{% for year in posts_by_year %}

## {{ year.name }} (共 {{ year.items | size }} 篇)

{% for post in year.items %}
- {{ post.date | date: "%Y/%m/%d" }} - [{{ post.title }}{% if post.layout == "encrypt" %} [加密]{% endif %}]({{ post.url }})
{% endfor %}

{% endfor %}