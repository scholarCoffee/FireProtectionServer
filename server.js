// const express = require('express');
// const https = require('https');
// const fs = require('fs');
// const cors = require('cors');
// const ip = require('ip');
// const bodyParser = require('body-parser');
// const jwt = require('./dao/jwt.js'); // 引入 jwt 模块

// const app = express();
// const port = 443; // HTTPS 默认端口
// const ipAddress = ip.address();

// // 配置 CORS
// app.use(cors());

// // 解析请求体
// app.use(bodyParser.urlencoded({
//     extended: true,
//     limit: '50mb'
// }));

// app.use(bodyParser.json({
//     limit: '50mb'
// }));

// // 静态文件服务
// app.use(express.static(__dirname + '/data'));

// // 引入路由
// require('./router/files.js')(app);
// require('./router/index.js')(app);

// // Token 验证中间件 (调整了逻辑，现在会检查所有请求的 headers 和 body 中的 token)
// app.use((req, res, next) => {
//     // 排除不需要验证的路径
//     const excludedPaths = ['/login', '/register'];
//     if (excludedPaths.some(path => req.path.includes(path))) {
//         return next();
//     }

//     // 从 header 或 body 中获取 token
//     const token = req.headers['authorization'] || (req.body ? req.body.token : undefined);
    
//     if (token) {
//         // 移除 Bearer 前缀
//         const cleanToken = token.replace('Bearer ', '');
//         let tokenMatch = jwt.verifyToken(cleanToken);
        
//         if (tokenMatch.code !== 200) {
//             return res.status(401).json({ error: 'Unauthorized' });
//         }
        
//         // 将用户信息添加到请求对象中，供后续路由使用
//         req.user = tokenMatch.data;
//         next();
//     } else {
//         return res.status(401).json({ error: 'Token required' });
//     }
// });

// // 错误处理
// app.use((req, res) => {
//     res.status(404).send('404 Not Found');
// });

// app.use((err, req, res, next) => {
//     console.error(err.stack);
//     res.status(500).send('500 Server Error');
// });

// // 配置 SSL 证书路径 (需要替换为你自己的证书路径)
// const options = {
//     key: fs.readFileSync('/path/xiaobei.space.key'),
//     cert: fs.readFileSync('/path/xiaobei.space.pem')
// };

// // 创建 HTTPS 服务器
// const server = https.createServer(options, app);

// // 配置 Socket.IO
// const io = require('socket.io')(server, {
//     cors: {
//         origin: '*', // 在生产环境中应限制为你的前端域名
//         methods: ['GET', 'POST']
//     }
// });

// // 引入 Socket.IO 处理逻辑
// require('./dao/socket.js')(io);

// // 启动服务器
// server.listen(port, () => {
//     console.log(`Server running on https://${ipAddress}:${port}`);
//     console.log(`HTTPS is enabled with SSL certificate`);
// });
const express = require('express');
const app = express();
const cors = require('cors');
const ip = require('ip');
const ipAddress = ip.address();
const bodyParser = require('body-parser');
var jwt = require('./dao/jwt.js'); // 引入 jwt 模块
var server = app.listen(8002)
var io = require('socket.io')(server)
require('./dao/socket.js')(io)
app.use(bodyParser.urlencoded({
    extended: true,
    limit: '50mb' // 设置请求体大小限制为 50mb
}));

app.use(bodyParser.json({
    limit: '50mb' // 设置请求体大小限制为 50mb
}));
app.use(cors());
app.use(express.static(__dirname + '/data'));

require('./router/files.js')(app); // 引入文件上传路由模块
require('./router/index.js')(app); // 引入路由模块
require('./router/location.js')(app); // 引入地址信息路由模块

// token判断
app.use((req, res, next) => {
    const { token } = req.body || {} 
    if (typeof token !== 'undefined') {
        let tokenMatch = jwt.verifyToken(token); // 验证token
        console.log('tokenMatch:', tokenMatch); // 打印token验证结果
        if (tokenMatch.code !== 200) {
            return res.status(401).send('Unauthorized'); // 如果token不合法，返回401错误
        }
    } else {
        next()
    }
    // 这里可以添加token验证逻辑
    // if (!req.headers['authorization']) {
    //     return res.status(401).send('Unauthorized');
    // }
    next();
});

// 404页面
app.use((req, res) => {
    res.status(404).send('404 Not Found');
});
// 500页面
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('500 Server Error');
});

console.log('IP Address:', ipAddress);
app.listen(3000, ipAddress, () => {
    console.log(`Server is running on http://${ipAddress}:3000`);
});
