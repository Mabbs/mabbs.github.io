#!/bin/bash
wget -O Mabbs.md https://github.com/Mabbs/Mabbs/raw/main/README.md
mkdir Mabbs
echo "---
layout: default
---" > Mabbs/index.md
cat Mabbs.md >> Mabbs/index.md
rm -rf Mabbs.md
bundle exec jekyll build -d public
tar czvf MayxBlog.tgz public/
mv MayxBlog.tgz public/
