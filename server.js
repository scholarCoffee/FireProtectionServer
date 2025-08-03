const express = require('express');
const app = express();
const cors = require('cors');
const ip = require('ip');
const ipAddress = ip.address();
const bodyParser = require('body-parser');
var jwt = require('./dao/jwt.js'); // 引入 jwt 模块

app.use(bodyParser.urlencoded({
    extended: true,
    limit: '50mb'
}));

app.use(bodyParser.json({
    limit: '50mb'
}));

// 注意：这里的 cors 是 Express 的跨域配置，与 Socket.IO 的 cors 是分开的
app.use(cors({
    origin: ['https://www.xiaobei.space', 'http://localhost:8080'],
    methods: ['GET', 'POST']
}));

app.use(express.static(__dirname + '/data'));

// 引入路由
require('./router/files.js')(app);
require('./router/index.js')(app);
require('./router/location.js')(app);

// token验证中间件
app.use((req, res, next) => {
    const { token } = req.body || {};
    if (typeof token !== 'undefined') {
        let tokenMatch = jwt.verifyToken(token);
        console.log('tokenMatch:', tokenMatch);
        if (tokenMatch.code !== 200) {
            return res.status(401).send('Unauthorized');
        }
    }
    next(); // 无论有无token，都继续执行后续中间件（原代码中重复调用了next()，已修正）
});

// 404页面
app.use((req, res) => {
    res.status(404).send('404 Not Found');
});

// 500错误处理
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('500 Server Error');
});
var server = app.listen(8002)
// // 只监听一个端口（推荐 3000，与 Nginx 转发配置匹配）
app.listen(3000, ipAddress, () => {
    console.log(`Server is running on http://${ipAddress}:3000`);
});
// 配置 Socket.IO（绑定到上面创建的 server 实例）
const io = require('socket.io')(server, {
    cors: {
        origin: ['https://www.xiaobei.space', 'http://localhost:8080'], // 与前端域名一致
        methods: ['GET', 'POST'],
        credentials: true // 可选，根据需要开启
    }
});

// 引入 Socket.IO 处理逻辑
require('./dao/socket.js')(io);
console.log('IP Address:', ipAddress);

// const express = require('express');
// const app = express();
// const cors = require('cors');
// const ip = require('ip');
// const ipAddress = ip.address();
// const bodyParser = require('body-parser');
// var jwt = require('./dao/jwt.js'); // 引入 jwt 模块

// // 只监听一个端口（推荐 3000，与 Nginx 转发配置匹配）
// var server = app.listen(3000, ipAddress, () => {
//     console.log(`Server is running on http://${ipAddress}:3000`);
// });

// app.use(bodyParser.urlencoded({
//     extended: true,
//     limit: '50mb'
// }));

// app.use(bodyParser.json({
//     limit: '50mb'
// }));

// // 注意：这里的 cors 是 Express 的跨域配置，与 Socket.IO 的 cors 是分开的
// app.use(cors({
//     origin: ['https://www.xiaobei.space', 'http://localhost:8080'],
//     methods: ['GET', 'POST']
// }));

// app.use(express.static(__dirname + '/data'));

// // 引入路由
// require('./router/files.js')(app);
// require('./router/index.js')(app);
// require('./router/location.js')(app);

// // token验证中间件
// app.use((req, res, next) => {
//     const { token } = req.body || {};
//     if (typeof token !== 'undefined') {
//         let tokenMatch = jwt.verifyToken(token);
//         console.log('tokenMatch:', tokenMatch);
//         if (tokenMatch.code !== 200) {
//             return res.status(401).send('Unauthorized');
//         }
//     }
//     next(); // 无论有无token，都继续执行后续中间件（原代码中重复调用了next()，已修正）
// });

// // 404页面
// app.use((req, res) => {
//     res.status(404).send('404 Not Found');
// });

// // 500错误处理
// app.use((err, req, res, next) => {
//     console.error(err.stack);
//     res.status(500).send('500 Server Error');
// });

// // 配置 Socket.IO（绑定到上面创建的 server 实例）
// const io = require('socket.io')(server, {
//     cors: {
//         origin: ['https://www.xiaobei.space', 'http://localhost:8080'], // 与前端域名一致
//         methods: ['GET', 'POST'],
//         credentials: true // 可选，根据需要开启
//     }
// });

// // 引入 Socket.IO 处理逻辑
// require('./dao/socket.js')(io);

// console.log('IP Address:', ipAddress);