#!/bin/bash
wget https://github.com/Mabbs/Mabbs/raw/main/README.md
mkdir Mabbs
echo "---
layout: default
---" > Mabbs/index.md
cat README.md >> Mabbs/index.md
rm -rf README.md
rm -rf .git/
bundle exec jekyll build -d public
rm -rf .jekyll-cache/
tar czvf ../MayxBlog.tgz .
mv ../MayxBlog.tgz public/
