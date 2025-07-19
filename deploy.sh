#!/bin/bash
mkdir Mabbs
curl -L -o Mabbs/README.md https://github.com/Mabbs/Mabbs/raw/main/README.md
bundle exec jekyll build -d public
tar czvf MayxBlog.tgz public/
mv MayxBlog.tgz public/
