const multer = require('multer');
const mkdir = require('../dao/mkdir.js'); // 引入创建目录模块

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const { url } = req.body || {}; // 解构获取请求体中的数据
        mkdir.mkdirs('../data/' + url, err => {
            console.log('err:', err); // 打印创建目录结果
        }); // 创建目录
        console.log('文件上传目录:', './data/' + url); // 打印文件上传目录
        cb(null, './data/' + url); // 设置文件上传目录
    },
    filename: function (req, file, cb) {
        const { name } = req.body || {}; // 解构获取请求体中的数据
        const type = file.originalname.replace(/.+\./, '.'); // 获取文件类型
        console.log('文件类型:', type); // 打印文件类型
        console.log('文件上传:', file); // 打印文件信息
        console.log('文件名:', name); // 打印文件名
        // 获取文件扩展名
        cb(null,  name + type); // 设置文件名
    }
});

const upload = multer({ storage: storage });

module.exports = function (app) {
    // 上传文件接口
    app.post('/files/upload', upload.array('file', 10), function (req, res, next) {
        console.log('文件上传请求接收:', req.files); // 打印请求体
        const { filename }  = req.files[0]
        let url = req.body.url || ''; // 获取请求体中的url参数
        const resultFile =  url + '/' + filename
        // 契约：统一 { code: 200, data: string, msg }
        res.send({ code: 200, msg: 'ok', data: resultFile });
    });
}