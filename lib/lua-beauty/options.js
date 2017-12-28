'use babel';

var WriteMode;

((WriteMode)=>{
    WriteMode["StdOut"] = "stdout";
    WriteMode["Replace"] = "replace";
    WriteMode["Diff"] = "diff";
})(WriteMode = WriteMode || {});

let defaultOptions = {
    sourceText: '',
    lineWidth: 120,
    indentCount: 4,
    useTabs: false,
    quotemark: 'double',
    writeMode: WriteMode.StdOut
};

export default {
    WriteMode,
    defaultOptions,

    getStringQuotemark(quotemark) {
        return quotemark === 'single' ? '\'' : '"';
    },

    getAlternativeStringQuotemark(quotemark) {
        return quotemark === 'single' ? '"' : '\'';
    }
}
