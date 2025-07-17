# 地址信息管理 API 文档

## 概述
地址信息管理模块提供地址信息的增删改查功能，支持分页、模糊搜索、条件筛选等。

## API 接口

### 1. 地址列表查询
**接口地址：** `GET /api/location/list`

**请求参数：**
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | Number | 否 | 页码，默认1 |
| pageSize | Number | 否 | 每页数量，默认10 |
| keyword | String | 否 | 关键词搜索（地址名称、详细地址） |
| type | Number | 否 | 单位类型筛选（1-高层小区 2-重点单位 3-沿街商铺） |
| safeLevelId | Number | 否 | 安全等级筛选（1-优秀 2-良好 3-一般 4-较差） |

**请求示例：**
```
GET /api/location/list?page=1&pageSize=10&keyword=苏州&type=1&safeLevelId=1
```

**响应示例：**
```json
{
    "code": 200,
    "msg": "查询成功",
    "data": {
        "list": [
            {
                "addressId": "123456",
                "addressName": "江苏省苏州市工业园区东方之门",
                "addressExt": "江苏省苏州市工业园区东方之门北座负一楼303号",
                "allSenceLink": "https://www.720yun.com/vr/471j5gmwvu2",
                "type": 1,
                "safeLevelId": 1,
                "safeLevelName": "优秀",
                "safeLevelDesc": "该单位安全设施完备，符合消防安全标准。",
                "phoneList": [
                    {
                        "phone": "0512-12345678",
                        "name": "张三",
                        "type": 1
                    }
                ],
                "enterGateList": [
                    {
                        "name": "东门",
                        "type": 1
                    }
                ],
                "createTime": "2024-01-01T00:00:00.000Z",
                "updateTime": "2024-01-01T00:00:00.000Z"
            }
        ],
        "pagination": {
            "current": 1,
            "pageSize": 10,
            "total": 100,
            "totalPages": 10,
            "hasNext": true,
            "hasPrev": false
        }
    }
}
```

### 2. 地址明细查询
**接口地址：** `GET /api/location/detail`

**请求参数：**
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| addressId | String | 是 | 地址ID |

**请求示例：**
```
GET /api/location/detail?addressId=123456
```

**响应示例：**
```json
{
    "code": 200,
    "msg": "查询成功",
    "data": {
        "addressId": "123456",
        "addressName": "江苏省苏州市工业园区东方之门",
        "addressExt": "江苏省苏州市工业园区东方之门北座负一楼303号",
        "allSenceLink": "https://www.720yun.com/vr/471j5gmwvu2",
        "type": 1,
        "safeLevelId": 1,
        "safeLevelName": "优秀",
        "safeLevelDesc": "该单位安全设施完备，符合消防安全标准。",
        "phoneList": [
            {
                "phone": "0512-12345678",
                "name": "张三",
                "type": 1
            },
            {
                "phone": "0512-87654321",
                "name": "李四",
                "type": 2
            }
        ],
        "enterGateList": [
            {
                "name": "东门",
                "type": 1
            },
            {
                "name": "南门",
                "type": 2
            }
        ],
        "createTime": "2024-01-01T00:00:00.000Z",
        "updateTime": "2024-01-01T00:00:00.000Z"
    }
}
```

### 3. 新增地址信息
**接口地址：** `POST /api/location/add`

**请求参数：**
```json
{
    "addressId": "123456",
    "addressName": "江苏省苏州市工业园区东方之门",
    "addressExt": "江苏省苏州市工业园区东方之门北座负一楼303号",
    "allSenceLink": "https://www.720yun.com/vr/471j5gmwvu2",
    "type": 1,
    "safeLevelId": 1,
    "safeLevelName": "优秀",
    "safeLevelDesc": "该单位安全设施完备，符合消防安全标准。",
    "phoneList": [
        {
            "phone": "0512-12345678",
            "name": "张三",
            "type": 1
        }
    ],
    "enterGateList": [
        {
            "name": "东门",
            "type": 1
        }
    ]
}
```

**响应示例：**
```json
{
    "code": 200,
    "msg": "添加成功",
    "data": {
        "addressId": "123456",
        "addressName": "江苏省苏州市工业园区东方之门",
        // ... 其他字段
    }
}
```

### 4. 更新地址信息
**接口地址：** `PUT /api/location/:addressId`

**请求参数：**
```json
{
    "addressName": "江苏省苏州市工业园区东方之门（更新）",
    "safeLevelId": 2,
    "safeLevelName": "良好",
    "safeLevelDesc": "该单位安全设施较为完备，符合消防安全标准。"
}
```

**响应示例：**
```json
{
    "code": 200,
    "msg": "更新成功",
    "data": {
        "addressId": "123456",
        "addressName": "江苏省苏州市工业园区东方之门（更新）",
        // ... 其他字段
    }
}
```

### 5. 删除地址信息
**接口地址：** `DELETE /api/location/:addressId`

**请求示例：**
```
DELETE /api/location/123456
```

**响应示例：**
```json
{
    "code": 200,
    "msg": "删除成功"
}
```

### 6. 获取地址统计信息
**接口地址：** `GET /api/location/stats`

**响应示例：**
```json
{
    "code": 200,
    "msg": "查询成功",
    "data": {
        "totalCount": 100,
        "typeStats": [
            { "_id": 1, "count": 50 },
            { "_id": 2, "count": 30 },
            { "_id": 3, "count": 20 }
        ],
        "levelStats": [
            { "_id": 1, "count": 40 },
            { "_id": 2, "count": 35 },
            { "_id": 3, "count": 20 },
            { "_id": 4, "count": 5 }
        ]
    }
}
```

## 数据字典

### 单位类型（type）
- 1: 高层小区
- 2: 重点单位
- 3: 沿街商铺

### 安全等级（safeLevelId）
- 1: 优秀
- 2: 良好
- 3: 一般
- 4: 较差

### 联系人类型（phoneList.type）
- 1: 单位负责人
- 2: 消防负责人

### 进出口类型（enterGateList.type）
- 1: 东门
- 2: 南门
- 3: 西门
- 4: 北门

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 使用示例

### 前端调用示例（JavaScript）
```javascript
// 获取地址列表
async function getLocationList(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`/api/location/list?${queryString}`);
    return await response.json();
}

// 获取地址详情
async function getLocationDetail(addressId) {
    const response = await fetch(`/api/location/detail?addressId=${addressId}`);
    return await response.json();
}

// 使用示例
const list = await getLocationList({
    page: 1,
    pageSize: 10,
    keyword: '苏州',
    type: 1
});

const detail = await getLocationDetail('123456');
``` 