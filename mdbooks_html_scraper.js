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

  //numbering
  mains.forEach((main, i) => {
    const firstTitle = main.querySelector('h1, h2, h3');
    if(nos[i] && firstTitle.innerText == titles[i])
      firstTitle.innerHTML = nos[i] + ' ' + firstTitle.innerHTML;
  });

  //merge without <main>
  const merged =  `<head>
  <meta charset="utf-8">
  <style>
  .boring { display: none; }
  </style>
</head>
<body>` + '\n' + mains.map(el => el.innerHTML).join('\n') + '\n  </body>\n</html>';

  //d/l it
  const fileLink = document.createElement('a');
  fileLink.href = 'data:text/html;charset=UTF-8,' + encodeURIComponent(merged);
  fileLink.download = 'import_me_to_word.html';
  fileLink.click();


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