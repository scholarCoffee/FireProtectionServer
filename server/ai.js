const dbServer = require('../dao/dbserver.js'); // 引入数据操作模块

// AI 对话接口
const chat = function (req, res) {
    dbServer.chat(req, res); // 调用 AI 对话函数
}

module.exports = {
    chat
}

