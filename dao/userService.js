var dbmodel = require('../model/index.js'); // 引入数据模型
var bcrypt = require('./bcrypt.js'); // 引入 bcrypt 模块
var User = dbmodel.model('User'); // 引入用户模型
var jwt = require('./jwt.js'); // 引入 jwt 模块

// 新建用户
exports.buildUser = function (name, mail, pwd, res) {
    var salt = bcrypt.encryption(pwd); // 加密密码
    var data = new User({
        name: name,
        email: mail,
        pwd: salt,
        time: new Date(), // 注册时间
    });
    let user = new User(data)
    user.save()
    .then(result => {
        console.log('注册成功！'); // 打印成功信息
        res.send({
            code: 200,
            msg: '注册成功！',
            data: result // 返回注册成功的用户数据
        }); // 返回成功信息给前端
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('注册失败！'); // 返回失败信息给前端
    });
}

// 匹配用户表元素个数
exports.countUserValue = function (data, type, res) {
    let wherestr = {}
    wherestr[type] = data
    User.countDocuments(wherestr)
    .then(count => {
        console.log('匹配用户查询成功！'); // 打印成功信息
        res.send({
            code: 200,
            msg: '匹配用户查询成功！',
            data: count // 返回查询到的元素个数
        }); // 返回成功信息给前端
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('匹配用户查询失败！'); // 返回失败信息给前端
    });
}

// 修改用户密码
exports.updateUserPwd = function (data, res) {
    const { name, pwd } = data // 解构获取请求体中的数据
    let wherestr = {
        'name': name // 用户ID
    }
    let updatestr = {
        'pwd': bcrypt.encryption(pwd) // 加密密码
    }
    User.findByIdAndUpdate(wherestr, updatestr, { new: true }) // 更新用户密码
    .then(result => {
        console.log('密码修改成功！'); // 打印成功信息
        res.send({
            code: 200,
            msg: '密码修改成功！',
            data: result // 返回更新后的用户数据
        }); // 返回成功信息给前端
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('密码修改失败！'); // 返回失败信息给前端
    });
}

// 用户验证
exports.userMatch = function (req, res) {
    const { name, pwd } = req || {} // 解构获取请求体中的数据
    let wherestr = {
        $or: [
            { 'name': name }, // 用户名
            { 'email': name } // 邮箱
        ]
    }
    let out = {
        'name': 1,
        'imgurl': 1,
        'pwd':1 
    }
    console.log('查询条件:', wherestr); // 打印查询条件
    console.log('查询输出:', out); // 打印查询输出
    User.find(wherestr, out)
    .then(result => {
        console.log('查询成功！', result); // 打印成功信息
        if (result?.length > 0) {
            result.map(item => {
                const pwdMatch = bcrypt.verification(pwd, item.pwd); // 验证密码
                if (pwdMatch) {
                    console.log('密码匹配成功！'); // 打印成功信息
                    let token = jwt.generateToken(item._id); // 生成token
                    let back = {
                        name: item.name,
                        imgurl: item.imgurl,
                        token: token, // 返回token
                        id: item._id // 返回用户ID
                    }
                    res.send({
                        code: 200,
                        msg: '登录成功！',
                        data: back // 返回登录成功的用户数据
                    }); // 返回成功信息给前端
                } else {
                    console.log('密码匹配失败！'); // 打印失败信息
                    res.send({
                        code: 400,
                        msg: '密码错误！'
                    }); // 返回失败信息给前端
                }
            })  
        } else {
            console.log('用户不存在！'); // 打印失败信息
            res.send({
                code: 300,
                msg: '用户不存在！'
            }); // 返回失败信息给前端
        }
    })
}  

