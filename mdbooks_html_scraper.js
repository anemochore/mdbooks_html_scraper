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
    const as = [...main.querySelectorAll('a[href]')];
    const hrefs = as.map(el => el.getAttribute('href'));
    hrefs.forEach((href, j) => {
      if(href.startsWith('.')) {
        //상대주소는 절대주소로.
        as[j].href = as[j].href;  //.href returns calculated url (getAttribute(href) does not)
      }
      else if(filenames.includes(href)) {
        //if href is like 'chxx.html'
        as[j].href = '#' + href;
      }
      else if(href.includes('#') && as[j].href.startsWith(location.origin)) {
        //if href is like 'chxx.html#id', strip filename.
        const filename = href.split('#');
        as[j].href = '#' + filename.pop();

        const fallback = filename.pop();
        if(fallback)
          as[j].setAttribute('fallback-href', '#' + fallback);
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
        code.parentNode.insertBefore(newNode, code);
      });
    }
  });

  //needed styles. 'lightgray'는 워드에서 인식 못 함...ㅋ
  let style = `  <style>
    a.header, a:not([href^="#"]) { text-decoration: none; }
    .with-page { color: green; font-weight: bold; }

    img { max-width: 500px; }

    .boring { display: none; }
    p.codeblock { background-color: palegreen; }
    p.terminal { background-color: lightblue; }
    :not(p[class])>code:not([class]) { font-family: Consolas; background-color: aliceblue; }

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
  <meta name="generator" content="mdbooks_html_scraper">
` + style + `</head>
<body>
` + mains.map((el, i) => `<section id="${filenames[i]}">
${el.innerHTML.trim()}
</section>`)
.join('\n') + '  </body>\n</html>';

  //start additional post-processing (mostly for later use in word)
  merged = new DOMParser().parseFromString(merged, 'text/html');

  //set pre class
  [...merged.querySelectorAll('pre>code[class^="language"]')].forEach(code => {
    const pre = code.parentNode;
    const lang = code.classList[0].split('-').pop();  //assuming language-xxx is the first classname

    const p = document.createElement('p');  //pre is ignored in word.
    pre.appendChild(p);
    p.appendChild(code);
    if(lang == 'console' || lang == 'text' || lang == 'powershell' || lang == 'cmd')
      p.className = 'terminal';
    else
      p.className = 'codeblock';
  });

  //***temp. fix 2***
  //try to fix wrong english (original) inter-links (2/2)
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
    }
    else {
      targetEl = merged.querySelector(`[id="${a.getAttribute('fallback-href').slice(1)}"]`);
      targetId = targetEl?.id;
      console.warn(`fixed (possibly wrongly) href of ${a.innerHTML} on ${filename}: ${href} -> #${targetId}`);
      aWithBrokenLinks[i].setAttribute('not-found-org-href', href);
      aWithBrokenLinks[i].removeAttribute('fallback-href');
    }
    aWithBrokenLinks[i].href = '#' + targetId;
  });

  //end of additional post-processing
  merged = merged.documentElement.outerHTML;


  //d/l it
  downloadAndEnd(merged);



  function downloadAndEnd(merged) {
    const fileLink = document.createElement('a');
    fileLink.href = 'data:text/html;charset=UTF-8,' + encodeURIComponent(merged);
    fileLink.download = 'import_me_to_word.html';
    fileLink.click();
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
      //proxy for cors was not needed.
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
