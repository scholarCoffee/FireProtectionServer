const dbmodel = require('../model/index.js');
const Location = dbmodel.Location;
const { getFireSafetyScoreByAddressId } = require('./fireSafetyScoreService.js');

// 地址列表查询（支持分页和模糊搜索）
exports.getLocationList = async (req, res) => {
    console.log('地址列表查询:', req.query);
    try {
        const { 
            page = 1, 
            pageSize = 10, 
            keyword = '', 
            type = ''
        } = req.query

        // 构建查询条件
        let query = {};
        
        // 关键词模糊搜索（地址名称、详细地址）
        if (keyword) {
            query.$or = [
                { addressId: { $regex: keyword, $options: 'i' } },
                { addressName: { $regex: keyword, $options: 'i' } },
                { addressExt: { $regex: keyword, $options: 'i' } }
            ];
        }
        
        // 单位类型筛选
        if (type && type !== '') {
            query.type = parseInt(type);
        }
        // 计算分页参数
        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        // 执行查询
        const [list, total] = await Promise.all([
            Location.find(query, { _id: 0, __v: 0 })
                .sort({ createTime: -1 })
                .skip(skip)
                .limit(limit),
            Location.countDocuments(query)
        ]);

        // 计算分页信息
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.send({
            code: 200,
            msg: '查询成功',
            data: {
                list,
                pagination: {
                    current: parseInt(page),
                    pageSize: limit,
                    total,
                    totalPages,
                    hasNext,
                    hasPrev
                }
            }
        });
    } catch (err) {
        console.error('地址列表查询失败:', err);
        res.send({ 
            code: 500, 
            msg: '查询失败', 
            error: err.message 
        });
    }
};

// 地址明细查询
exports.getLocationDetail = async (req, res) => {
    try {
        const { addressId } = req.query
        if (!addressId) {
            return res.send({ 
                code: 400, 
                msg: '缺少addressId参数' 
            });
        }

        const detail = await Location.findOne(
            { addressId }
        ).lean();

        if (!detail) {
            return res.send({ 
                code: 404, 
                msg: '未找到该地址信息' 
            });
        }

        // 查询关联的消防安全评分信息
        try {
            fireSafetyScore = await getFireSafetyScoreByAddressId(addressId)
        } catch (err) {
            console.error('查询消防安全评分失败:', err);
        }
        console.log('detail', detail);
        console.log('fireSafetyScore', fireSafetyScore);
        res.send({
            code: 200,
            msg: '查询成功',
            data: {
                ...detail,
                fireSafetyScore
            }
        });
    } catch (err) {
        console.error('地址明细查询失败:', err);
        res.send({ 
            code: 500, 
            msg: '查询失败', 
            error: err.message 
        });
    }
};

// 根据ID查询地址信息
exports.getLocationById = async (addressId) => {
    try {
        return await Location.findOne({ addressId }, { _id: 0, __v: 0 });
    } catch (err) {
        console.error('根据ID查询地址失败:', err);
        throw err;
    }
};

// 新增地址信息
exports.addLocation = async (req, res) => {
    try {
        const locationData = req.body;
        
        // 检查addressId是否已存在
        const existingLocation = await Location.findOne({ 
            addressId: locationData.addressId 
        });
        
        if (existingLocation) {
            return res.send({ 
                code: 400, 
                msg: '地址ID已存在' 
            });
        }

        const newLocation = new Location(locationData);
        const result = await newLocation.save();

        res.send({
            code: 200,
            msg: '添加成功',
            data: result
        });
    } catch (err) {
        console.error('添加地址失败:', err);
        res.send({ 
            code: 500, 
            msg: '添加失败', 
            error: err.message 
        });
    }
};

// 更新地址信息
exports.updateLocation = async (req, res) => {
    try {
        const { addressId } = req.params;
        const updateData = req.body;
        
        // 移除addressId字段，避免修改主键
        delete updateData.addressId;
        updateData.updateTime = new Date();

        const result = await Location.findOneAndUpdate(
            { addressId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!result) {
            return res.send({ 
                code: 404, 
                msg: '未找到该地址信息' 
            });
        }

        res.send({
            code: 200,
            msg: '更新成功',
            data: result
        });
    } catch (err) {
        console.error('更新地址失败:', err);
        res.send({ 
            code: 500, 
            msg: '更新失败', 
            error: err.message 
        });
    }
};

// 删除地址信息
exports.deleteLocation = async (req, res) => {
    try {
        const { addressId } = req.params;

        const result = await Location.findOneAndDelete({ addressId });

        if (!result) {
            return res.send({ 
                code: 404, 
                msg: '未找到该地址信息' 
            });
        }

        res.send({
            code: 200,
            msg: '删除成功'
        });
    } catch (err) {
        console.error('删除地址失败:', err);
        res.send({ 
            code: 500, 
            msg: '删除失败', 
            error: err.message 
        });
    }
};

// 获取地址统计信息
exports.getLocationStats = async (req, res) => {
    try {
        const [totalCount, typeStats, levelStats] = await Promise.all([
            Location.countDocuments(),
            Location.aggregate([
                { $group: { _id: '$type', count: { $sum: 1 } } }
            ]),
            Location.aggregate([
                { $group: { _id: '$safeLevelId', count: { $sum: 1 } } }
            ])
        ]);

        res.send({
            code: 200,
            msg: '查询成功',
            data: {
                totalCount,
                typeStats,
                levelStats
            }
        });
    } catch (err) {
        console.error('获取统计信息失败:', err);
        res.send({ 
            code: 500, 
            msg: '查询失败', 
            error: err.message 
        });
    }
}; 