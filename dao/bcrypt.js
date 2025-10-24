const bcrypt = require('bcryptjs')

exports.encryption = function (password) {
    console.log('输入的密码:', password) 
    // 生成盐值
    const salt = bcrypt.genSaltSync(10)
    // 使用盐值加密密码
    var hash = bcrypt.hashSync(password, salt)
    console.log('加密后的密码:', hash)
    return hash
}

exports.verification = function (password, hash) {
    // 验证密码是否匹配
    const match = bcrypt.compareSync(password, hash)
    // 返回验证结果
    return match; 
}

