(async () => {
  //run on, eg, https://github.com/rust-kr/doc.rust-kr.org/

  const sidebarOl = document.querySelector('nav#sidebar ol');
  const as = [...sidebarOl.querySelectorAll('li>a')];
  const [filenames, titles, nos] = [
    as.map(el => el.getAttribute('href')), 
    as.map(el => [...el.childNodes].pop().textContent.trim()),
    as.map(el => el.querySelector('strong[aria-hidden]')?.textContent)
  ];

  console.log(`fetching ${filenames.length} htmls...`);
  const origin = location.origin + '/' + location.pathname.split('/')[1] + '/';
  const mains = await fetchAllWithSelector(filenames, origin, 'div#content>main');
  console.log(`fetched ${mains.filter(el => el).length} htmls.`);

  //post-processing (3단계 제목까지만 파일이 바뀐다고 가정)
  mains.forEach((main, i) => {
    //***temp. fix 1***
    //fix wrong english (original) inter-links (1/2)
    const elWithIds = [...main.querySelectorAll('[id]')];
    elWithIds.forEach((el, j) => {
      if(el.innerText != '')  //잘못된 a도 꽤 남아 있음(원서의 a를 지웠어야 했는데 안 지웠다든가).
        elWithIds[j].setAttribute('title', el.textContent.replaceAll('\n', ' '));
    });

    //numbering
    const firstTitle = main.querySelector('h1, h2, h3');  //get first header
    if(nos[i] && firstTitle.innerText == titles[i])
      firstTitle.innerHTML = nos[i] + ' ' + firstTitle.innerHTML;

    //modify inter-links
    const as = [...main.querySelectorAll('a')];
    const hrefs = as.map(el => el.getAttribute('href'));
    hrefs.forEach((href, j) => {
      if(filenames.includes(href)) {
        //if href is like 'chxx.html'
        as[j].href = '#' + href;
      }
      else if(href?.includes('#') && !href.startsWith('.') && as[j]?.href.startsWith(location.origin)) {
        //if href is like 'chxx.html#id', strip filename.
        const filename = href.split('#');
        as[j].href = '#' + filename.pop();
        as[j].setAttribute('fallback-href', '#' + filename.pop());
      }
    });

    //***add ferris text
    const ferrisClassMap = {
      does_not_compile: '1. 컴파일되지 않는 코드',
      panics: '2. 패닉이 발생하는 코드',
      not_desired_behavior: '3. 의도대로 작동하지 않는 코드'
    };
    for([key, value] of Object.entries(ferrisClassMap)) {
      const codes = [...main.querySelectorAll(`code.${key}`)];
      codes.forEach(code => {
        const newNode = document.createElement('p');
        newNode.className = 'ts-memo';
        newNode.textContent = `***조판메모: ${value}`;
        code.parentNode.insertBefore(newNode, code)
      });
    }
  });

  //needed styles
  let style = `  <style>
    img { max-width: 100%; }

    .boring { display: none; }
    code.language-console, code.language-powershell, code.language-cmd { font-weight: bold; }

    table { border-collapse: collapse; }
    th, td { border: solid 1px; }
  </style>
`;

  //***ferris
  style += `  <style>
    .ts-memo { background-color: yellow; color: blue; }

    code.does_not_compile     { background-image: url(img/ferris/does_not_compile.svg); }
    code.panics               { background-image: url(img/ferris/panics.svg); }
    code.not_desired_behavior { background-image: url(img/ferris/not_desired_behavior.svg); }

    code.does_not_compile, code.panics, code.not_desired_behavior {
      display: block;
      background-size: 72px;
      background-position: right 5px top 30px;
      background-repeat: no-repeat;
    }
  </style>
`;

  //merge without <main>
  let merged =  `<head>
  <meta charset="utf-8">
` + style + `</head>
<body>
` + mains.map((el, i) => `<section id="${filenames[i]}">
${el.innerHTML.trim()}
</section>`)
.join('\n') + '\n  </body>\n</html>';


  //***temp. fix 2***
  //try to fix wrong english (original) inter-links (2/2)
  merged = new DOMParser().parseFromString(merged, 'text/html');
  const aBookmarks = [...merged.querySelectorAll('a[href^="#"]')];

  //fix of fix. 잘못 url-인코딩된 id를 다시 디코드
  aBookmarks.forEach(a => {
    const href = a.getAttribute('href');
    if(href.slice(1).match(/%[A-Z0-9][A-Z0-9]/)) {  //대충 판별
      const newHref = decodeURIComponent(href);
      console.debug(`fixed href of ${a.innerHTML} on ${a.closest('section').id}: ${href} -> ${newHref}`);
      a.href = newHref;
    }
  });

  const aWithBrokenLinks = aBookmarks.filter(el => !merged.querySelector(`[id="${el.getAttribute('href').slice(1)}"]`));
  aWithBrokenLinks.forEach((a, i) => {
    const href = a.getAttribute('href');
    const filename = a.closest('section').id;  //for debug

    let targetEl = merged.querySelector(`[title="${a.textContent.replaceAll('\n', ' ').replace(/^‘/, '').replace(/’$/, '')}"]`);
    let targetId = targetEl?.id;

    if(targetEl) {
      console.debug(`fixed (based on text) href of ${a.innerHTML} on ${filename}: ${href} -> #${targetId}`);
      aWithBrokenLinks[i].href = '#' + targetId;
    }
    else {
      targetEl = merged.querySelector(`[id="${a.getAttribute('fallback-href').slice(1)}"]`);
      targetId = targetEl?.id;
      console.warn(`fixed (possibly wrongly) href of ${a.innerHTML} on ${filename}: ${href} -> #${targetId}`);
      aWithBrokenLinks[i].setAttribute('not-found-org-href', href);
      aWithBrokenLinks[i].removeAttribute('fallback-href');
      aWithBrokenLinks[i].href = '#' + targetId;
    }
    aWithBrokenLinks[i].href = '#' + targetId;
  });
  merged = merged.documentElement.outerHTML;


  //d/l it
  const fileLink = document.createElement('a');
  fileLink.href = 'data:text/html;charset=UTF-8,' + encodeURIComponent(merged);
  fileLink.download = 'import_me_to_word.html';
  fileLink.click();

  //end

  function getParentEl(div, parentTagToSearch) {
    //for debug
    const MAX_BACKTRACKING_NUMBER = 10;

    for(let i = 0; i < MAX_BACKTRACKING_NUMBER; i++) {
      if(!div) break;

      if(div.tagName == parentTagToSearch) return div;

      div = div.parentNode;
    }
    return null;
  }

  async function fetchAllWithSelector(filenames, urlPrefix, selector, corsProxy = '') {
    //assuming all files are unique and html
    const res = [];

    //ignore order
    const promises = filenames.map(async (filename) => {
      await fetchOne_(filename);
    });
    await Promise.all(promises);

    return res;


    async function fetchOne_(filename) {
      const url = corsProxy + urlPrefix + filename;
      const response = await fetch(url);  //omitted try-catch

      let result;
      if(response) {
        result = await response.text();
        result = new DOMParser().parseFromString(result, 'text/html').querySelector(selector);
      }
      res[filenames.indexOf(filename)] = result;
    }
  }

})();