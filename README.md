# 1. mdbooks_html_scraper

run on html-builded mdbooks page, eg, [https://github.com/rust-kr/doc.rust-kr.org/](https://github.com/rust-kr/doc.rust-kr.org/)

## feature...?

- if href is broken, tries to fix it [like this](https://github.com/anemochore/mdbooks_html_scraper/issues/1).
- apply `addon_ unhyperlinks.js`(https://github.com/anemochore/oreillyDownloader/blob/main/addon_%20unhyperlinks.js) and then import to ms-word.

# 2. cho_md_fix

run on as a spa. open manually created md file(s) and fix common errors and then convert into one html (via [showdown](https://github.com/showdownjs/showdown)). run here: https://anemochore.github.io/mdbooks_html_scraper/cho_md_fix_index.html