'use babel';


let skipSpaces = (text, idx, searchOptions = {}) => {
    return skipMany(text, idx, [' ', '\t'], searchOptions);
},
skipOnce = (text, idx, sequences, searchOptions = {}) => {
    let skipCount = 0;
    sequences.forEach(seq => {
        const searchText = searchOptions.searchBackwards
            ? text.substring(idx - seq.length, idx)
            : text.substring(idx, idx + seq.length);
        if (searchText === seq) {
            skipCount = seq.length;
            return;
        }
    });
    return idx + (searchOptions.searchBackwards ? -skipCount : skipCount);
},
skipMany = (text, idx, sequences, searchOptions = {}) => {
    let oldIdx = null;
    while (oldIdx !== idx) {
        oldIdx = idx;
        idx = skipOnce(text, idx, sequences, searchOptions);
    }
    return idx;
},
skipNewLine = (text, idx, searchOptions = {}) => {
    return skipOnce(text, idx, ['\n', '\r\n'], searchOptions);
},
skipToLineEnd = (text, idx, searchOptions = {}) => {
    return skipMany(text, skipSpaces(text, idx), [';'], searchOptions);
},
hasNewLine = (text, idx, searchOptions = {}) => {
    const endOfLineIdx = skipSpaces(text, idx, searchOptions);
    const nextLineIdx = skipNewLine(text, endOfLineIdx, searchOptions);
    return endOfLineIdx !== nextLineIdx;
},
hasCommentNewLine = (text, idx, searchOptions = {}) => {
    if (45 === text.charCodeAt(idx) &&
         45 === text.charCodeAt(idx + 1)){
           return true;
    }
    const endOfLineIdx = skipSpaces(text, idx, searchOptions);
    const nextLineIdx = skipNewLine(text, endOfLineIdx, searchOptions);
    return endOfLineIdx !== nextLineIdx;
},

skipTrailingComment = (text, idx) => {
    if (text.charAt(idx) === '-' && text.charAt(idx + 1) === '-') {
        idx += 2;
        while (idx >= 0 && idx < text.length) {
            if (text.charAt(idx) === '\n') {
                return idx;
            }
            if (text.charAt(idx) === '\r' && text.charAt(idx + 1) === '\n') {
                return idx;
            }
            idx++;
        }
    }
    return idx;
};

export default {
    skipSpaces,
    skipOnce,
    skipMany,
    skipNewLine,
    skipToLineEnd,
    hasNewLine,
    hasCommentNewLine,
    skipTrailingComment,

    locStart(node) {
        return node.range[0];
    },

    locEnd(node) {
        return node.range[1];
    },

    isNode(value) {
        if (!value || typeof (value.type) !== 'string') {
            return false;
        }
        switch (value.type) {
            case 'LabelStatement':
            case 'BreakStatement':
            case 'GotoStatement':
            case 'ReturnStatement':
            case 'IfStatement':
            case 'IfClause':
            case 'ElseifClause':
            case 'ElseClause':
            case 'WhileStatement':
            case 'DoStatement':
            case 'RepeatStatement':
            case 'LocalStatement':
            case 'AssignmentStatement':
            case 'CallStatement':
            case 'FunctionDeclaration':
            case 'ForNumericStatement':
            case 'ForGenericStatement':
            case 'Chunk':
            case 'Identifier':
            case 'BooleanLiteral':
            case 'NilLiteral':
            case 'NumericLiteral':
            case 'StringLiteral':
            case 'VarargLiteral':
            case 'TableKey':
            case 'TableKeyString':
            case 'TableValue':
            case 'TableConstructorExpression':
            case 'BinaryExpression':
            case 'LogicalExpression':
            case 'UnaryExpression':
            case 'MemberExpression':
            case 'IndexExpression':
            case 'CallExpression':
            case 'TableCallExpression':
            case 'StringCallExpression':
            case 'Comment':
                return true;
            default:
                return false;
        }
    },


    hasNewLineInRange(text, start, end) {
        return text.substr(start, end - start).indexOf('\n') !== -1;
    },

    isPreviousLineEmpty(text, idx) {
        idx = skipSpaces(text, idx, { searchBackwards: true });
        idx = skipNewLine(text, idx, { searchBackwards: true });
        idx = skipSpaces(text, idx, { searchBackwards: true });
        const previousLine = skipNewLine(text, idx, { searchBackwards: true });
        return idx !== previousLine;
    },

    isNextLineEmpty(text, idx, searchOptions = {
            searchBackwards: false
        }) {
        idx = skipToLineEnd(text, idx, searchOptions);
        let oldIdx = null;
        while (idx !== oldIdx) {
            oldIdx = idx;
            idx = skipSpaces(text, idx, searchOptions);
        }
        idx = skipTrailingComment(text, idx);
        idx = skipNewLine(text, idx, searchOptions);
        return hasNewLine(text, idx);
    }

}