// 搜索用户
exports.searchUser = function (body, res) {
    const { data } = body || {} // 解构获取请求体中的数据
    let wherestr = {
        $or: [
            { 'name': { $regex: data } }, // 用户名模糊查询
            { 'email': { $regex: data } } // 邮箱模糊查询
        ]
    }
    let out = {
        'name': 1,
        'email': 1,
        'imgurl': 1
    }
    User.find(wherestr, out)
    .then(result => {
        console.log('查询成功！'); // 打印成功信息
        res.send({
            code: 200,
            msg: '查询成功！',
            data: result // 返回查询到的用户数据
        }); // 返回成功信息给前端
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('查询失败！'); // 返回失败信息给前端
    });
}

// 用户详情
exports.userDetail = function (uid, res) {
    let wherestr = {
        '_id': uid // 用户ID
    }
    let out = {
        'pwd': 0, // 不返回密码
    }
    User.findOne(wherestr, out)
    .then(result => {
        console.log('查询成功！'); // 打印成功信息
        res.send({
            code: 200,
            msg: '查询成功！',
            data: result // 返回查询到的用户数据
        }); // 返回成功信息给前端
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('查询失败！'); // 返回失败信息给前端
    });
}

function update(uId, toData, res) {
    console.log('更新数据uId:', uId)
    console.log('更新目标数据：', toData)
    User.findByIdAndUpdate(uId, toData, { new: true }) // 更新用户信息
    .then(result => {
        // console.log('更新成功！', result); // 打印成功信息
        res.send({
            code: 200,
            msg: '更新成功！',
            data: result // 返回更新后的用户数据
        }); // 返回成功信息给前端
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('更新失败！'); // 返回失败信息给前端
    });
}

// 用户信息修改
exports.userUpdate = function (req, res) {
    let updatestr = {}
    const { pwd, uid, type, data } = req // 解构获取请求体中的数据
    // 判断是否有密码
    if (typeof pwd !== 'undefined') {
        User.find({
            '_id': uid // 用户ID
        }, {
            'pwd': 1 // 只查询密码
        })
        .then(result => {
            console.log('查询成功: ', result); // 打印成功信息
            result.map(item => {
                const pwdMatch = bcrypt.verification(pwd, item.pwd); // 验证密码
                if (pwdMatch) {
                    console.log('密码匹配成功！'); // 打印成功信息
                    // 如果修改密码需加密
                    if (type === 'pwd') {
                        updatestr[type] = bcrypt.encryption(data); // 加密密码
                        console.log('更新数据:', updatestr); // 打印更新数据
                        update(uid, updatestr, res) // 调用更新函数
                    } else {
                        updatestr[type] = data // 其他字段直接赋值
                        User.countDocuments(updatestr) // 查询是否有重复数据
                        .then(count => {
                            console.log('查询成功！'); // 打印成功信息
                            if (count === 0) {
                                update(uid, updatestr, res) // 调用更新函数
                            } else {
                                
                                res.send({
                                    code: 300,
                                    msg: '数据已存在！'
                                }); // 返回失败信息给前端
                            }
                        })
                        .catch(err => {
                            console.log(err); // 打印错误信息
                            res.send('查询失败！'); // 返回失败信息给前端
                        });
                    }
                } else {
                    console.log('密码匹配失败！'); // 打印失败信息
                    res.send({
                        code: 400,
                        msg: '密码错误！'
                    }); // 返回失败信息给前端
                }
            })
        })
    } else if(type === 'name') {
        updatestr[type] = data // 其他字段直接赋值
        User.countDocuments(updatestr) // 查询是否有重复数据
        .then(count => {
            console.log('查询成功！'); // 打印成功信息
            if (count === 0) {
                update(uid, updatestr, res) // 调用更新函数
            } else {
                res.send({
                    code: 300,
                    msg: '数据已存在！'
                }); // 返回失败信息给前端
            }
        })
        .catch(err => {
            console.log(err); // 打印错误信息
            res.send('查询失败！'); // 返回失败信息给前端
        });
    } else {
        updatestr[type] = data
        update(uid, updatestr, res) // 调用更新函数
    }
} 