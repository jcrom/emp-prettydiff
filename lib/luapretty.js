'use babel';

// import luabeautifier from './beautifier';
// import {formatText} from 'lua-fmt';
import luabeauty from './lua-beauty';

let iTabLen = atom.config.get('editor.tabLength'),
    bSoftTabs = atom.config.get('editor.softTabs'),
    iUnsoftTabLen = 1;

let getDafaultIndentSize = () => {
    if (bSoftTabs) {
        return iTabLen;
    } else {
        return iUnsoftTabLen;
    }

}

let getDefaultIndentChar = () => {
    if (bSoftTabs) {
        return " ";
    } else {
        return "\t";
    }
}

let sDefIndentChar = getDefaultIndentChar(),
    iDefIndentSize = getDafaultIndentSize(),
    sDefIndent = sDefIndentChar.repeat(iDefIndentSize);


export default function luapretty(options) {
    // let iOriginalSize = options.source.length;
    // let sEOL = (options.crlf === true || options.crlf === "true") ? "\r\n" : "\n";
    // let sEOL = getDefLineEnd('\r\n','\n');
    // console.log(sEOL);
    if (typeof options.source === "string" && options.source.length > 0) {
        // return luabeautifier(options.source, sDefIndent, {
        //     eol: sEOL
        // });
        return luabeauty(options);
    } else {
        return ""
    }
}
