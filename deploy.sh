#!/bin/bash
mkdir Mabbs
curl -L -o Mabbs/README.md https://github.com/Mabbs/Mabbs/raw/main/README.md
bundle exec jekyll build -d public
python3 _tools/blogquine.py --src-dir blog --quine-dir blog public MayxBlog.7z
mv MayxBlog.7z public/
