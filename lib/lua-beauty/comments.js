'use babel';
import util from './util';
import docBuilder from './docBuilder';

const CommentType = {
    Leading : "Leading",
    Trailing : "Trailing",
    Dangling : "Dangling",
    DanglingStatement : "DanglingStatement"
}

let getChildrenOfNode = (node) => {
    const keys = Object.keys(node);
    const children = [];
    function addChild(n) {
        if (n && typeof (n.type) === 'string' && n.type !== 'Comment') {
            let idx;
            for (idx = children.length - 1; idx >= 0; --idx) {
                if (util.locStart(children[idx]) <= util.locStart(n) &&
                    util.locEnd(children[idx]) <= util.locEnd(node)) {
                    break;
                }
            }
            children.splice(idx + 1, 0, n);
        }
    };

    for (const key of keys) {
        const val = node[key];
        if (Array.isArray(val)) {
            val.forEach(addChild);
        }
        else if (val) {
            addChild(val);
        }
    }
    return children;
},
printLeadingComment = (path, options) => {
    const comment = path.getValue();
    const isBlockComment = comment.raw.startsWith('--[[');
    if (isBlockComment) {
        return docBuilder.concat([
            comment.raw,
            util.hasCommentNewLine(options.sourceText, util.locEnd(comment)) ? docBuilder.hardline : ' '
        ]);
    }
    const parts = [];
    parts.push(comment.raw);
    parts.push(docBuilder.hardline);
    if (util.isNextLineEmpty(options.sourceText, util.locEnd(comment))) {
        parts.push(docBuilder.hardline);
    }
    return docBuilder.concat(parts);
},
printTrailingComment = (path, options) => {
    const comment = path.getValue();
    if (util.hasNewLine(options.sourceText, util.locStart(comment), { searchBackwards: true })) {
        const previousLineEmpty = util.isPreviousLineEmpty(options.sourceText, util.locStart(comment));
        return docBuilder.concat([docBuilder.hardline, previousLineEmpty ? docBuilder.hardline : '', comment.raw]);
    }
    if (comment.raw.startsWith('--[[')) {
        return docBuilder.concat([' ', comment.raw]);
    }
    const parts = [];
    if (util.isNextLineEmpty(options.sourceText, util.locStart(comment), { searchBackwards: true })) {
        parts.push(docBuilder.hardline);
    }
    parts.push(' ');
    parts.push(comment.raw);
    parts.push(docBuilder.breakParent);
    return docBuilder.lineSuffix(docBuilder.concat(parts));
},
addComment = (node, comment) => {
    const comments = node.attachedComments || (node.attachedComments = []);
    comments.push(comment);
},
addLeadingComment = (node, comment) => {
    comment.commentType = CommentType.Leading;
    addComment(node, comment);
},
addDanglingComment = (node, comment) => {
    comment.commentType = CommentType.Dangling;
    addComment(node, comment);
},
addDanglingStatementComment = (node, comment) => {
    comment.commentType = CommentType.DanglingStatement;
    addComment(node, comment);
},
addTrailingComment = (node, comment) => {
    comment.commentType = CommentType.Trailing;
    addComment(node, comment);
},
handleStatementsWithNoBodyComments = (enclosingNode, comment) => {
    if (!enclosingNode || enclosingNode.body == null) {
        return false;
    }
    if (enclosingNode.body.length === 0) {
        addDanglingComment(enclosingNode, comment);
        return true;
    }
    return false;
},
handleFunctionBodyComments = (precedingNode, enclosingNode, comment)  => {
    if (!enclosingNode || enclosingNode.type !== 'FunctionDeclaration' || enclosingNode.body.length > 0) {
        return false;
    }
    if (enclosingNode.parameters.length > 0 &&
        enclosingNode.parameters[enclosingNode.parameters.length - 1] === precedingNode) {
        addDanglingComment(enclosingNode, comment);
        return true;
    }
    if (precedingNode && precedingNode.type === 'Identifier') {
        addDanglingComment(enclosingNode, comment);
        return true;
    }
    return false;
},
handleIfStatementsWithNoBodyComments = (precedingNode, enclosingNode, followingNode, comment) => {
    if (!enclosingNode || enclosingNode.type !== 'IfStatement') {
        return false;
    }
    if (followingNode && (followingNode.type === 'ElseifClause' || followingNode.type === 'ElseClause')) {
        addDanglingComment(precedingNode, comment);
        return true;
    }
    if (precedingNode && precedingNode.type === 'ElseClause') {
        addDanglingComment(precedingNode, comment);
        return true;
    }
    return false;
},
handleExpressionBeginComments = (precedingNode, enclosingNode, comment) => {
    if (comment.raw.startsWith('--[[')) {
        return false;
    }
    if (!enclosingNode) {
        return false;
    }
    switch (enclosingNode.type) {
        case 'WhileStatement':
            if (precedingNode === enclosingNode.condition) {
                addDanglingStatementComment(enclosingNode, comment);
                return true;
            }
            break;
        case 'DoStatement':
        case 'RepeatStatement':
            if (precedingNode == null) {
                addDanglingStatementComment(enclosingNode, comment);
                return true;
            }
            break;
        case 'FunctionDeclaration':
            if ((enclosingNode.parameters.length &&
                precedingNode === enclosingNode.parameters[enclosingNode.parameters.length - 1]) ||
                (precedingNode === enclosingNode.identifier)) {
                addDanglingStatementComment(enclosingNode, comment);
                return true;
            }
            break;
        case 'ForNumericStatement':
            if (precedingNode === enclosingNode.end || precedingNode === enclosingNode.step) {
                addDanglingStatementComment(enclosingNode, comment);
                return true;
            }
            break;
        case 'ForGenericStatement':
            if (precedingNode === enclosingNode.iterators[enclosingNode.iterators.length - 1]) {
                addDanglingStatementComment(enclosingNode, comment);
                return true;
            }
            break;
        case 'IfClause':
        case 'ElseifClause':
            if (precedingNode === enclosingNode.condition &&
                comment.loc.start.column > precedingNode.loc.start.column) {
                addDanglingStatementComment(enclosingNode, comment);
                return true;
            }
            break;
        case 'ElseClause':
            if (precedingNode == null) {
                addDanglingStatementComment(enclosingNode, comment);
                return true;
            }
            break;
    }
    return false;
},
handleDanglingIfStatementsWithNoBodies =(precedingNode, enclosingNode, comment) => {
    if (!precedingNode || !enclosingNode) {
        return false;
    }
    if (enclosingNode.type !== 'IfStatement') {
        return false;
    }
    switch (precedingNode.type) {
        case 'IfClause':
        case 'ElseifClause':
        case 'ElseClause':
            if (precedingNode.body.length === 0) {
                addDanglingStatementComment(precedingNode, comment);
                return true;
            }
            break;
    }
    return false;
},
decorateComment = (node, comment) => {
    const childNodes = getChildrenOfNode(node);
    let precedingNode = null;
    let followingNode = null;
    let left = 0;
    let right = childNodes.length;
    while (left < right) {
        const middle = Math.floor((left + right) / 2);
        const childNode = childNodes[middle];
        if (util.locStart(childNode) - util.locStart(comment) <= 0 &&
            util.locEnd(comment) - util.locEnd(childNode) <= 0) {
            comment.enclosingNode = childNode;
            decorateComment(childNode, comment);
            return;
        }
        if (util.locEnd(childNode) - util.locStart(comment) <= 0) {
            precedingNode = childNode;
            left = middle + 1;
            continue;
        }
        if (util.locEnd(comment) - util.locStart(childNode) <= 0) {
          followingNode = childNode;
          right = middle;
          continue;
        }
    }
    if (precedingNode) {
        comment.precedingNode = precedingNode;
    }
    if (followingNode) {
        comment.followingNode = followingNode;
    }
};

