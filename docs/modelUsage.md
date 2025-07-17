# 数据库模型使用说明

## 概述
项目采用统一的模型管理方式，所有数据库模型都在 `model/index.js` 中定义和管理。

## 模型列表

### 1. 用户相关模型
- **User**: 用户信息表
- **Friend**: 好友关系表
- **Message**: 一对一消息表

### 2. 群组相关模型
- **Group**: 群组表
- **GroupUser**: 群成员表
- **GroupMessage**: 群消息表

### 3. 消防系统模型
- **Location**: 地址信息表

## 使用方式

### 方式一：使用 model() 方法（推荐）
```javascript
const dbmodel = require('../model/index.js');

// 获取用户模型
const User = dbmodel.model('User');

// 获取地址模型
const Location = dbmodel.model('Location');

// 使用模型
const users = await User.find();
const locations = await Location.find();
```

### 方式二：直接引用模型
```javascript
const { User, Location, Friend } = require('../model/index.js');

// 直接使用
const users = await User.find();
const locations = await Location.find();
```

## 模型字段说明

### User 模型
```javascript
{
    name: String,        // 用户名（必填）
    pwd: String,         // 密码（必填）
    email: String,       // 邮箱（必填，唯一）
    sex: String,         // 性别（默认：asexual）
    birth: Date,         // 生日
    phone: Number,       // 手机号
    explain: String,     // 个人说明
    imgurl: String,      // 头像地址（默认：/user/user.png）
    register: Date,      // 注册时间
    updateTime: Date     // 更新时间
}
```

### Friend 模型
```javascript
{
    userID: ObjectId,    // 用户ID（必填，关联User）
    friendID: ObjectId,  // 好友ID（必填，关联User）
    markname: String,    // 好友昵称
    state: Number,       // 好友状态（必填）
    time: Date,          // 生成时间
    lastTime: Date       // 最后聊天时间
}
```

### Message 模型
```javascript
{
    userID: ObjectId,    // 用户ID（必填，关联User）
    friendID: ObjectId,  // 好友ID（必填，关联User）
    message: String,     // 消息内容（必填）
    types: Number,       // 消息类型（默认：0）
    time: Date,          // 发送时间
    state: Number        // 消息状态（默认：1）
}
```

### Group 模型
```javascript
{
    userID: ObjectId,    // 创建者ID（必填，关联User）
    name: String,        // 群名称（必填）
    markname: String,    // 群备注名
    imgurl: String,      // 群头像地址（默认：/group/group.png）
    time: Date,          // 创建时间
    notice: String,      // 群公告
    updateTime: Date     // 更新时间
}
```

### GroupUser 模型
```javascript
{
    groupID: ObjectId,   // 群ID（必填，关联Group）
    userID: ObjectId,    // 用户ID（必填，关联User）
    name: String,        // 群内昵称
    state: Number,       // 消息状态（默认：1）
    time: Date,          // 加入时间
    lastTime: Date,      // 最后聊天时间
    shield: Number       // 是否屏蔽（默认：0）
}
```

### GroupMessage 模型
```javascript
{
    groupID: ObjectId,   // 群ID（必填，关联Group）
    userID: ObjectId,    // 用户ID（必填，关联User）
    message: String,     // 消息内容（必填）
    types: Number,       // 消息类型（默认：0）
    time: Date           // 发送时间
}
```

### Location 模型
```javascript
{
    addressId: String,       // 地址ID（必填，唯一）
    addressName: String,     // 地址名称（必填）
    addressExt: String,      // 详细地址（必填）
    allSenceLink: String,    // 全景链接
    type: Number,            // 单位类型（必填）
    safeLevelId: Number,     // 安全等级ID（必填）
    safeLevelName: String,   // 安全等级名称（必填）
    safeLevelDesc: String,   // 安全等级描述（必填）
    phoneList: Array,        // 联系电话列表
    enterGateList: Array,    // 进出口列表
    createTime: Date,        // 创建时间
    updateTime: Date         // 更新时间
}
```

## 数据字典

### 好友状态（Friend.state）
- 0: 已为好友
- 1: 申请中
- 2: 申请发送对方，对方未同意

### 消息类型（Message.types / GroupMessage.types）
- 0: 文本
- 1: 图片
- 2: 音频连接
- 3: 位置

### 消息状态（Message.state / GroupUser.state）
- 0: 已读
- 1: 未读

### 屏蔽状态（GroupUser.shield）
- 0: 不屏蔽
- 1: 屏蔽

### 单位类型（Location.type）
- 1: 高层小区
- 2: 重点单位
- 3: 沿街商铺

### 安全等级（Location.safeLevelId）
- 1: 优秀
- 2: 良好
- 3: 一般
- 4: 较差

### 联系人类型（Location.phoneList.type）
- 1: 单位负责人
- 2: 消防负责人

### 进出口类型（Location.enterGateList.type）
- 1: 东门
- 2: 南门
- 3: 西门
- 4: 北门

## 中间件功能

所有模型都包含自动更新时间中间件：
- **User**: 保存时自动更新 `updateTime`
- **Group**: 保存时自动更新 `updateTime`
- **Location**: 保存时自动更新 `updateTime`

## 使用示例

### 创建用户
```javascript
const User = dbmodel.model('User');
const newUser = new User({
    name: '张三',
    pwd: 'hashedPassword',
    email: 'zhangsan@example.com'
});
await newUser.save();
```

### 查询地址信息
```javascript
const Location = dbmodel.model('Location');
const locations = await Location.find({
    type: 1,
    safeLevelId: { $gte: 2 }
}).sort({ createTime: -1 });
```

### 关联查询
```javascript
const Friend = dbmodel.model('Friend');
const friends = await Friend.find({ userID: userId })
    .populate('friendID')
    .sort({ lastTime: -1 });
```

## 注意事项

1. **必填字段**: 所有标记为 `required: true` 的字段在创建时必须提供
2. **唯一字段**: `User.email` 和 `Location.addressId` 为唯一字段
3. **关联关系**: 使用 `populate()` 方法可以获取关联的完整数据
4. **时间字段**: 创建时间和更新时间会自动处理
5. **数据验证**: 模型层包含基本的数据验证规则 