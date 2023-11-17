document.getElementById('fileInput').addEventListener('change', handleFileSelect);

const converter = new showdown.Converter();
converter.setOption('customizedHeaderId', true);

let q;

function handleFileSelect(e) {
  q = new Map();

  const files = e.target.files;
  const fileNumber = files.length;
  Object.keys(files).forEach(i => {
    const file = files[i];
    const reader = new FileReader();
    reader.onload = (e) => {
      console.log(file.name);
      q.set(file.name, converter.makeHtml(makeFootnotes(fixx(reader.result), i)));
      if(q.size == fileNumber) downloadAndQuit();
    }
    reader.readAsText(file);
  });
}

function fixx(str) {
  //dicts (source => target). insertion order is important. keys should be a global regexp (or a string).
  const DICTS = new Map();

  //animal pics
  DICTS.set('../images/icon_tip_or_suggestion.png',  'css/@tip.jpg');
  DICTS.set('../images/icon_warning_or_caution.png', 'css/@warning.jpg');
  DICTS.set('../images/icon_general_note.png',       'css/@warning.jpg');

  //images
  const BOOK_NAME = 'clru';  //set as needed
  DICTS.set(/\.\.\/images\/figure_([0-9][0-9])_([0-9][0-9])\.png/g, `assets/${BOOK_NAME}_$1$2.png`);

  //terminal
  DICTS.set(/```console\n(.+?)\n```/gs, '<*터미널시작*>\n```console\n$1\n```\n<*터미널끝*>');

  //remove invisible spaces
  DICTS.set('\u200b', '');
  DICTS.set('\u2060', '');

  //remove not-working italics
  DICTS.set(/_\[(.+?)\]\((.+?)\)_/g, '\[_$1_\]\($2\)');
  DICTS.set(/\[_(.+?)_\]\((.+?)\)/g, '$1');
  DICTS.set(/\[(.+?)\]\((.+?)\)/g,   '$1');
  //DICTS.set(/_(\S+?)_/g,              '<i>$1</i>');  //잘못되는 일이 너무 많다!

  let newResult = str, oldResult = str;
  for(const [k,v] of DICTS.entries()) {
    newResult = newResult.replaceAll(k, v);
    if(newResult != oldResult) {
      console.debug(`fix applied: ${k} -> ${v}, length changed: ${oldResult.length} -> ${newResult.length}`);
      oldResult = newResult;
    }
  }

  return newResult;
}

function makeFootnotes(str, chapterNumber) {
  chapterNumber++;
  let curIdx = -1, oldIdx = -1, newStr = str, processedNumber = 0, divStarted = false;
  while(str.indexOf('[^', oldIdx+1) > -1) {
    curIdx = str.indexOf('[^', oldIdx+1);
    const endIdx = str.indexOf(']', curIdx);  //it should be > -1
    const curNumber = parseInt(str.slice(curIdx+2, endIdx));  //slice the number only

    let offsetStr = '';
    if(!divStarted && !(curNumber > processedNumber)) {  //footnotes section start
      divStarted = true;
      offsetStr = '<div class="footnotes"><hr><ol>\n';
    }

    //조판자 편의를 위해 [^1] 형태 유지
    const fnRefStr = `[^${curNumber}]`;

    if(divStarted) {  //footnotes section
      let liStr = '';
      if(curNumber > 1) liStr = "</li>"
      liStr = liStr + `<li id="fn-${chapterNumber}-${curNumber}"><a href="#fnref-${chapterNumber}-${curNumber}">${fnRefStr}</a>`;
      newStr = str.slice(0, curIdx) + offsetStr + liStr + str.slice(curIdx+fnRefStr.length);
    }
    else {  //footnotes number(reference)
      const aStr = `<sup id="fnref-${chapterNumber}-${curNumber}"><a href="#fn-${chapterNumber}-${curNumber}">${fnRefStr}</a></sup>`;
      newStr = str.slice(0, curIdx) + aStr + str.slice(endIdx+1);
    }

    oldIdx = newStr.length - str.length + curIdx + 1;
    processedNumber = curNumber;
    str = newStr;
  }  //of while

  if(divStarted) newStr = newStr + '</li>\n</ol>\n</div>';

  return newStr;
}

function downloadAndQuit() {
  //const zip = new JSZip();

  //sort map
  const arr = [...q];
  arr.sort((a, b) => a[0].slice(0,2) - b[0].slice(0,2));

  let newHtml = `<html>
<head>
  <meta charset="utf-8" />
  <style>
  img { max-width: 500px; }

  pre>code:not(.language-console) { background-color: palegreen; }
  code.language-console { background-color: lightblue; }
  :not(pre)>code { background-color: aliceblue; }

  table { border-collapse: collapse; }
  th, td { border: solid 1px; }
  </style>
</head>
<body>
`;

  for(const el of arr) {
    //zip.file(filename, value);
    newHtml = newHtml + `<section id=${el[0]}>\n${el[1]}\n</section>\n`;
  }
  newHtml = newHtml + `</body></html>`;

  const fileName = `all.html`;
  /*
  zip.generateAsync({type: "blob"})
  .then(blob => {
  */
  const blob = new Blob([newHtml], {type: "data:attachment/text"});

    const fileLink = document.createElement('a');
    fileLink.href = window.URL.createObjectURL(blob);
    fileLink.download = fileName;
    fileLink.click();
  //});
}
