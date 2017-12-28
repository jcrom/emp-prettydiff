'use babel';

let line = {
        type: 'line',
        hard: false,
        soft: false
    },
    hardline = {
        type: 'line',
        hard: true,
        soft: false
    },
    softline = {
        type: 'line',
        hard: false,
        soft: true
    },
    breakParent = {
        type: 'breakParent'
    };

let concat = (parts) =>{
    return {
        type: 'concat',
        parts
    };
};

export default {
    line,
    hardline,
    softline,
    breakParent,
    concat,


    join(separator, parts) {
        const result = [];
        parts.forEach((val, i) => {
            if (i > 0) {
                result.push(separator);
            }
            result.push(val);
        });
        return concat(result);
    },

    indent(content) {
        return {
            type: 'indent',
            content
        };
    },

    lineSuffix(content) {
        return {
            type: 'lineSuffix',
            content
        };
    },

    group(content, willBreak = false) {
        return {
            type: 'group',
            content,
            willBreak
        };
    },
    isEmpty(instruction) {
        return typeof (instruction) === 'string' && instruction.length === 0;
    }
}
