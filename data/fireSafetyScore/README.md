# 单位消防安全三色评分表系统 v2.0

## 系统概述

这是一个**动态配置**的消防安全评分系统，支持灵活的评分项目配置，无需修改数据库表结构即可添加新的评分项目。

### 主要特性

- ✅ **动态评分项目**：通过配置文件定义评分项目，无需修改数据库结构
- ✅ **灵活评分规则**：支持二选项和三选项评分，可自定义分数权重
- ✅ **分类管理**：评分项目按类别分组，便于管理
- ✅ **版本控制**：支持评分配置版本管理
- ✅ **数据验证**：自动验证评分数据的有效性
- ✅ **批量导入**：支持批量导入评分数据
- ✅ **CSS样式支持**：提供完整的CSS样式文件

## 数据模型

### FireSafetyScore Schema (动态字段设计)

```javascript
{
  safeId: String,                    // 关联safeId (唯一标识)
  addressId: String,                 // 关联地址ID
  addressName: String,               // 地址名称
  
  // 动态评分项目 - 使用Map存储，支持任意评分项
  scoreItems: {
    type: Map,
    of: {
      score: Number,                 // 得分
      option: String,                // 选择的选项文本
      itemId: String                 // 评分项ID
    }
  },
  
  // 计算结果
  totalScore: Number,                // 总分
  maxPossibleScore: Number,          // 最高可能分数
  scorePercentage: Number,           // 得分百分比
  
  // 安全等级信息
  safetyLevel: String,               // 安全等级
  safetyColor: String,               // 安全颜色
  safetyCssClass: String,            // CSS类名
  safetyCssColor: String,            // CSS颜色值
  
  // 评分配置版本
  configVersion: String,             // 配置版本号
  
  // 时间戳
  createTime: Date,
  updateTime: Date
}
```

## 配置文件结构

### scoreConfig.json

```json
{
  "configVersion": "1.0.0",
  "configName": "单位消防安全三色评分表",
  "description": "动态配置的消防安全评分系统",
  "scoreConfig": {
    "maxScore": 100,
    "safetyLevels": [
      {
        "level": "优秀",
        "color": "绿色",
        "cssClass": "safety-excellent",
        "cssColor": "#52c41a",
        "minScore": 80,
        "maxScore": 100,
        "minPercentage": 80
      }
    ]
  },
  "scoreItems": [
    {
      "id": "naturalWaterSource",
      "name": "单位周边100m范围内有无天然水源",
      "type": "binary",
      "weight": 10,
      "category": "水源配置",
      "description": "检查单位周边100米范围内是否有河流、湖泊等天然水源",
      "options": [
        {
          "text": "有",
          "score": 10,
          "value": "yes"
        },
        {
          "text": "无",
          "score": 0,
          "value": "no"
        }
      ]
    }
  ],
  "categories": [
    {
      "id": "waterSource",
      "name": "水源配置",
      "description": "天然水源和消火栓配置"
    }
  ]
}
```

## 评分规则

### 评分标准
- **二选项题目**：有/无，是/否 → 10分/0分
- **三选项题目**：最佳/一般/最差 → 10分/5分/0分

### 等级划分
- **优秀（绿色）**：80-100分
  - CSS类名：`safety-excellent`
  - CSS颜色：`#52c41a`
- **一般（黄色）**：60-79分  
  - CSS类名：`safety-normal`
  - CSS颜色：`#faad14`
- **较差（红色）**：0-59分
  - CSS类名：`safety-poor`
  - CSS颜色：`#ff4d4f`

## API接口

### 基础接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/fireSafetyScore/list` | 获取评分列表 |
| GET | `/fireSafetyScore/detail` | 获取评分详情 |
| GET | `/fireSafetyScore/config` | 获取评分配置 |
| GET | `/fireSafetyScore/stats` | 获取统计信息 |
| POST | `/fireSafetyScore/add` | 新增评分 |
| PUT | `/fireSafetyScore/update/:safeId` | 更新评分 |
| DELETE | `/fireSafetyScore/delete/:safeId` | 删除评分 |

### 批量导入接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/fireSafetyScore/batch-import` | 批量导入评分数据 |

### 请求示例

