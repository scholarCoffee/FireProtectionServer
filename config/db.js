const mongoose = require('mongoose');
// const dbUrl = 'mongodb://localhost:27017/xuzc';
const dbUrl = 'mongodb://chat:123456@47.97.7.181:27017/chat';
const db = mongoose.createConnection(dbUrl);

db.on('error', function (err) {
    console.error('数据库连接失败：', err);
});

db.once('open', function () {
    console.log('数据库连接成功！');
});

module.exports = db;