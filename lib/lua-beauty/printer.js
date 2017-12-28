'use babel';

import FastPath from './fastPath';
import util from './util';
import docBuilder from './docBuilder';
import comments from './comments';
import docUtils from './docUtils';
import options from './options';

let printStatementSequence = (path, tmp_options, print) => {
    const printed = [];
    path.forEach((statementPath) => {
        const parts = [print(statementPath)];
        if (util.isNextLineEmpty(tmp_options.sourceText, util.locEnd(statementPath.getValue())) && !isLastStatement(path)) {
            parts.push(docBuilder.hardline);
        }
        printed.push(docBuilder.concat(parts));
    });
    return docBuilder.join(docBuilder.hardline, printed);
};

let printIndentedStatementList = (path, tmp_options, print, field) => {
    const printedBody = path.call((bodyPath) => {
        return printStatementSequence(bodyPath, tmp_options, print);
    }, field);
    return docBuilder.indent(docBuilder.concat([docBuilder.hardline, printedBody]));
};

let printDanglingStatementComment = (path) => {
    const tmp_comments = path.getValue().attachedComments;
    if (!tmp_comments) {
        return '';
    }
    return docBuilder.concat([comments.printDanglingStatementComments(path), comments.printDanglingComments(path)]);
};

let makeStringLiteral = (raw, quotemark) => {
    const preferredQuoteCharacter = options.getStringQuotemark(quotemark);
    const alternativeQuoteCharacter = options.getAlternativeStringQuotemark(quotemark === 'single' ? 'single' : 'double');
    const newString = raw.replace(/\\([\s\S])|(['"])/g, (match, escaped, quote) => {
        if (escaped === alternativeQuoteCharacter) {
            return escaped;
        }
        if (quote === preferredQuoteCharacter) {
            return '\\' + quote;
        }
        return match;
    });
    return preferredQuoteCharacter + newString + preferredQuoteCharacter;
}

let printStringLiteral = (path, tmp_options) => {
    const literal = path.getValue();
    if (literal.type !== 'StringLiteral') {
        throw new Error('printStringLiteral: Expected StringLiteral, got ' + literal.type);
    }
    if (literal.raw.startsWith('[[') || literal.raw.startsWith('[=')) {
        return literal.raw;
    }
    const raw = literal.raw.slice(1, -1);
    let preferredQuotemark = tmp_options.quotemark;
    const preferredQuoteCharacter = options.getStringQuotemark(preferredQuotemark);
    if (raw.includes(preferredQuoteCharacter)) {
        preferredQuotemark = preferredQuotemark === 'single' ? 'double' : 'single';
    }
    return makeStringLiteral(raw, preferredQuotemark);
}

let isLastStatement = (path) => {
    const parent = path.getParent();
    const node = path.getValue();
    const body = parent.body;
    return body && body[body.length - 1] === node;
}


let printNodeNoParens = (path, tmp_options, print) => {
    const value = path.getValue();
    if (!value) {
        return '';
    }
    const parts = [];
    const node = value;
    switch (node.type) {
        case 'Chunk':
            parts.push(path.call((bodyPath) => {
                return printStatementSequence(bodyPath, tmp_options, print);
            }, 'body'));
            parts.push(comments.printDanglingComments(path, true));
            if (node.body.length || node.attachedComments) {
                parts.push(docBuilder.hardline);
            }
            return docBuilder.concat(parts);
        case 'LabelStatement':
            return docBuilder.concat(['::', path.call(print, 'label'), '::']);
        case 'GotoStatement':
            return docBuilder.concat(['goto ', path.call(print, 'label')]);
        case 'BreakStatement':
            return 'break';
        case 'ReturnStatement':
            parts.push('return');
            if (node.arguments.length > 0) {
                parts.push(' ');
                parts.push(docBuilder.join(', ', path.map(print, 'arguments')));
            }
            return docBuilder.concat(parts);
        case 'WhileStatement':
            parts.push('while ');
            parts.push(path.call(print, 'condition'));
            parts.push(' do');
            parts.push(printDanglingStatementComment(path));
            if (node.body.length) {
                parts.push(printIndentedStatementList(path, tmp_options, print, 'body'));
            }
            parts.push(docBuilder.concat([docBuilder.hardline, 'end']));
            return docBuilder.concat(parts);
        case 'DoStatement':
            parts.push('do');
            parts.push(printDanglingStatementComment(path));
            if (node.body.length) {
                parts.push(printIndentedStatementList(path, tmp_options, print, 'body'));
            }
            parts.push(docBuilder.concat([docBuilder.hardline, 'end']));
            return docBuilder.concat(parts);
        case 'RepeatStatement':
            parts.push('repeat');
            parts.push(printDanglingStatementComment(path));
            if (node.body.length) {
                parts.push(printIndentedStatementList(path, tmp_options, print, 'body'));
            }
            parts.push(docBuilder.concat([docBuilder.hardline, 'until ']));
            parts.push(path.call(print, 'condition'));
            return docBuilder.concat(parts);
        case 'LocalStatement':
        case 'AssignmentStatement':
            {
                const left = [];
                if (node.type === 'LocalStatement') {
                    left.push('local ');
                }
                left.push(docBuilder.indent(docBuilder.join(docBuilder.concat([',', docBuilder.line]), path.map(print, 'variables'))));
                let operator = '';
                const right = [];
                if (node.init.length) {
                    operator = ' =';
                    right.push(docBuilder.join(docBuilder.concat([',', docBuilder.line]), path.map(print, 'init')));
                }
                const canBreakLine = node.init.some(n => n != null && n.type !== 'TableConstructorExpression');
                return docBuilder.group(docBuilder.concat([
                    docBuilder.concat(left),
                    docBuilder.group(docBuilder.concat([
                        operator,
                        canBreakLine ? docBuilder.indent(docBuilder.line) : ' ',
                        docBuilder.concat(right)
                    ]))
                ]));
            }
        case 'CallStatement':
            return path.call(print, 'expression');
        case 'FunctionDeclaration':
            if (node.isLocal) {
                parts.push('local ');
            }
            parts.push('function');
            if (node.identifier) {
                parts.push(' ', path.call(print, 'identifier'));
            }
            parts.push(docBuilder.concat([
                '(',
                docBuilder.group(docBuilder.indent(docBuilder.concat([
                    docBuilder.softline,
                    docBuilder.join(docBuilder.concat([',', docBuilder.line]), path.map(print, 'parameters'))
                ]))),
                ')'
            ]));
            parts.push(printDanglingStatementComment(path));
            if (node.body.length) {
                parts.push(printIndentedStatementList(path, tmp_options, print, 'body'));
            }
            parts.push(docBuilder.hardline, 'end');
            return docBuilder.concat(parts);
        case 'ForNumericStatement':
            parts.push('for ');
            parts.push(path.call(print, 'variable'));
            parts.push(' = ');
            parts.push(path.call(print, 'start'));
            parts.push(', ');
            parts.push(path.call(print, 'end'));
            if (node.step) {
                parts.push(', ');
                parts.push(path.call(print, 'step'));
            }
            parts.push(' do');
            parts.push(printDanglingStatementComment(path));
            if (node.body.length) {
                parts.push(printIndentedStatementList(path, tmp_options, print, 'body'));
            }
            parts.push(docBuilder.concat([docBuilder.hardline, 'end']));
            return docBuilder.concat(parts);
        case 'ForGenericStatement':
            parts.push('for ');
            parts.push(docBuilder.join(', ', path.map(print, 'variables')));
            parts.push(' in ');
            parts.push(docBuilder.join(', ', path.map(print, 'iterators')));
            parts.push(' do');
            parts.push(printDanglingStatementComment(path));
            if (node.body.length) {
                parts.push(printIndentedStatementList(path, tmp_options, print, 'body'));
            }
            parts.push(docBuilder.concat([docBuilder.hardline, 'end']));
            return docBuilder.concat(parts);
        case 'IfStatement':
            const printed = [];
            path.forEach((statementPath) => {
                printed.push(print(statementPath));
            }, 'clauses');
            parts.push(docBuilder.join(docBuilder.hardline, printed));
            parts.push(docBuilder.concat([docBuilder.hardline, 'end']));
            return docBuilder.concat(parts);
        case 'IfClause':
            parts.push(docBuilder.concat([
                'if ',
                docBuilder.group(docBuilder.concat([
                    docBuilder.indent(docBuilder.concat([
                        docBuilder.softline,
                        path.call(print, 'condition')
                    ])),
                    docBuilder.softline
                ])),
                ' then'
            ]));
            parts.push(printDanglingStatementComment(path));
            if (node.body.length) {
                parts.push(printIndentedStatementList(path, tmp_options, print, 'body'));
            }
            return docBuilder.concat(parts);
        case 'ElseifClause':
            parts.push(docBuilder.concat([
                'elseif ',
                docBuilder.group(docBuilder.concat([
                    docBuilder.indent(docBuilder.concat([
                        docBuilder.softline,
                        path.call(print, 'condition')
                    ])),
                    docBuilder.softline
                ])),
                ' then'
            ]));
            parts.push(printDanglingStatementComment(path));
            if (node.body.length) {
                parts.push(printIndentedStatementList(path, tmp_options, print, 'body'));
            }
            return docBuilder.concat(parts);
        case 'ElseClause':
            parts.push('else');
            parts.push(printDanglingStatementComment(path));
            if (node.body.length) {
                parts.push(printIndentedStatementList(path, tmp_options, print, 'body'));
            }
            return docBuilder.concat(parts);
        case 'BooleanLiteral':
            return node.raw;
        case 'NilLiteral':
            return 'nil';
        case 'NumericLiteral':
            return node.raw;
        case 'StringLiteral':
            return printStringLiteral(path, tmp_options);
        case 'VarargLiteral':
            return '...';
        case 'Identifier':
            return node.name;
        case 'BinaryExpression':
        case 'LogicalExpression':
            const parent = path.getParent();
            const shouldGroup = parent.type !== node.type &&
                node.left.type !== node.type &&
                node.right.type !== node.type;
            const right = docBuilder.concat([
                node.operator,
                docBuilder.line,
                path.call(print, 'right')
            ]);
            return docBuilder.group(docBuilder.concat([
                path.call(print, 'left'),
                docBuilder.indent(docBuilder.concat([
                    ' ', shouldGroup ? docBuilder.group(right) : right
                ]))
            ]));
        case 'UnaryExpression':
            parts.push(node.operator);
            if (node.operator === 'not') {
                parts.push(' ');
            }
            parts.push(path.call(print, 'argument'));
            return docBuilder.concat(parts);
        case 'MemberExpression':
            return docBuilder.concat([
                path.call(print, 'base'),
                node.indexer,
                path.call(print, 'identifier')
            ]);
        case 'IndexExpression':
            return docBuilder.concat([
                path.call(print, 'base'),
                '[',
                docBuilder.group(docBuilder.concat([
                    docBuilder.indent(docBuilder.concat([docBuilder.softline, path.call(print, 'index')])),
                    docBuilder.softline
                ])),
                ']'
            ]);
        case 'CallExpression':
            const printedCallExpressionArgs = path.map(print, 'arguments');
            return docBuilder.concat([
                path.call(print, 'base'),
                docBuilder.group(docBuilder.concat([
                    '(',
                    docBuilder.indent(docBuilder.concat([docBuilder.softline, docBuilder.join(docBuilder.concat([',', docBuilder.line]), printedCallExpressionArgs)])),
                    docBuilder.softline,
                    ')'
                ]), printedCallExpressionArgs.some(docUtils.willBreak))
            ]);
        case 'TableCallExpression':
            parts.push(path.call(print, 'base'));
            parts.push(' ');
            parts.push(path.call(print, 'arguments'));
            return docBuilder.concat(parts);
        case 'StringCallExpression':
            parts.push(path.call(print, 'base'));
            parts.push(' ');
            parts.push(path.call(print, 'argument'));
            return docBuilder.concat(parts);
        case 'TableConstructorExpression':
            if (node.fields.length === 0) {
                return '{}';
            }
            const fields = [];
            let separatorParts = [];
            path.forEach(childPath => {
                fields.push(docBuilder.concat(separatorParts));
                fields.push(docBuilder.group(print(childPath)));
                separatorParts = [',', docBuilder.line];
            }, 'fields');
            const shouldBreak = util.hasNewLineInRange(tmp_options.sourceText, node.range[0], node.range[1]);
            return docBuilder.group(docBuilder.concat([
                '{',
                docBuilder.indent(docBuilder.concat([docBuilder.softline, docBuilder.concat(fields)])),
                docBuilder.softline,
                '}'
            ]), shouldBreak);
        case 'TableKeyString':
            return docBuilder.concat([
                path.call(print, 'key'),
                ' = ',
                path.call(print, 'value')
            ]);
        case 'TableKey':
            return docBuilder.concat([
                '[', path.call(print, 'key'), ']',
                ' = ',
                path.call(print, 'value')
            ]);
        case 'TableValue':
            return path.call(print, 'value');
    }
    throw new Error('Unhandled AST node: ' + node.type);
}


let printNode = (path, tmp_options, print) => {
    const printed = printNodeNoParens(path, tmp_options, print);
    const parts = [];
    const needsParens = path.needsParens();
    if (needsParens) {
        parts.push('(');
    }
    parts.push(printed);
    if (needsParens) {
        parts.push(')');
    }
    return docBuilder.concat(parts);
}

export default {
    buildDocFromAst(ast, tmp_options) {
        const printNodeWithComments = (path) => {
            return comments.printComments(path, tmp_options, p => printNode(p, tmp_options, printNodeWithComments));
        };
        const doc = printNodeWithComments(new FastPath(ast));
        docUtils.propagateBreaks(doc);
        return doc;
    }
}
