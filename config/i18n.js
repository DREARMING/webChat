/**
 * 通用字符与国际化配置
 * common 通用字符
 * zh 中文
 * en 英文
 */
const common = {
    author: "ilongli(李隆威)",
    separator: "****************************************",
};

const zh = {
    author: "作者：",
    hello: "欢迎使用CREATOR天誉创高NodeJS在线聊天服务器。",
    waiting: "正在等待接入...",
};

const en = {
    author: "author:",
    hello: "Welcome to CREATOR NodeJS online chat server.",
};

/**
 * 根据传入的国际化键值，返回对应的文本
 * @param language
 * @returns {*}
 */
const build = (language) => {
    switch (language) {
        case "zh":
            return zh;
        case "en":
            return en;
        default:
            return zh;
    }
};

module.exports.build = build;
module.exports.common = common;
module.exports.zh = zh;
module.exports.en = en;