#### 新增评分
```javascript
POST /fireSafetyScore/add
Content-Type: application/json

{
  "safeId": "SAFE001",
  "addressId": "123456",
  "addressName": "江苏省苏州市工业园区东方之门",
  "scoreItems": {
    "naturalWaterSource": {
      "score": 10,
      "option": "有",
      "itemId": "naturalWaterSource"
    },
    "outdoorHydrant": {
      "score": 10,
      "option": "有",
      "itemId": "outdoorHydrant"
    }
  }
}
```

#### 批量导入
```javascript
POST /fireSafetyScore/batch-import
Content-Type: application/json

{
  "scores": [
    {
      "safeId": "SAFE001",
      "addressId": "123456",
      "addressName": "江苏省苏州市工业园区东方之门",
      "scoreItems": {
        "naturalWaterSource": {
          "score": 10,
          "option": "有",
          "itemId": "naturalWaterSource"
        }
      }
    }
  ]
}
```

## 数据导入

### 方法一：使用转换工具

1. 运行数据转换工具：
```bash
node data/fireSafetyScore/import-tool.js
```

2. 工具会生成以下文件：
   - `fireSafetyScore-converted.json`: 转换后的完整数据
   - `import-script.js`: MongoDB导入脚本
   - `api-examples.json`: API调用示例
   - `batch-import-data.json`: 批量导入数据

### 方法二：直接使用API

1. 使用批量导入API：
```bash
curl -X POST http://localhost:3000/fireSafetyScore/batch-import \
  -H "Content-Type: application/json" \
  -d @data/fireSafetyScore/batch-import-data.json
```

### 方法三：MongoDB脚本

1. 将生成的 `import-script.js` 内容复制到MongoDB Compass中执行

## 添加新评分项目

### 步骤1：修改配置文件

在 `scoreConfig.json` 的 `scoreItems` 数组中添加新项目：

```json
{
  "id": "newItem",
  "name": "新的评分项目",
  "type": "ternary",
  "weight": 10,
  "category": "新分类",
  "description": "项目描述",
  "options": [
    {
      "text": "选项1",
      "score": 10,
      "value": "option1"
    },
    {
      "text": "选项2", 
      "score": 5,
      "value": "option2"
    },
    {
      "text": "选项3",
      "score": 0,
      "value": "option3"
    }
  ]
}
```

### 步骤2：更新配置版本

修改 `configVersion` 字段，例如从 `"1.0.0"` 改为 `"1.1.0"`

### 步骤3：重新计算现有数据

系统会自动根据新配置重新计算现有数据的评分等级

## 文件结构

```
data/fireSafetyScore/
├── scoreConfig.json              # 评分配置
├── fireSafetyScore.json          # 假数据
├── fireSafetyScore-converted.json # 转换后的数据
├── import-tool.js                # 数据转换工具
├── import-script.js              # MongoDB导入脚本
├── api-examples.json             # API调用示例
├── batch-import-data.json        # 批量导入数据
├── safety-styles.css             # CSS样式文件
└── README.md                     # 说明文档
```

## 使用说明

### 1. 系统初始化
- 确保MongoDB连接正常
- 导入新版本数据模型
- 运行数据转换工具

### 2. 评分计算
- 系统会根据配置文件自动计算总分和等级
- 支持百分比计算，更精确的等级划分

### 3. 数据验证
- 自动验证评分数据的有效性
- 检查评分项是否完整
- 验证选项和分数是否匹配

### 4. 配置管理
- 通过JSON文件管理评分规则
- 支持版本控制和配置升级
- 便于维护和扩展

## 扩展性

### 支持的功能扩展
- ✅ 动态添加评分项目
- ✅ 自定义评分权重
- ✅ 灵活的选项配置
- ✅ 分类管理
- ✅ 版本控制
- ✅ 数据验证
- ✅ 批量操作

### 未来可能的扩展
- 🔄 多语言支持
- 🔄 评分模板管理
- 🔄 历史版本对比
- 🔄 评分趋势分析
- 🔄 导出报表功能

## 注意事项

1. **配置版本**：修改配置文件时记得更新版本号
2. **数据备份**：重要操作前请备份数据
3. **验证测试**：新增评分项目后请进行充分测试
4. **兼容性**：新版本向后兼容，旧数据可自动转换

## 技术支持

如有问题，请检查：
1. 配置文件格式是否正确
2. 数据库连接是否正常
3. 评分数据是否完整
4. 版本号是否匹配 