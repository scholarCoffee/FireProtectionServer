const express = require('express');
const app = express();
const cors = require('cors');
const ip = require('ip');
const ipAddress = ip.address();
const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({
    extended: true,
    limit: '50mb'
}));

app.use(bodyParser.json({
    limit: '50mb'
}));

// 注意：这里的 cors 是 Express 的跨域配置，与 Socket.IO 的 cors 是分开的
app.use(cors({
    origin: ['https://xiaobei.space', 'https://www.xiaobei.space', 'http://localhost:8080'],
    methods: ['GET', 'POST'],
    credentials: true  // 新增：WebSocket 跨域可能需要携带凭证，建议开启
}));

// 修改后：仅非/vr/路径使用static中间件
app.use((req, res, next) => {
    if (req.path.startsWith('/vr/')) {
      console.log('跳过static中间件，交给Nginx代理');
      // 跳过static中间件，交给Nginx代理
      next();
    } else {
      // 其他路径正常使用static
      express.static(__dirname + '/data')(req, res, next);
    }
});

// 引入路由
require('./router/files.js')(app);
require('./router/index.js')(app);

// 404页面
app.use((req, res) => {
    res.status(404).send('404 Not Found');
});

// 500错误处理
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('500 Server Error');
});
// 只监听一个端口（推荐 3000，与 Nginx 转发配置匹配）
var server = app.listen(3000, ipAddress, () => {
    console.log(`Server is running on http://${ipAddress}:3000`);
});

// 配置 Socket.IO（绑定到上面创建的 server 实例）
const io = require('socket.io')(server, {
    cors: {
        origin: [
            'https://xiaobei.space', 
            'https://www.xiaobei.space', 
            'http://localhost:8080',
            'wss://www.xiaobei.space'  // 增加wss协议支持
        ],
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"]
    },
    // 增加对小程序的支持
    allowEIO3: true,  // 确保与客户端版本兼容
    transports: ['websocket']  // 小程序只支持websocket
});

// 引入 Socket.IO 处理逻辑
require('./dao/socket.js')(io);
console.log('IP Address:', ipAddress);