const fs = require('fs');
const path = require('path');

exports.mkdirs = function (pathname, callback) {
    console.log('创建目录:', pathname); // 打印要创建的目录路径
    // 获取当前工作目录
    pathname = path.isAbsolute(pathname) ? pathname : path.join(__dirname, pathname);
    pathname = path.relative(__dirname, pathname);
    let floader = pathname.split(path.sep);
    let pre = ''
    floader.forEach(item => {
        try {
            let _stat = fs.statSync(path.join(__dirname, pre, item)); // 获取目录状态
            let hasMkdir = _stat && _stat.isDirectory(); // 判断是否为目录
            if (!hasMkdir) {
                callback && callback(); // 调用回调函数
            }
        } catch (error) {
            try {
                fs.mkdirSync(path.join(__dirname, pre, item)); // 创建目录
                callback && callback(); // 调用回调函数
            } catch (error) {
                callback && callback(error); // 调用回调函数
            }
        }
        pre = path.join(pre, item); // 更新前缀路径
    })
}