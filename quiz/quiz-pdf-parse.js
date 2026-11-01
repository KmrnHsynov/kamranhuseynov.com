'use strict';

// Turns the text of an exam PDF into question objects. Pure function: no DOM, so it runs in Node tests.
function parsePdfText(text){
  const results=[];
  text = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');

  // Split on lines that start with a question number (e.g. "1." or "1)")
  const qRegex = /(?:^|\n)[ \t]*(\d+)[.)]\s+(.+?)(?=\n[ \t]*\d+[.)]\s|\s*$)/gs;

  // Option / answer line patterns
  const reLetterOpt = /^([A-Ja-j])[.)]\s+(.+)/;                 // "A) text"  or  "A. text"  (A–J; only the first 5 are kept)
  const reCorrect   = /^[\u221A\u2713]\s*(.+)/;                 // √ or ✓  = correct option
  const reBullet    = /^[\u2022\u25CF\u25E6\u2023\u25AA\u00B7]\s*(.+)/; // • ● ◦ ‣ ▪ · = distractor
  const reAnsLine   = /^(?:d[\u00FCu]zg[\u00FCu]n\s*)?(?:cavab|answer)\s*[:\-]?\s*([A-Ja-j])\b/i; // "Cavab: B"

  // JavaScript's \b only knows ASCII letters, so "yanlış" never matched at the end of a line.
  // These treat any Unicode letter or digit as part of a word.
  const word = list => new RegExp('(^|[^\\p{L}\\p{N}])(' + list + ')(?![\\p{L}\\p{N}])', 'iu');
  const reTfWord   = word('doğru|yanl[ıiIİ]ş|true|false|T/F');
  const reTrueWord = word('doğru|true');
  const reFalseWord = word('yanl[ıiIİ]ş|false');
  const reAnsText   = /^(?:d[üu]zg[üu]n\s*)?(?:cavab|answer)\s*[:\-]\s*(.*)$/i;          // "Cavab: Paris"
  const reAnsInline = /^(.*?)\s+(?:cavab|answer)\s*[:\-]\s*(.+)$/i;                               // "Question? Cavab: Paris"
  const reTfAnswer =/(?:cavab|answer)\s*[:\-]?\s*(doğru|yanl[ıiIİ]ş|true|false)(?![\p{L}\p{N}])/iu;

  let m;
  while((m=qRegex.exec(text))!==null){
    const block = m[2].trim();
    const lines = block.split('\n').map(l=>l.trim()).filter(l=>l);
    if(!lines.length) continue;

    const opts=[];
    let correctIdx=-1;       // index of correct option (√ format)
    let correctLetter=null;  // A/B/C/D/E (Cavab format)
    let lastOptIdx=-1;
    let seenOption=false;
    let answerText=null;     // "Cavab: ..." written out in words, for short / fill / true-false / text-matched choices
    const qTextParts=[];

    for(const line of lines){
      // "A) ..." lettered option
      let mm = line.match(reLetterOpt);
      if(mm){ opts.push(mm[2].trim()); lastOptIdx=opts.length-1; seenOption=true; continue; }

      // √ correct option
      mm = line.match(reCorrect);
      if(mm){ correctIdx=opts.length; opts.push(mm[1].trim()); lastOptIdx=opts.length-1; seenOption=true; continue; }

      // • distractor option
      mm = line.match(reBullet);
      if(mm){ opts.push(mm[1].trim()); lastOptIdx=opts.length-1; seenOption=true; continue; }

      // "Cavab: B" explicit answer line
      mm = line.match(reAnsLine);
      if(mm){ if(!correctLetter) correctLetter=mm[1].toUpperCase(); continue; }

      // "Cavab: Paris" (a written answer). It must never stay in the question: students would see it.
      mm = line.match(reAnsText);
      if(mm){ if(answerText===null) answerText=mm[1].trim(); continue; }

      // Continuation line: extend the question (before options) or the last option (after)
      if(!seenOption){
        // "Capital of France? Cavab: Paris" on one line: split the answer off
        const inline = line.match(reAnsInline);
        if(inline){
          if(inline[1].trim()) qTextParts.push(inline[1].trim());
          if(answerText===null) answerText=inline[2].trim();
        } else qTextParts.push(line);
      }
      else if(lastOptIdx>=0) opts[lastOptIdx]+=' '+line;
    }

    const questionText=(qTextParts.join(' ')||lines[0]).trim();

    // Resolve the correct index from whichever marker was found
    if(correctIdx<0 && correctLetter) correctIdx='ABCDEFGHIJ'.indexOf(correctLetter);
    // "Cavab: MySQL" naming the option instead of its letter
    if(correctIdx<0 && answerText){
      const wanted=answerText.trim().toLowerCase();
      correctIdx=opts.findIndex(o=>o.trim().toLowerCase()===wanted);
    }
    // No marker found: do not silently pick option A, flag it so the teacher confirms the answer.
    const unresolved = correctIdx<0;
    if(unresolved) correctIdx=0;

    // Trim to 5 options, always keeping the correct one
    if(opts.length>5){
      if(correctIdx>=5){
        const c=opts[correctIdx];
        const rest=opts.filter((_,i)=>i!==correctIdx).slice(0,4);
        opts.length=0; opts.push(c,...rest); correctIdx=0;
      } else {
        opts.splice(5);
      }
    }

    let q;
    if(opts.length>=2){
      while(opts.length<5) opts.push('');
      q={ type:'mc', text:questionText, options:opts.slice(0,5), correctOption:correctIdx, tfAnswer:true, shortAnswer:'', fillText:'', fillAnswers:[], points:1, needsReview:unresolved };
    } else if(reTfWord.test(block)){
      // An explicit "Cavab: Doğru" wins; otherwise use the one true/false word present.
      // If the block names both (e.g. "Doğru / Yanlış" as choices) the answer is unknown.
      const stated=(block.match(reTfAnswer)||[])[1];
      const hasT=reTrueWord.test(block), hasF=reFalseWord.test(block);
      let ans=true, review=false;
      if(stated) ans=/^(doğru|true)$/i.test(stated);
      else if(hasT!==hasF) ans=hasT;
      else review=true;
      q={ type:'tf', text:questionText, options:['','','','',''], correctOption:0, tfAnswer:ans, shortAnswer:'', fillText:'', fillAnswers:[], points:1, needsReview:review };
    } else if(/\[blank\]/i.test(block)){
      const ans=answerText ?? '';
      q={ type:'fill', text:questionText, options:['','','','',''], correctOption:0, tfAnswer:true, shortAnswer:'', fillText:questionText, fillAnswers:[ans], points:1, needsReview:!ans.trim() };
    } else {
      const ans=answerText ?? '';
      q={ type:'short', text:questionText, options:['','','','',''], correctOption:0, tfAnswer:true, shortAnswer:ans, fillText:'', fillAnswers:[], points:1, needsReview:!ans.trim() };
    }
    results.push(q);
  }
  return results;
}

if(typeof module !== 'undefined') module.exports = { parsePdfText };