export default {
    attachComments(ast, options) {
        let preComment = null;
        for (const comment of ast.comments) {
            decorateComment(ast, comment);
            const precedingNode = comment.precedingNode;
            const enclosingNode = comment.enclosingNode;
            const followingNode = comment.followingNode;

            let continueFlag = false;
            if (preComment && preComment.precedingNode == comment.precedingNode &&
                preComment.followingNode == comment.followingNode &&
                util.locEnd(preComment) <= util.locStart(comment)){
                  let tmpType = preComment.commentType;
                  preComment = comment;
                  switch (tmpType) {
                    case "Leading":
                      addLeadingComment(followingNode, comment);
                      continueFlag = true;
                      break;
                    case "Trailing":
                      addTrailingComment(precedingNode, comment);
                      continueFlag = true;
                      break;
                    default:
                      break;
                  }
            }
            preComment = comment;

            if (continueFlag){
              continue;
            }


            if (util.hasNewLine(options.sourceText, util.locStart(comment), { searchBackwards: true })) {
                if (handleStatementsWithNoBodyComments(enclosingNode, comment) ||
                    handleFunctionBodyComments(precedingNode, enclosingNode, comment) ||
                    handleIfStatementsWithNoBodyComments(precedingNode, enclosingNode, followingNode, comment)) {
                }
                else if (followingNode) {
                    addLeadingComment(followingNode, comment);
                }
                else if (precedingNode) {
                    addTrailingComment(precedingNode, comment);
                }
                else if (enclosingNode) {
                    addDanglingComment(enclosingNode, comment);
                }
                else {
                    addDanglingComment(ast, comment);
                }
            }
            else {
                if (handleExpressionBeginComments(precedingNode, enclosingNode, comment) ||
                    handleDanglingIfStatementsWithNoBodies(precedingNode, enclosingNode, comment)) {
                }
                else if (precedingNode) {
                    addTrailingComment(precedingNode, comment);
                }
                else if (followingNode) {
                    addLeadingComment(followingNode, comment);
                }
                else if (enclosingNode) {
                    addDanglingComment(enclosingNode, comment);
                }
                else {
                    addDanglingComment(ast, comment);
                }
            }
        }
    },

    injectShebang(ast, options) {
        if (!options.sourceText.startsWith('#!')) {
            return;
        }
        const endLine = options.sourceText.indexOf('\n');
        const raw = options.sourceText.slice(0, endLine);
        const shebang = options.sourceText.slice(2, endLine);
        ast.comments.push({
            type: 'Comment',
            loc: {
                start: {
                    line: 1,
                    column: 0
                },
                end: {
                    line: 1,
                    column: endLine
                }
            },
            range: [0, endLine],
            raw,
            value: shebang
        });
    },

    printDanglingComments(path, sameIndent = false) {
        const node = path.getValue();
        if (!node || !node.attachedComments) {
            return '';
        }
        const parts = [];
        path.forEach((commentPath) => {
            const comment = commentPath.getValue();
            if (comment.commentType === CommentType.Dangling) {
                parts.push(comment.raw);
            }
        }, 'attachedComments');
        if (parts.length === 0) {
            return '';
        }
        if (sameIndent) {
            return docBuilder.join(docBuilder.hardline, parts);
        }
        return docBuilder.indent(docBuilder.concat([docBuilder.hardline, docBuilder.join(docBuilder.hardline, parts)]));
    },

    printDanglingStatementComments(path) {
        const node = path.getValue();
        if (!node || !node.attachedComments) {
            return '';
        }
        const parts = [];
        path.forEach((commentPath) => {
            const comment = commentPath.getValue();
            if (comment.commentType === CommentType.DanglingStatement) {
                parts.push(' ');
                parts.push(comment.raw);
            }
        }, 'attachedComments');
        if (parts.length === 0) {
            return '';
        }
        return docBuilder.concat(parts);
    },

    printComments(path, options, print) {
        const node = path.getValue();
        const printed = print(path);
        const comments = node.attachedComments;
        if (!comments || comments.length === 0) {
            return printed;
        }
        const leadingParts = [];
        const trailingParts = [printed];
        path.forEach((commentPath) => {
            const comment = commentPath.getValue();
            const commentType = comment.commentType;
            switch (commentType) {
                case CommentType.Leading:
                    leadingParts.push(printLeadingComment(path, options));
                    break;
                case CommentType.Trailing:
                    trailingParts.push(printTrailingComment(path, options));
                    break;
            }
        }, 'attachedComments');
        return docBuilder.concat(leadingParts.concat(trailingParts));
    },

    decorateComment
}
