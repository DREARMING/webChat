const i18n = require('./config/i18n');
const config = require('./config/config');
const msg = i18n.build(config.language);

const hello = () => {
    console.log(i18n.common.separator);
    console.log("*" + msg.hello);
    console.log("*" + msg.author + i18n.common.author);
    console.log(i18n.common.separator);
}

module.exports = hello;