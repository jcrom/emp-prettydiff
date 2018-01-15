'use babel';

import {parse} from './luaparse';
import comments from './comments';
import options from './options';
import {buildDocFromAst} from './printer';
import options2 from './options';
import {printDocToString} from './docPrinter';

let defaultOptions = options.defaultOptions;


export default function luapretty(oOptions) {
    // console.log(oOptions);
    let sText = oOptions.source,
        indentation = oOptions.inlevel,
        tab = getTab(oOptions);

    const oAst = parse(sText, {
        comments: true,
        locations: true,
        ranges: true,
        luaVersion: '5.1'
    })
    // console.log(oAst);
    oAst.range[0] = 0;
    oAst.range[1] = sText.length;
    const oMergedOptions = Object.assign({}, options.defaultOptions, oOptions);
    const oReOption = Object.assign({}, oMergedOptions, { sourceText: sText , indentation:indentation});
    comments.injectShebang(oAst, oReOption);
    comments.attachComments(oAst, oReOption);
    const oDoc = buildDocFromAst(oAst, oReOption);
    // console.log(oDoc);
    const sFormattedText = printDocToString(oDoc, oReOption, indentation);
    // console.log(sFormattedText);
    return sFormattedText;
}

let getTab = (oOptions)=>{
    let aa = oOptions.inchar,
        bb = oOptions.insize,
        cc = [];
    for (bb = bb; bb > 0; bb = bb - 1) {
        cc.push(aa);
    }
    return cc.join("");
}
