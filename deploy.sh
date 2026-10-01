#!/bin/bash
mkdir Mabbs
curl -L -o Mabbs/README.md https://github.com/Mabbs/Mabbs/raw/main/README.md
bundle exec jekyll build -d public
python3 _tools/blogquine.py --src-dir blog --quine-dir blog public MayxBlog.7z
curl -L -O https://github.com/ip7z/7zip/releases/download/26.03/7z2603-linux-x64.tar.xz
tar xvf 7z2603-linux-x64.tar.xz
./7zzs a -mx9 -bd -bb0 MayxBlog-new.7z MayxBlog.7z
mv MayxBlog-new.7z public/MayxBlog.7z
