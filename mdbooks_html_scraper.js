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
    //numbering
    const firstTitle = main.querySelector('h1, h2, h3');  //get first header
    if(nos[i] && firstTitle.innerText == titles[i])
      firstTitle.innerHTML = nos[i] + ' ' + firstTitle.innerHTML;

    //fix inter-links
    const as = [...main.querySelectorAll('a')];
    const hrefs = as.map(el => el.getAttribute('href'));
    hrefs.forEach((href, j) => {
      if(filenames.includes(href)) {
        const targetIdx = filenames.indexOf(href);
        const firstId = mains[targetIdx].querySelector('h1, h2, h3').id;
        as[j].setAttribute('href', '#' + firstId);
      }
    });

    //***add ferris text
    const fMap = {
      does_not_compile: '1. 컴파일되지 않는 코드',
      panics: '2. 패닉이 발생하는 코드',
      not_desired_behavior: '3. 의도대로 작동하지 않는 코드'
    };
    for([key, value] of Object.entries(fMap)) {
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

    code.language-console, code.language-powershell, code.language-cmd {
      font-weight: bold;
    }

    table {
      border-collapse: collapse;
    }
    th, td {
      border: solid 1px;
    }
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
  const merged =  `<head>
  <meta charset="utf-8">
` + style + `</head>
<body>
` + mains.map(el => el.innerHTML).join('\n') + '\n  </body>\n</html>';

  //d/l it
  const fileLink = document.createElement('a');
  fileLink.href = 'data:text/html;charset=UTF-8,' + encodeURIComponent(merged);
  fileLink.download = 'import_me_to_word.html';
  fileLink.click();

  //end


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