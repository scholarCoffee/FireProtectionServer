var jwt = require('jsonwebtoken');
let secret = 'chatRoomuniapp'

exports.generateToken = function (id, res) {
    let payload = {
        id: id, // 用户ID
        time: new Date() // 当前时间
    };

    let token = jwt.sign(payload, secret, { expiresIn: 60 * 60 * 24 * 120 }); // 生成token，过期时间为1小时
    return token
}

exports.verifyToken = function (e) {
    let payload = 0
    jwt.verify(e, secret, function (err, decoded) {
        if (err) {
            console.log('token验证失败:', err); // 打印错误信息
            payload = 0 // token验证失败
        } else {
            console.log('token验证成功:', decoded); // 打印成功信息
            payload = 1 // token验证成功，返回解码后的数据
        }
    })
    return payload
}